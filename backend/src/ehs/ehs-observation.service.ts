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
import {
  CreateEhsObservationDto,
  RectifyEhsObservationDto,
  CloseEhsObservationDto,
} from './dto/ehs-observation.dto';

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

    return query.orderBy('obs.createdAt', 'DESC').getMany();
  }

  async getById(id: string) {
    const obs = await this.observationRepo.findOne({
      where: { id },
      relations: ['epsNode'],
    });
    if (!obs) throw new NotFoundException('EHS observation not found');
    return obs;
  }

  async create(dto: CreateEhsObservationDto, userId?: string) {
    // Clean up empty strings for date fields to prevent DB errors
    const cleanedDto = { ...dto };
    if (cleanedDto.targetDate === '') {
      delete cleanedDto.targetDate;
    }

    const obs = this.observationRepo.create({
      ...cleanedDto,
      status: EhsObservationStatus.OPEN,
      raisedById: userId,
    });

    const saved = await this.observationRepo.save(obs);

    // Alert EHS supervisors for safety-critical observations (project-scoped)
    if (
      dto.severity === EhsObservationSeverity.CRITICAL ||
      dto.severity === EhsObservationSeverity.MAJOR
    ) {
      this.pushService
        .sendToProjectPermission(
          dto.projectId,
          'EHS.OBSERVATION.CLOSE',
          `${dto.severity} EHS Observation Raised`,
          `A ${dto.severity.toLowerCase()} EHS observation has been raised${dto.category ? ` — ${dto.category}` : ''}. Immediate attention required.`,
          {
            type: 'EHS_OBS_CRITICAL',
            observationId: String(saved.id),
            projectId: String(dto.projectId),
            severity: dto.severity,
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
      obs.rectificationPhotos = dto.rectificationPhotos;
    }
    if (userId) {
      obs.rectifiedById = userId;
    }
    obs.rectifiedAt = new Date();

    const saved = await this.observationRepo.save(obs);

    // Notify the raiser that the observation has been rectified
    if (obs.raisedById) {
      this.pushService
        .sendToUsers(
          [parseInt(obs.raisedById, 10)],
          'EHS Observation Rectified',
          `Your EHS observation has been rectified. Please review and close.`,
          { type: 'EHS_OBS_RECTIFIED', observationId: String(saved.id) },
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

    // INFO severity can be closed directly from OPEN
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

    // Notify the raiser that the observation has been closed
    if (obs.raisedById) {
      this.pushService
        .sendToUsers(
          [parseInt(obs.raisedById, 10)],
          'EHS Observation Closed',
          `Your EHS observation has been closed.`,
          { type: 'EHS_OBS_CLOSED', observationId: String(saved.id) },
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
