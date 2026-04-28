import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async getAll(projectId: number, status?: string, severity?: string) {
    const query = this.observationRepo
      .createQueryBuilder('obs')
      .leftJoinAndSelect('obs.epsNode', 'epsNode')
      .where('obs.projectId = :projectId', { projectId });

    if (status) query.andWhere('obs.status = :status', { status });
    if (severity) query.andWhere('obs.severity = :severity', { severity });

    const rows = await query.orderBy('obs.createdAt', 'DESC').getMany();
    return rows.map((obs) => this.decorateObservation(this.normalizePhotos(obs)));
  }

  async getById(id: string) {
    const obs = await this.observationRepo.findOne({
      where: { id },
      relations: ['epsNode'],
    });
    if (!obs) throw new NotFoundException('Site observation not found');
    return this.decorateObservation(this.normalizePhotos(obs));
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

  private calculateAgeingMinutes(obs: SiteObservation) {
    const endTime =
      obs.rectifiedAt
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

    const obs = this.observationRepo.create({
      ...cleanedDto,
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
          'QUALITY.OBSERVATION.RESOLVE',
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

    return this.decorateObservation(this.normalizePhotos(saved));
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

    if (obs.raisedById) {
      const notification =
        await this.notificationComposer.composeObservationUpdate({
          moduleLabel: 'Quality',
          projectId: obs.projectId,
          epsNodeId: obs.epsNodeId,
          severity: obs.severity,
          category: obs.category,
          subjectLabel: obs.category || 'Site observation',
          statusLabel: 'Quality Observation Rectified',
          notificationType: 'OBS_RECTIFIED',
        });

      this.pushService
        .sendToUsers(
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
        'QUALITY',
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

    obs.status = SiteObservationStatus.OPEN;
    obs.rectificationRejectedRemarks = dto.rejectionRemarks?.trim() || null;
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
          moduleLabel: 'Quality',
          projectId: obs.projectId,
          epsNodeId: obs.epsNodeId,
          severity: obs.severity,
          category: obs.category,
          subjectLabel: obs.category || 'Site observation',
          statusLabel: 'Quality Rectification Rejected',
          notificationType: 'OBS_RECTIFICATION_REJECTED',
        });

      this.pushService
        .sendToUsers(
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

    return this.decorateObservation(saved);
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
    return this.decorateObservation(saved);
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
    return this.decorateObservation(saved);
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

    if (obs.raisedById) {
      const notification =
        await this.notificationComposer.composeObservationUpdate({
          moduleLabel: 'Quality',
          projectId: obs.projectId,
          epsNodeId: obs.epsNodeId,
          severity: obs.severity,
          category: obs.category,
          subjectLabel: obs.category || 'Site observation',
          statusLabel: 'Quality Observation Closed',
          notificationType: 'OBS_CLOSED',
        });

      this.pushService
        .sendToUsers(
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
        'QUALITY',
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
    if (!obs) throw new NotFoundException('Site observation not found');

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
