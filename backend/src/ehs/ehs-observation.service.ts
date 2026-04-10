import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EhsObservation,
  EhsObservationStatus,
  EhsObservationSeverity,
} from './entities/ehs-observation.entity';
import { EhsProjectConfig } from './entities/ehs-project-config.entity';
import { AuditService } from '../audit/audit.service';
import { PushNotificationService } from '../notifications/push-notification.service';
import { NotificationComposerService } from '../notifications/notification-composer.service';
import {
  CreateEhsObservationDto,
  RectifyEhsObservationDto,
  CloseEhsObservationDto,
} from './dto/ehs-observation.dto';
import { toRelativePaths } from '../common/path.utils';

@Injectable()
export class EhsObservationService {
  private readonly logger = new Logger(EhsObservationService.name);

  constructor(
    @InjectRepository(EhsObservation)
    private readonly observationRepo: Repository<EhsObservation>,
    @InjectRepository(EhsProjectConfig)
    private readonly configRepo: Repository<EhsProjectConfig>,
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
    if (!obs) throw new NotFoundException('EHS observation not found');
    return this.normalizePhotos(obs);
  }

  /** Normalize photo arrays so old absolute URLs stored in the DB are
   *  converted to relative paths at read time. This retroactively fixes
   *  records saved before the write-time normalization was introduced. */
  private normalizePhotos(obs: EhsObservation): EhsObservation {
    obs.photos = toRelativePaths(obs.photos);
    obs.rectificationPhotos = toRelativePaths(obs.rectificationPhotos);
    return obs;
  }

  async create(dto: CreateEhsObservationDto, userId?: string) {
    const cleanedDto = { ...dto };
    if (cleanedDto.targetDate === '') {
      delete cleanedDto.targetDate;
    }

    const obs = this.observationRepo.create({
      ...cleanedDto,
      photos: toRelativePaths(cleanedDto.photos),
      status: EhsObservationStatus.OPEN,
      raisedById: userId,
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
          'EHS.OBSERVATION.CLOSE',
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

    return saved;
  }

  async rectify(id: string, dto: RectifyEhsObservationDto, userId?: string) {
    const obs = await this.getById(id);

    if (obs.status !== EhsObservationStatus.OPEN) {
      throw new BadRequestException('Observation is not OPEN');
    }

    obs.status = EhsObservationStatus.RECTIFIED;
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
          moduleLabel: 'EHS',
          projectId: obs.projectId,
          epsNodeId: obs.epsNodeId,
          severity: obs.severity,
          category: obs.category,
          subjectLabel: obs.category || 'EHS observation',
          statusLabel: 'EHS Observation Rectified',
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
        'EHS',
        'SITE_OBS_RECTIFY',
        saved.id.toString(),
        obs.epsNodeId,
        { rectifiedAt: obs.rectifiedAt },
      );
    }

    return saved;
  }

  async close(id: string, dto: CloseEhsObservationDto, userId?: string) {
    const obs = await this.getById(id);

    if (obs.status === EhsObservationStatus.CLOSED) {
      throw new BadRequestException('Observation is already CLOSED');
    }

    if (
      obs.severity !== EhsObservationSeverity.INFO &&
      obs.status === EhsObservationStatus.OPEN
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

    const saved = await this.observationRepo.save(obs);

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
        'EHS',
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
