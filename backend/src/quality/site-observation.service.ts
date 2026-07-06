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
  SiteObservation,
  SiteObservationRectificationHistoryEntry,
  SiteObservationSeverity,
  SiteObservationStatus,
} from './entities/site-observation.entity';
import { QualityRatingConfig } from './entities/quality-rating-config.entity';
import { AuditService } from '../audit/audit.service';
import { PushNotificationService } from '../notifications/push-notification.service';
import { NotificationComposerService } from '../notifications/notification-composer.service';
import {
  CloseSiteObservationDto,
  CreateSiteObservationDto,
  HoldSiteObservationDto,
  RectifySiteObservationDto,
  RejectSiteObservationRectificationDto,
} from './dto/site-observation.dto';
import { toRelativePaths } from '../common/path.utils';
import { EpsNode } from '../eps/eps.entity';
import {
  normalizeObservationRating,
  QualityObservationRating,
  ratingToSiteSeverity,
} from './observation-rating';
import { QualityNcrSyncService } from './quality-ncr-sync.service';
import { User } from '../users/user.entity';

@Injectable()
export class SiteObservationService {
  private readonly logger = new Logger(SiteObservationService.name);

  constructor(
    @InjectRepository(SiteObservation)
    private readonly observationRepo: Repository<SiteObservation>,
    @InjectRepository(QualityRatingConfig)
    private readonly configRepo: Repository<QualityRatingConfig>,
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly auditService: AuditService,
    private readonly pushService: PushNotificationService,
    private readonly notificationComposer: NotificationComposerService,
    private readonly ncrSyncService: QualityNcrSyncService,
  ) {}

  private sanitizeObservationCategories(categories?: unknown): string[] {
    const values = Array.isArray(categories) ? categories : [];
    const deduped = Array.from(
      new Set(
        values.map((value) => String(value ?? '').trim()).filter(Boolean),
      ),
    );

    return deduped.length > 0
      ? deduped
      : [
          'Structural',
          'Architectural',
          'MEP',
          'Finishes',
          'Materials',
          'Workmanship',
          'General / Others',
        ];
  }

