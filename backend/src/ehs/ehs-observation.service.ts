import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import {
  EhsObservation,
  EhsObservationRectificationHistoryEntry,
  EhsObservationSeverity,
  EhsObservationStatus,
} from './entities/ehs-observation.entity';
import { EhsProjectConfig } from './entities/ehs-project-config.entity';
import { AuditService } from '../audit/audit.service';
import { PushNotificationService } from '../notifications/push-notification.service';
import { NotificationComposerService } from '../notifications/notification-composer.service';
import {
  CloseEhsObservationDto,
  CreateEhsObservationDto,
  HoldEhsObservationDto,
  RectifyEhsObservationDto,
  RejectEhsObservationRectificationDto,
} from './dto/ehs-observation.dto';
import { toRelativePaths } from '../common/path.utils';
import { EpsNode } from '../eps/eps.entity';
import { User } from '../users/user.entity';

@Injectable()
export class EhsObservationService {
  private readonly logger = new Logger(EhsObservationService.name);

  constructor(
    @InjectRepository(EhsObservation)
    private readonly observationRepo: Repository<EhsObservation>,
    @InjectRepository(EhsProjectConfig)
    private readonly configRepo: Repository<EhsProjectConfig>,
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly auditService: AuditService,
    private readonly pushService: PushNotificationService,
    private readonly notificationComposer: NotificationComposerService,
  ) {}

