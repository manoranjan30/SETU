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
  SiteObservationStatus,
  SiteObservationSeverity,
} from './entities/site-observation.entity';
import { QualityRatingConfig } from './entities/quality-rating-config.entity';
import { AuditService } from '../audit/audit.service';
import { PushNotificationService } from '../notifications/push-notification.service';
import { NotificationComposerService } from '../notifications/notification-composer.service';
import {
  CreateSiteObservationDto,
  RectifySiteObservationDto,
  CloseSiteObservationDto,
} from './dto/site-observation.dto';
import { toRelativePaths } from '../common/path.utils';

@Injectable()
export class SiteObservationService {
  private readonly logger = new Logger(SiteObservationService.name);

  constructor(
    @InjectRepository(SiteObservation)
    private readonly observationRepo: Repository<SiteObservation>,
    @InjectRepository(QualityRatingConfig)
    private readonly configRepo: Repository<QualityRatingConfig>,
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
    return rows.map((obs) => this.normalizePhotos(obs));
  }

  async getById(id: string) {
    const obs = await this.observationRepo.findOne({
      where: { id },
      relations: ['epsNode'],
    });
    if (!obs) throw new NotFoundException('Site observation not found');
    return this.normalizePhotos(obs);
  }

  /** Normalize photo arrays so old absolute URLs stored in the DB are
   *  converted to relative paths at read time. This retroactively fixes
   *  records saved before the write-time normalization was introduced. */
  private normalizePhotos(obs: SiteObservation): SiteObservation {
    obs.photos = toRelativePaths(obs.photos);
    obs.rectificationPhotos = toRelativePaths(obs.rectificationPhotos);
    return obs;
  }

  async create(dto: CreateSiteObservationDto, userId?: string) {
    const cleanedDto = { ...dto };
    if (cleanedDto.targetDate === '') {
      delete cleanedDto.targetDate;
    }

    const obs = this.observationRepo.create({
      ...cleanedDto,
      photos: toRelativePaths(cleanedDto.photos),
      status: SiteObservationStatus.OPEN,
      raisedById: userId,
    });

    const saved = await this.observationRepo.save(obs);

    if (
      dto.severity === SiteObservationSeverity.CRITICAL ||
      dto.severity === SiteObservationSeverity.MAJOR
    ) {
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

    return saved;
  }

  async rectify(id: string, dto: RectifySiteObservationDto, userId?: string) {
    const obs = await this.getById(id);

    if (obs.status !== SiteObservationStatus.OPEN) {
      throw new BadRequestException('Observation is not OPEN');
    }

    obs.status = SiteObservationStatus.RECTIFIED;
    obs.rectificationText = dto.rectificationText;
    if (dto.rectificationPhotos) {
      obs.rectificationPhotos = toRelativePaths(dto.rectificationPhotos);
    }
    if (userId) {
      obs.rectifiedById = userId;
    }
    obs.rectifiedAt = new Date();

    const saved = await this.observationRepo.save(obs);

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

    return saved;
  }

  async close(id: string, dto: CloseSiteObservationDto, userId?: string) {
    const obs = await this.getById(id);

    if (obs.status === SiteObservationStatus.CLOSED) {
      throw new BadRequestException('Observation is already CLOSED');
    }

    if (
      obs.severity !== SiteObservationSeverity.INFO &&
      obs.status === SiteObservationStatus.OPEN
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

    const saved = await this.observationRepo.save(obs);

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

    return saved;
  }

  async delete(id: string, userId?: string) {
    const obs = await this.getById(id);

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