  private async getConfig(projectId: number): Promise<QualityRatingConfig> {
    let config = await this.configRepo.findOne({
      where: { projectNodeId: projectId },
    });
    if (!config) {
      config = this.configRepo.create({ projectNodeId: projectId });
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
      const pageSize = Math.min(
        100,
        Math.max(5, Number(options.pageSize) || 10),
      );
      const [rows, total] = await query
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getManyAndCount();
      return {
        data: await this.decorateObservations(
          rows.map((obs) => this.normalizePhotos(obs)),
        ),
        total,
        page,
        pageSize,
      };
    }

    const rows = await query.getMany();
    return this.decorateObservations(
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

    const rows = await this.decorateObservations(
      (await query.orderBy('obs.createdAt', 'DESC').getMany()).map((obs) =>
        this.normalizePhotos(obs),
      ),
    );
    const projectInfo = await this.getProjectInfo(projectId);
    const registerRows = rows.map((obs, index) => ({
      'Sl No': index + 1,
      'Observation ID': obs.id,
      Status: obs.status,
      'Observation Rating': obs.observationRating,
      Severity: obs.severity,
      Category: obs.category,
      Location: obs.locationLabel || obs.epsNode?.name || 'General Site',
      Description: obs.description,
      Remarks: obs.remarks || '',
      'Target Date': obs.targetDate || '',
      'Raised On': obs.createdAt
        ? new Date(obs.createdAt).toLocaleString()
        : '',
      'Raised By': obs.raisedBy?.displayName || '',
      'Ageing Days': obs.ageingDays,
      Rectification: obs.rectificationText || '',
      'Rectified On': obs.rectifiedAt
        ? new Date(obs.rectifiedAt).toLocaleString()
        : '',
      'Rectified By': obs.rectifiedBy?.displayName || '',
      'Closure Remarks': obs.closureRemarks || '',
      'Closed On': obs.closedAt ? new Date(obs.closedAt).toLocaleString() : '',
      'Closed By': obs.closedBy?.displayName || '',
      'Hold Reason': obs.holdReason || '',
      'Photo Count': obs.photos?.length || 0,
      'Rectification Photo Count': obs.rectificationPhotos?.length || 0,
    }));

    const summaryRows = [
      { Metric: 'Module', Value: 'Quality Observation Register' },
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
      {
        Metric: 'Open / Held',
        Value: rows.filter((r) => ['OPEN', 'HELD'].includes(r.status)).length,
      },
      {
        Metric: 'Rectified',
        Value: rows.filter((r) => r.status === 'RECTIFIED').length,
      },
      {
        Metric: 'Closed',
        Value: rows.filter((r) => r.status === 'CLOSED').length,
      },
      {
        Metric: 'Critical',
        Value: rows.filter((r) => r.observationRating === 'CRITICAL').length,
      },
      {
        Metric: 'Major',
        Value: rows.filter((r) => r.observationRating === 'MAJOR').length,
      },
      {
        Metric: 'Moderate',
        Value: rows.filter((r) => r.observationRating === 'MODERATE').length,
      },
      {
        Metric: 'Minor',
        Value: rows.filter((r) => r.observationRating === 'MINOR').length,
      },
      {
        Metric: 'OFI',
        Value: rows.filter((r) => r.observationRating === 'OFI').length,
      },
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
    XLSX.utils.book_append_sheet(
      workbook,
      registerSheet,
      'Observation Register',
    );
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
    if (!obs) throw new NotFoundException('Site observation not found');
    return this.decorateOneObservation(this.normalizePhotos(obs));
  }

  private normalizePhotos(obs: SiteObservation): SiteObservation {
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

  private decorateObservation(obs: SiteObservation) {
    const ageingMinutes = this.calculateAgeingMinutes(obs);
    return {
      ...obs,
      ageingMinutes,
      ageingHours: Number((ageingMinutes / 60).toFixed(1)),
      ageingDays: Number((ageingMinutes / 1440).toFixed(1)),
      isHeld: obs.status === SiteObservationStatus.HELD,
    };
  }

  private async decorateObservations(observations: SiteObservation[]) {
    const userIds = Array.from(
      new Set(
        observations
          .flatMap((obs) => [obs.raisedById, obs.rectifiedById, obs.closedById])
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0),
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

    return observations.map((obs) => ({
      ...this.decorateObservation(obs),
      raisedBy: obs.raisedById ? userMap.get(obs.raisedById) || null : null,
      rectifiedBy: obs.rectifiedById
        ? userMap.get(obs.rectifiedById) || null
        : null,
      closedBy: obs.closedById ? userMap.get(obs.closedById) || null : null,
    }));
  }

  private async decorateOneObservation(observation: SiteObservation) {
    const [decorated] = await this.decorateObservations([observation]);
    return decorated;
  }

  private calculateAgeingMinutes(obs: SiteObservation) {
    const endTime = obs.rectifiedAt
      ? obs.rectifiedAt.getTime()
      : obs.status === SiteObservationStatus.CLOSED && obs.closedAt
        ? obs.closedAt.getTime()
        : Date.now();
    const holdInProgressMinutes =
      obs.status === SiteObservationStatus.HELD && obs.holdStartedAt
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
    obs: SiteObservation,
    entry: SiteObservationRectificationHistoryEntry,
  ) {
    obs.rectificationHistory = [...(obs.rectificationHistory || []), entry];
  }

  private uniqueUserIds(values: Array<number | string | null | undefined>) {
    return Array.from(
      new Set(
        values
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    );
  }

  private async notifySiteObservationPermission(
    obs: SiteObservation,
    permissionCode: string,
    options: {
      title: string;
      body: string;
      type: string;
      directUserIds?: Array<number | string | null | undefined>;
      extraBody?: string | null;
    },
  ) {
    const notification =
      await this.notificationComposer.composeObservationUpdate({
        moduleLabel: 'Quality',
        projectId: obs.projectId,
        epsNodeId: obs.epsNodeId,
        severity: obs.severity,
        category: obs.category,
        subjectLabel: obs.category || 'Site observation',
        statusLabel: options.title,
        notificationType: options.type,
      });
    const body = [
      notification.body,
      options.body && options.body !== notification.body ? options.body : null,
      options.extraBody,
    ]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(' | ');
    const data = {
      observationId: String(obs.id),
      module: 'QUALITY',
      sourceType: 'QUALITY_SITE_OBSERVATION',
      ...notification.data,
    };

    await this.pushService.sendToProjectPermission(
      obs.projectId,
      permissionCode,
      notification.title,
      body,
      data,
    );

    const directUserIds = this.uniqueUserIds(options.directUserIds || []);
    if (directUserIds.length > 0) {
      await this.pushService.sendToProjectUsers(
        obs.projectId,
        directUserIds,
        notification.title,
        body,
        data,
      );
    }
  }

  private async notifySiteObservationUsers(
    obs: SiteObservation,
    options: {
      title: string;
      body: string;
      type: string;
      directUserIds: Array<number | string | null | undefined>;
      extraBody?: string | null;
    },
  ) {
    const directUserIds = this.uniqueUserIds(options.directUserIds);
    if (directUserIds.length === 0) return;
    const notification =
      await this.notificationComposer.composeObservationUpdate({
        moduleLabel: 'Quality',
        projectId: obs.projectId,
        epsNodeId: obs.epsNodeId,
        severity: obs.severity,
        category: obs.category,
        subjectLabel: obs.category || 'Site observation',
        statusLabel: options.title,
        notificationType: options.type,
      });
    const body = [
      notification.body,
      options.body && options.body !== notification.body ? options.body : null,
      options.extraBody,
    ]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(' | ');

    await this.pushService.sendToProjectUsers(
      obs.projectId,
      directUserIds,
      notification.title,
      body,
      {
        observationId: String(obs.id),
        module: 'QUALITY',
        sourceType: 'QUALITY_SITE_OBSERVATION',
        ...notification.data,
      },
    );
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

  async create(dto: CreateSiteObservationDto, userId?: string) {
    const cleanedDto = { ...dto };
    if (cleanedDto.targetDate === '') {
      delete cleanedDto.targetDate;
    }

    const observationRating = normalizeObservationRating(
      cleanedDto.observationRating || cleanedDto.severity,
    );
    const obs = this.observationRepo.create({
      ...cleanedDto,
      observationRating,
      severity: ratingToSiteSeverity(observationRating),
      locationLabel:
        (await this.resolveLocationLabel(
          cleanedDto.epsNodeId,
          cleanedDto.locationLabel,
        )) ?? undefined,
      photos: toRelativePaths(cleanedDto.photos),
      status: SiteObservationStatus.OPEN,
      raisedById: userId,
      rectificationHistory: [],
    });

    const saved = await this.observationRepo.save(obs);
    if (observationRating === QualityObservationRating.CRITICAL) {
      const ncr = await this.ncrSyncService.ensureCriticalNcr({
        projectId: saved.projectId,
        sourceType: 'QUALITY_SITE_OBSERVATION',
        sourceId: saved.id,
        sourceReference: `Quality Site Observation ${saved.id}`,
        category: saved.category,
        description: saved.description,
        location: saved.locationLabel,
        reportedBy: userId ? `User #${userId}` : 'System',
        targetDate: saved.targetDate,
        attachmentUrl: saved.photos?.[0],
      });
      saved.ncrId = ncr.id;
      await this.observationRepo.save(saved);
    }

    {
      const notification =
        await this.notificationComposer.composeObservationRaised({
          moduleLabel: 'Quality',
          projectId: dto.projectId,
          epsNodeId: dto.epsNodeId,
          severity: dto.severity,
          category: dto.category,
          subjectLabel: dto.category || 'Site observation',
        });

      this.pushService
        .sendToProjectPermission(
          dto.projectId,
          'QUALITY.SITE_OBS.RECTIFY',
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
        'QUALITY',
        'SITE_OBS_CREATE',
        saved.id.toString(),
        dto.epsNodeId,
        { category: dto.category, severity: dto.severity },
      );
    }

    return this.decorateOneObservation(this.normalizePhotos(saved));
  }

  async rectify(id: string, dto: RectifySiteObservationDto, userId?: string) {
    const obs = await this.observationRepo.findOne({ where: { id } });
    if (!obs) throw new NotFoundException('Site observation not found');

    if (obs.status !== SiteObservationStatus.OPEN) {
      throw new BadRequestException('Observation is not OPEN');
    }

    obs.status = SiteObservationStatus.RECTIFIED;
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
    await this.ncrSyncService.markRectified(
      saved.ncrId,
      saved.rectificationText,
    );

    this.notifySiteObservationPermission(saved, 'QUALITY.SITE_OBS.CLOSE', {
      title: 'Quality Observation Rectified',
      body: 'Quality site observation rectification has been submitted.',
      type: 'QUALITY_SITE_OBS_RECTIFIED',
      directUserIds: [saved.raisedById],
      extraBody: 'Please review and close or reject.',
    }).catch(() => {
      /* non-fatal */
    });

    if (userId) {
      await this.auditService.log(
        parseInt(userId, 10),
        'QUALITY',
        'SITE_OBS_RECTIFY',
        saved.id.toString(),
        obs.epsNodeId,
        { rectifiedAt: obs.rectifiedAt },
      );
    }

    return this.decorateOneObservation(saved);
  }

  async rejectRectification(
    id: string,
    dto: RejectSiteObservationRectificationDto,
    userId?: string,
  ) {
    const obs = await this.observationRepo.findOne({ where: { id } });
    if (!obs) throw new NotFoundException('Site observation not found');

    if (obs.status !== SiteObservationStatus.RECTIFIED) {
      throw new BadRequestException(
        'Only rectified observations can be rejected back to open.',
      );
    }

    const rejectionRemarks = dto.rejectionRemarks?.trim();
    if (!rejectionRemarks) {
      throw new BadRequestException('Rejection remarks are required.');
    }
    obs.status = SiteObservationStatus.OPEN;
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
    await this.ncrSyncService.markOpen(saved.ncrId);

    this.notifySiteObservationPermission(saved, 'QUALITY.SITE_OBS.RECTIFY', {
      title: 'Quality Rectification Rejected',
      body: 'Quality site observation rectification was rejected.',
      type: 'QUALITY_SITE_OBS_RECTIFICATION_REJECTED',
      directUserIds: [saved.rectifiedById],
      extraBody: `Reason: ${rejectionRemarks}`,
    }).catch(() => {
      /* non-fatal */
    });

    if (userId) {
      await this.auditService.log(
        parseInt(userId, 10),
        'QUALITY',
        'SITE_OBS_REJECT_RECTIFICATION',
        saved.id.toString(),
        obs.epsNodeId,
        {
          rejectedAt: obs.rectificationRejectedAt,
          rejectionRemarks: obs.rectificationRejectedRemarks,
        },
      );
    }

    return this.decorateOneObservation(saved);
  }

  async hold(id: string, dto: HoldSiteObservationDto, userId?: string) {
    const obs = await this.observationRepo.findOne({ where: { id } });
    if (!obs) throw new NotFoundException('Site observation not found');

    if (obs.status === SiteObservationStatus.CLOSED) {
      throw new BadRequestException('Closed observations cannot be held.');
    }
    if (obs.status === SiteObservationStatus.HELD) {
      throw new BadRequestException('Observation is already held.');
    }

    obs.status = SiteObservationStatus.HELD;
    obs.holdReason = dto.holdReason?.trim() || null;
    obs.holdStartedAt = new Date();
    obs.heldById = userId || null;

    const saved = this.normalizePhotos(await this.observationRepo.save(obs));
    return this.decorateOneObservation(saved);
  }

  async unhold(id: string, userId?: string) {
    const obs = await this.observationRepo.findOne({ where: { id } });
    if (!obs) throw new NotFoundException('Site observation not found');

    if (obs.status !== SiteObservationStatus.HELD || !obs.holdStartedAt) {
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
    obs.status = SiteObservationStatus.OPEN;

    if (userId) {
      obs.rectificationRejectedById = userId;
    }

    const saved = this.normalizePhotos(await this.observationRepo.save(obs));
    return this.decorateOneObservation(saved);
  }

  async close(id: string, dto: CloseSiteObservationDto, userId?: string) {
    const obs = await this.observationRepo.findOne({ where: { id } });
    if (!obs) throw new NotFoundException('Site observation not found');

    if (obs.status === SiteObservationStatus.CLOSED) {
      throw new BadRequestException('Observation is already CLOSED');
    }

    if (
      obs.severity !== SiteObservationSeverity.INFO &&
      obs.status !== SiteObservationStatus.RECTIFIED
    ) {
      throw new BadRequestException(
        'Observation must be RECTIFIED before closing (unless INFO severity)',
      );
    }

    obs.status = SiteObservationStatus.CLOSED;
    if (dto.closureRemarks) {
      obs.closureRemarks = dto.closureRemarks;
    }
    if (userId) {
      obs.closedById = userId;
    }
    obs.closedAt = new Date();

    const saved = this.normalizePhotos(await this.observationRepo.save(obs));
    await this.ncrSyncService.markClosed(saved.ncrId);

    this.notifySiteObservationUsers(saved, {
      title: 'Quality Observation Closed',
      body: 'Quality site observation has been closed.',
      type: 'QUALITY_SITE_OBS_CLOSED',
      directUserIds: [saved.raisedById, saved.rectifiedById],
    }).catch(() => {
      /* non-fatal */
    });

    if (userId) {
      await this.auditService.log(
        parseInt(userId, 10),
        'QUALITY',
        'SITE_OBS_CLOSE',
        saved.id.toString(),
        obs.epsNodeId,
        { closedAt: obs.closedAt },
      );
    }

    return this.decorateOneObservation(saved);
  }

  async delete(id: string, userId?: string) {
    const obs = await this.observationRepo.findOne({ where: { id } });
    if (!obs) throw new NotFoundException('Site observation not found');

    await this.ncrSyncService.deleteLinkedNcr(obs.ncrId);
    await this.observationRepo.remove(obs);

    if (userId) {
      await this.auditService.log(
        parseInt(userId, 10),
        'QUALITY',
        'SITE_OBS_DELETE',
        obs.id.toString(),
        obs.epsNodeId,
        { description: obs.description },
      );
    }

    return { success: true };
  }
}