  private sanitizeObservationCategories(categories?: unknown): string[] {
    const values = Array.isArray(categories) ? categories : [];
    const deduped = Array.from(
      new Set(
        values
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    );

    return deduped.length > 0
      ? deduped
      : [
          'General Safety',
          'Work at Height',
          'PPE',
          'Electrical Safety',
          'Housekeeping',
          'Fire Safety',
          'Lifting Operations',
          'Scaffolding',
          'Excavation',
          'Plant & Machinery',
        ];
  }

  private async getConfig(projectId: number): Promise<EhsProjectConfig> {
    let config = await this.configRepo.findOne({ where: { projectId } });
    if (!config) {
      config = this.configRepo.create({ projectId });
      await this.configRepo.save(config);
    }
    return config;
  }

  async getObservationCategories(projectId: number): Promise<string[]> {
    const config = await this.getConfig(projectId);
    return this.sanitizeObservationCategories(config.observationCategories);
  }

  async updateObservationCategories(
    projectId: number,
    categories: unknown,
  ): Promise<string[]> {
    const config = await this.getConfig(projectId);
    config.observationCategories =
      this.sanitizeObservationCategories(categories);
    await this.configRepo.save(config);
    return config.observationCategories;
  }

  async getAll(
    projectId: number,
    status?: string,
    severity?: string,
    options?: {
      q?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
      paged?: boolean;
    },
  ) {
    const query = this.observationRepo
      .createQueryBuilder('obs')
      .leftJoinAndSelect('obs.epsNode', 'epsNode')
      .where('obs.projectId = :projectId', { projectId });

    if (status && status !== 'ALL') {
      if (status === 'OPEN') {
        query.andWhere('obs.status IN (:...statuses)', {
          statuses: ['OPEN', 'HELD'],
        });
      } else {
        query.andWhere('obs.status = :status', { status });
      }
    }
    if (severity && severity !== 'ALL') {
      query.andWhere('obs.severity = :severity', { severity });
    }
    if (options?.dateFrom) {
      query.andWhere('obs.createdAt >= :dateFrom', {
        dateFrom: new Date(options.dateFrom),
      });
    }
    if (options?.dateTo) {
      query.andWhere('obs.createdAt <= :dateTo', {
        dateTo: new Date(`${options.dateTo}T23:59:59`),
      });
    }
    const q = options?.q?.trim();
    if (q) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where(
            `LOWER(COALESCE(obs.description, '') || ' ' || COALESCE(obs.category, '') || ' ' || COALESCE(obs.locationLabel, '')) LIKE :q`,
            { q: `%${q.toLowerCase()}%` },
          ).orWhere('LOWER(epsNode.name) LIKE :q', {
            q: `%${q.toLowerCase()}%`,
          });
        }),
      );
    }

    query.orderBy('obs.createdAt', 'DESC');

    if (options?.paged) {
      const page = Math.max(1, Number(options.page) || 1);
      const pageSize = Math.min(100, Math.max(5, Number(options.pageSize) || 10));
      const [rows, total] = await query
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getManyAndCount();
      return {
        data: await this.decorateObservationRaisers(
          rows.map((obs) => this.normalizePhotos(obs)),
        ),
        total,
        page,
        pageSize,
      };
    }

    const rows = await query.getMany();
    return this.decorateObservationRaisers(
      rows.map((obs) => this.normalizePhotos(obs)),
    );
  }

  async exportRegister(
    projectId: number,
    filters: {
      status?: string;
      severity?: string;
      dateFrom?: string;
      dateTo?: string;
      q?: string;
      ids?: string;
      fullDump?: boolean;
    },
  ): Promise<Buffer> {
    const query = this.observationRepo
      .createQueryBuilder('obs')
      .leftJoinAndSelect('obs.epsNode', 'epsNode')
      .where('obs.projectId = :projectId', { projectId });

    if (!filters.fullDump) {
      const ids = this.parseExportIds(filters.ids);
      if (ids.length > 0) {
        query.andWhere('obs.id IN (:...ids)', { ids });
      } else {
        if (filters.status && filters.status !== 'ALL') {
          if (filters.status === 'OPEN') {
            query.andWhere('obs.status IN (:...statuses)', {
              statuses: ['OPEN', 'HELD'],
            });
          } else {
            query.andWhere('obs.status = :status', { status: filters.status });
          }
        }
        if (filters.severity && filters.severity !== 'ALL') {
          query.andWhere('obs.severity = :severity', {
            severity: filters.severity,
          });
        }
        if (filters.dateFrom) {
          query.andWhere('obs.createdAt >= :dateFrom', {
            dateFrom: new Date(filters.dateFrom),
          });
        }
        if (filters.dateTo) {
          query.andWhere('obs.createdAt <= :dateTo', {
            dateTo: new Date(`${filters.dateTo}T23:59:59`),
          });
        }
        if (filters.q?.trim()) {
          query.andWhere(
            `(LOWER(COALESCE(obs.description, '') || ' ' || COALESCE(obs.category, '') || ' ' || COALESCE(obs.locationLabel, '')) LIKE :q OR LOWER(epsNode.name) LIKE :q)`,
            { q: `%${filters.q.trim().toLowerCase()}%` },
          );
        }
      }
    }

    const rows = (await query.orderBy('obs.createdAt', 'DESC').getMany()).map(
      (obs) => this.decorateObservation(this.normalizePhotos(obs)),
    );
    const projectInfo = await this.getProjectInfo(projectId);
    const registerRows = rows.map((obs, index) => ({
      'Sl No': index + 1,
      'Observation ID': obs.id,
      Status: obs.status,
      Severity: obs.severity,
      Category: obs.category,
      Location: obs.locationLabel || obs.epsNode?.name || 'General Site',
      Description: obs.description,
      Remarks: obs.remarks || '',
      'Target Date': obs.targetDate || '',
      'Raised On': obs.createdAt ? new Date(obs.createdAt).toLocaleString() : '',
      'Ageing Days': obs.ageingDays,
      'Rectification': obs.rectificationText || '',
      'Rectified On': obs.rectifiedAt
        ? new Date(obs.rectifiedAt).toLocaleString()
        : '',
      'Closure Remarks': obs.closureRemarks || '',
      'Closed On': obs.closedAt ? new Date(obs.closedAt).toLocaleString() : '',
      'Hold Reason': obs.holdReason || '',
      'Photo Count': obs.photos?.length || 0,
      'Rectification Photo Count': obs.rectificationPhotos?.length || 0,
    }));

    const summaryRows = [
      { Metric: 'Module', Value: 'EHS Observation Register' },
      { Metric: 'Generated On', Value: new Date().toLocaleString() },
      { Metric: 'Project ID', Value: projectId },
      { Metric: 'Project Name', Value: projectInfo.name },
      { Metric: 'Project Path', Value: projectInfo.path },
      {
        Metric: 'Export Scope',
        Value: filters.fullDump
          ? 'Full data dump'
          : filters.ids
            ? 'Selected observations'
            : 'Filtered register',
      },
      { Metric: 'Total Records', Value: rows.length },
      { Metric: 'Open / Held', Value: rows.filter((r) => ['OPEN', 'HELD'].includes(r.status)).length },
      { Metric: 'Rectified', Value: rows.filter((r) => r.status === 'RECTIFIED').length },
      { Metric: 'Closed', Value: rows.filter((r) => r.status === 'CLOSED').length },
      { Metric: 'Critical', Value: rows.filter((r) => r.severity === 'CRITICAL').length },
      { Metric: 'Major', Value: rows.filter((r) => r.severity === 'MAJOR').length },
      { Metric: 'Minor', Value: rows.filter((r) => r.severity === 'MINOR').length },
      { Metric: 'Info', Value: rows.filter((r) => r.severity === 'INFO').length },
    ];

    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    const registerSheet = XLSX.utils.json_to_sheet(registerRows);
    if (registerSheet['!ref']) {
      registerSheet['!autofilter'] = { ref: registerSheet['!ref'] };
    }
    registerSheet['!cols'] = [
      { wch: 8 },
      { wch: 36 },
      { wch: 14 },
      { wch: 12 },
      { wch: 22 },
      { wch: 38 },
      { wch: 70 },
      { wch: 30 },
      { wch: 14 },
      { wch: 22 },
      { wch: 12 },
      { wch: 50 },
      { wch: 22 },
      { wch: 40 },
      { wch: 22 },
      { wch: 30 },
      { wch: 12 },
      { wch: 20 },
    ];
    summarySheet['!cols'] = [{ wch: 24 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    XLSX.utils.book_append_sheet(workbook, registerSheet, 'Observation Register');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  private parseExportIds(ids?: string) {
    return (ids || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  private async getProjectInfo(projectId: number) {
    const path: string[] = [];
    let currentId: number | null | undefined = projectId;
    while (currentId) {
      const node = await this.epsRepo.findOne({ where: { id: currentId } });
      if (!node) break;
      path.unshift(node.name);
      currentId = node.parentId;
    }
    return {
      name: path[path.length - 1] || `Project #${projectId}`,
      path: path.join(' / ') || `Project #${projectId}`,
    };
  }

  async getById(id: string) {
    const obs = await this.observationRepo.findOne({
      where: { id },
      relations: ['epsNode'],
    });
    if (!obs) throw new NotFoundException('EHS observation not found');
    return this.decorateObservation(this.normalizePhotos(obs));
  }

  private normalizePhotos(obs: EhsObservation): EhsObservation {
    obs.photos = toRelativePaths(obs.photos);
    obs.rectificationPhotos = toRelativePaths(obs.rectificationPhotos);
    obs.rectificationHistory = Array.isArray(obs.rectificationHistory)
      ? obs.rectificationHistory.map((entry) => ({
          ...entry,
          photos: toRelativePaths(entry.photos),
        }))
      : [];
    return obs;
  }

  private decorateObservation(obs: EhsObservation) {
    const ageingMinutes = this.calculateAgeingMinutes(obs);
    return {
      ...obs,
      ageingMinutes,
      ageingHours: Number((ageingMinutes / 60).toFixed(1)),
      ageingDays: Number((ageingMinutes / 1440).toFixed(1)),
      isHeld: obs.status === EhsObservationStatus.HELD,
    };
  }

  private async decorateObservationRaisers(observations: EhsObservation[]) {
    const userIds = Array.from(
      new Set(
        observations
          .map((observation) => Number(observation.raisedById))
          .filter((userId) => Number.isInteger(userId) && userId > 0),
      ),
    );
    const users = userIds.length
      ? await this.userRepo.find({
          where: { id: In(userIds) },
          select: ['id', 'username', 'displayName', 'designation'],
        })
      : [];
    const userMap = new Map(
      users.map((user) => [
        String(user.id),
        {
          id: user.id,
          username: user.username,
          displayName: user.displayName || user.username,
          designation: user.designation || null,
        },
      ]),
    );

    return observations.map((observation) => ({
      ...this.decorateObservation(observation),
      raisedBy: observation.raisedById
        ? userMap.get(observation.raisedById) || null
        : null,
    }));
  }

  private calculateAgeingMinutes(obs: EhsObservation) {
    const endTime =
      obs.rectifiedAt
        ? obs.rectifiedAt.getTime()
        : obs.status === EhsObservationStatus.CLOSED && obs.closedAt
          ? obs.closedAt.getTime()
        : Date.now();
    const holdInProgressMinutes =
      obs.status === EhsObservationStatus.HELD && obs.holdStartedAt
        ? Math.max(
            0,
            Math.floor((Date.now() - obs.holdStartedAt.getTime()) / 60000),
          )
        : 0;
    const totalHoldMinutes =
      (obs.holdAccumulatedMinutes || 0) + holdInProgressMinutes;
    return Math.max(
      0,
      Math.floor((endTime - new Date(obs.createdAt).getTime()) / 60000) -
        totalHoldMinutes,
    );
  }

  private appendRectificationHistory(
    obs: EhsObservation,
    entry: EhsObservationRectificationHistoryEntry,
  ) {
    obs.rectificationHistory = [...(obs.rectificationHistory || []), entry];
  }

  private async resolveLocationLabel(
    epsNodeId?: number,
    locationLabel?: string,
  ): Promise<string | null> {
    if (locationLabel?.trim()) {
      return locationLabel.trim();
    }
    if (!epsNodeId) {
      return null;
    }

    const path: string[] = [];
    let currentId: number | null = epsNodeId;
    while (currentId) {
      const node = await this.epsRepo.findOne({ where: { id: currentId } });
      if (!node) break;
      path.unshift(node.name);
      currentId = node.parentId ?? null;
    }

    return path.length > 0 ? path.join(' > ') : null;
  }

  async create(dto: CreateEhsObservationDto, userId?: string) {
    const cleanedDto = { ...dto };
    if (cleanedDto.targetDate === '') {
      delete cleanedDto.targetDate;
    }

    const obs = this.observationRepo.create({
      ...cleanedDto,
      locationLabel:
        (await this.resolveLocationLabel(
          cleanedDto.epsNodeId,
          cleanedDto.locationLabel,
        )) ?? undefined,
      photos: toRelativePaths(cleanedDto.photos),
      status: EhsObservationStatus.OPEN,
      raisedById: userId,
      rectificationHistory: [],
    });

    const saved = await this.observationRepo.save(obs);

    if (
      dto.severity === EhsObservationSeverity.CRITICAL ||
      dto.severity === EhsObservationSeverity.MAJOR
    ) {
      const notification =
        await this.notificationComposer.composeObservationRaised({
          moduleLabel: 'EHS',
          projectId: dto.projectId,
          epsNodeId: dto.epsNodeId,
          severity: dto.severity,
          category: dto.category,
          subjectLabel: dto.category || 'EHS observation',
        });

      this.pushService
        .sendToProjectPermission(
          dto.projectId,
          'EHS.SITE_OBS.CLOSE',
          notification.title,
          notification.body,
          {
            observationId: String(saved.id),
            ...notification.data,
          },
        )
        .catch(() => {
          /* non-fatal */
        });
    }

    if (userId) {
      await this.auditService.log(
        parseInt(userId, 10),
        'EHS',
        'SITE_OBS_CREATE',
        saved.id.toString(),
        dto.epsNodeId,
        { category: dto.category, severity: dto.severity },
      );
    }

    return this.decorateObservation(this.normalizePhotos(saved));
  }

  async rectify(id: string, dto: RectifyEhsObservationDto, userId?: string) {
    const obs = await this.observationRepo.findOne({ where: { id } });
    if (!obs) throw new NotFoundException('EHS observation not found');

    if (obs.status !== EhsObservationStatus.OPEN) {
      throw new BadRequestException('Observation is not OPEN');
    }

    obs.status = EhsObservationStatus.RECTIFIED;
    obs.rectificationText = dto.rectificationText;
    obs.rectificationPhotos = toRelativePaths(dto.rectificationPhotos);
    if (userId) {
      obs.rectifiedById = userId;
    }
    obs.rectifiedAt = new Date();
    this.appendRectificationHistory(obs, {
      type: 'RECTIFIED',
      text: obs.rectificationText,
      photos: obs.rectificationPhotos || [],
      actorId: userId || null,
      at: obs.rectifiedAt.toISOString(),
    });

    const saved = this.normalizePhotos(await this.observationRepo.save(obs));

    if (obs.raisedById) {
      const notification =
        await this.notificationComposer.composeObservationUpdate({
          moduleLabel: 'EHS',
          projectId: obs.projectId,
          epsNodeId: obs.epsNodeId,
          severity: obs.severity,
          category: obs.category,
          subjectLabel: obs.category || 'EHS observation',
          statusLabel: 'EHS Observation Rectified',
          notificationType: 'EHS_OBS_RECTIFIED',
        });

      this.pushService
        .sendToProjectUsers(
          obs.projectId,
          [parseInt(obs.raisedById, 10)],
          notification.title,
          `${notification.body} | Please review and close.`,
          {
            observationId: String(saved.id),
            ...notification.data,
          },
        )
        .catch(() => {
          /* non-fatal */
        });
    }

    if (userId) {
      await this.auditService.log(
        parseInt(userId, 10),
        'EHS',
        'SITE_OBS_RECTIFY',
        saved.id.toString(),
        obs.epsNodeId,
        { rectifiedAt: obs.rectifiedAt },
      );
    }

    return this.decorateObservation(saved);
  }

  async rejectRectification(
    id: string,
    dto: RejectEhsObservationRectificationDto,
    userId?: string,
  ) {
    const obs = await this.observationRepo.findOne({ where: { id } });
    if (!obs) throw new NotFoundException('EHS observation not found');

    if (obs.status !== EhsObservationStatus.RECTIFIED) {
      throw new BadRequestException(
        'Only rectified observations can be rejected back to open.',
      );
    }

    const rejectionRemarks = dto.rejectionRemarks?.trim();
    if (!rejectionRemarks) {
      throw new BadRequestException('Rejection remarks are required.');
    }
    obs.status = EhsObservationStatus.OPEN;
    obs.rectificationRejectedRemarks = rejectionRemarks;
    obs.rectificationRejectedById = userId || null;
    obs.rectificationRejectedAt = new Date();
    this.appendRectificationHistory(obs, {
      type: 'REJECTED',
      text: obs.rectificationText,
      photos: obs.rectificationPhotos || [],
      rejectionRemarks: obs.rectificationRejectedRemarks,
      actorId: userId || null,
      at: obs.rectificationRejectedAt.toISOString(),
    });

    const saved = this.normalizePhotos(await this.observationRepo.save(obs));

    if (obs.raisedById) {
      const notification =
        await this.notificationComposer.composeObservationUpdate({
          moduleLabel: 'EHS',
          projectId: obs.projectId,
          epsNodeId: obs.epsNodeId,
          severity: obs.severity,
          category: obs.category,
          subjectLabel: obs.category || 'EHS observation',
          statusLabel: 'EHS Rectification Rejected',
          notificationType: 'EHS_OBS_RECTIFICATION_REJECTED',
        });

      this.pushService
        .sendToProjectUsers(
          obs.projectId,
          [parseInt(obs.raisedById, 10)],
          notification.title,
          [
            notification.body,
            obs.rectificationRejectedRemarks
              ? `Reason: ${obs.rectificationRejectedRemarks}`
              : 'Please rectify and submit again.',
          ].join(' | '),
          {
            observationId: String(saved.id),
            ...notification.data,
          },
        )
        .catch(() => {
          /* non-fatal */
        });
    }

    if (userId) {
      await this.auditService.log(
        parseInt(userId, 10),
        'EHS',
        'SITE_OBS_REJECT_RECTIFICATION',
        saved.id.toString(),
        obs.epsNodeId,
        {
          rejectedAt: obs.rectificationRejectedAt,
          rejectionRemarks: obs.rectificationRejectedRemarks,
        },
      );
    }

    return this.decorateObservation(saved);
  }

  async hold(id: string, dto: HoldEhsObservationDto, userId?: string) {
    const obs = await this.observationRepo.findOne({ where: { id } });
    if (!obs) throw new NotFoundException('EHS observation not found');

    if (obs.status === EhsObservationStatus.CLOSED) {
      throw new BadRequestException('Closed observations cannot be held.');
    }
    if (obs.status === EhsObservationStatus.HELD) {
      throw new BadRequestException('Observation is already held.');
    }

    obs.status = EhsObservationStatus.HELD;
    obs.holdReason = dto.holdReason?.trim() || null;
    obs.holdStartedAt = new Date();
    obs.heldById = userId || null;

    const saved = this.normalizePhotos(await this.observationRepo.save(obs));
    return this.decorateObservation(saved);
  }

  async unhold(id: string) {
    const obs = await this.observationRepo.findOne({ where: { id } });
    if (!obs) throw new NotFoundException('EHS observation not found');

    if (obs.status !== EhsObservationStatus.HELD || !obs.holdStartedAt) {
      throw new BadRequestException('Observation is not currently held.');
    }

    obs.holdAccumulatedMinutes =
      (obs.holdAccumulatedMinutes || 0) +
      Math.max(
        0,
        Math.floor((Date.now() - obs.holdStartedAt.getTime()) / 60000),
      );
    obs.holdStartedAt = null;
    obs.holdReason = null;
    obs.heldById = null;
    obs.status = EhsObservationStatus.OPEN;

    const saved = this.normalizePhotos(await this.observationRepo.save(obs));
    return this.decorateObservation(saved);
  }

  async close(id: string, dto: CloseEhsObservationDto, userId?: string) {
    const obs = await this.observationRepo.findOne({ where: { id } });
    if (!obs) throw new NotFoundException('EHS observation not found');

    if (obs.status === EhsObservationStatus.CLOSED) {
      throw new BadRequestException('Observation is already CLOSED');
    }

    if (
      obs.severity !== EhsObservationSeverity.INFO &&
      obs.status !== EhsObservationStatus.RECTIFIED
    ) {
      throw new BadRequestException(
        'Observation must be RECTIFIED before closing (unless INFO severity)',
      );
    }

    obs.status = EhsObservationStatus.CLOSED;
    if (dto.closureRemarks) {
      obs.closureRemarks = dto.closureRemarks;
    }
    if (userId) {
      obs.closedById = userId;
    }
    obs.closedAt = new Date();

    const saved = this.normalizePhotos(await this.observationRepo.save(obs));

    if (obs.raisedById) {
      const notification =
        await this.notificationComposer.composeObservationUpdate({
          moduleLabel: 'EHS',
          projectId: obs.projectId,
          epsNodeId: obs.epsNodeId,
          severity: obs.severity,
          category: obs.category,
          subjectLabel: obs.category || 'EHS observation',
          statusLabel: 'EHS Observation Closed',
          notificationType: 'EHS_OBS_CLOSED',
        });

      this.pushService
        .sendToProjectUsers(
          obs.projectId,
          [parseInt(obs.raisedById, 10)],
          notification.title,
          notification.body,
          {
            observationId: String(saved.id),
            ...notification.data,
          },
        )
        .catch(() => {
          /* non-fatal */
        });
    }

    if (userId) {
      await this.auditService.log(
        parseInt(userId, 10),
        'EHS',
        'SITE_OBS_CLOSE',
        saved.id.toString(),
        obs.epsNodeId,
        { closedAt: obs.closedAt },
      );
    }

    return this.decorateObservation(saved);
  }

  async delete(id: string, userId?: string) {
    const obs = await this.observationRepo.findOne({ where: { id } });
    if (!obs) throw new NotFoundException('EHS observation not found');

    await this.observationRepo.remove(obs);

    if (userId) {
      await this.auditService.log(
        parseInt(userId, 10),
        'EHS',
        'SITE_OBS_DELETE',
        obs.id.toString(),
        obs.epsNodeId,
        { description: obs.description },
      );
    }

    return { success: true };
  }
}
