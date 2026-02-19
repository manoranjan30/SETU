import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import {
  MicroSchedule,
  MicroScheduleStatus,
} from './entities/micro-schedule.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { DelayReason } from './entities/delay-reason.entity';
import { CreateMicroScheduleDto } from './dto/create-micro-schedule.dto';
import {
  MicroScheduleActivity,
  MicroActivityStatus,
} from './entities/micro-schedule-activity.entity';
import { In } from 'typeorm';

@Injectable()
export class MicroScheduleService {
  constructor(
    @InjectRepository(MicroSchedule)
    private readonly microScheduleRepo: Repository<MicroSchedule>,
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
    @InjectRepository(DelayReason)
    private readonly delayReasonRepo: Repository<DelayReason>,
    @InjectRepository(MicroScheduleActivity)
    private readonly microActivityRepo: Repository<MicroScheduleActivity>,
  ) {}

  /**
   * Get all active delay reasons
   */
  async findAllDelayReasons(): Promise<DelayReason[]> {
    return await this.delayReasonRepo.find({
      where: { isActive: true },
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Create a new micro schedule
   */
  async create(
    dto: CreateMicroScheduleDto,
    userId: number,
  ): Promise<MicroSchedule> {
    // Validate parent activity exists
    // Validate parent activity exists if provided
    if (dto.parentActivityId) {
      const parentActivity = await this.activityRepo.findOne({
        where: { id: dto.parentActivityId },
      });

      if (!parentActivity) {
        throw new NotFoundException(
          `Parent activity ${dto.parentActivityId} not found`,
        );
      }
    }

    // Validate dates
    const baselineStart = new Date(dto.baselineStart);
    const baselineFinish = new Date(dto.baselineFinish);
    const plannedStart = new Date(dto.plannedStart);
    const plannedFinish = new Date(dto.plannedFinish);

    if (baselineFinish <= baselineStart) {
      throw new BadRequestException(
        'Baseline finish must be after baseline start',
      );
    }

    if (plannedFinish <= plannedStart) {
      throw new BadRequestException(
        'Planned finish must be after planned start',
      );
    }

    // Create micro schedule
    const microSchedule = this.microScheduleRepo.create({
      projectId: dto.projectId,
      parentActivityId: dto.parentActivityId || null,
      name: dto.name,
      description: dto.description,
      baselineStart,
      baselineFinish,
      plannedStart,
      plannedFinish,
      status: dto.status || MicroScheduleStatus.DRAFT,
      createdBy: userId,
    });

    const saved = await this.microScheduleRepo.save(microSchedule);

    // Note: Removed auto-creation of activities from linkedActivityIds
    // Users will manually create micro activities as needed
    // This prevents unwanted dummy activities that need to be deleted

    return saved;
  }

  /**
   * Get micro schedule by ID
   */
  async findOne(id: number): Promise<MicroSchedule> {
    const microSchedule = await this.microScheduleRepo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: [
        'parentActivity',
        'parentActivity.masterActivity',
        'parentActivity.wbsNode',
        'parentActivity.wbsNode.parent',
        'creator',
        'approver',
        'activities',
        'activities.epsNode',
        'activities.boqItem',
      ],
    });

    if (!microSchedule) {
      throw new NotFoundException(`Micro schedule ${id} not found`);
    }

    return microSchedule;
  }

  /**
   * Get all micro schedules for a project
   */
  async findByProject(projectId: number): Promise<MicroSchedule[]> {
    return await this.microScheduleRepo.find({
      where: { projectId, deletedAt: IsNull() },
      relations: ['parentActivity', 'creator'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all micro schedules for a parent activity
   */
  async findByParentActivity(
    parentActivityId: number,
  ): Promise<MicroSchedule[]> {
    return await this.microScheduleRepo.find({
      where: { parentActivityId, deletedAt: IsNull() },
      relations: ['creator', 'activities'],
      order: { version: 'DESC' },
    });
  }

  /**
   * Update micro schedule
   */
  async update(
    id: number,
    updates: Partial<MicroSchedule>,
    userId: number,
  ): Promise<MicroSchedule> {
    const microSchedule = await this.findOne(id);

    // Prevent updates to approved schedules (except status changes)
    if (
      microSchedule.status === MicroScheduleStatus.APPROVED &&
      updates.status !== MicroScheduleStatus.ACTIVE &&
      updates.status !== MicroScheduleStatus.SUSPENDED
    ) {
      throw new ForbiddenException(
        'Cannot modify approved micro schedule. Create a new version instead.',
      );
    }

    // Update allowed fields
    if (updates.name) microSchedule.name = updates.name;
    if (updates.description !== undefined)
      microSchedule.description = updates.description;
    if (updates.plannedStart)
      microSchedule.plannedStart = new Date(updates.plannedStart as any);
    if (updates.plannedFinish)
      microSchedule.plannedFinish = new Date(updates.plannedFinish as any);
    if (updates.status) microSchedule.status = updates.status;

    return await this.microScheduleRepo.save(microSchedule);
  }

  /**
   * Approve micro schedule
   */
  async approve(id: number, userId: number): Promise<MicroSchedule> {
    const microSchedule = await this.findOne(id);

    if (microSchedule.status !== MicroScheduleStatus.SUBMITTED) {
      throw new BadRequestException(
        'Only submitted micro schedules can be approved',
      );
    }

    microSchedule.status = MicroScheduleStatus.APPROVED;
    microSchedule.approvedBy = userId;
    microSchedule.approvedAt = new Date();

    return await this.microScheduleRepo.save(microSchedule);
  }

  /**
   * Submit micro schedule for approval
   */
  async submit(id: number): Promise<MicroSchedule> {
    const microSchedule = await this.findOne(id);

    if (microSchedule.status !== MicroScheduleStatus.DRAFT) {
      throw new BadRequestException('Only draft schedules can be submitted');
    }

    // Validate has activities
    if (!microSchedule.activities || microSchedule.activities.length === 0) {
      throw new BadRequestException(
        'Cannot submit micro schedule without activities',
      );
    }

    microSchedule.status = MicroScheduleStatus.SUBMITTED;
    return await this.microScheduleRepo.save(microSchedule);
  }

  /**
   * Activate micro schedule (start execution)
   */
  async activate(id: number): Promise<MicroSchedule> {
    const microSchedule = await this.findOne(id);

    if (microSchedule.status !== MicroScheduleStatus.APPROVED) {
      throw new BadRequestException('Only approved schedules can be activated');
    }

    microSchedule.status = MicroScheduleStatus.ACTIVE;
    return await this.microScheduleRepo.save(microSchedule);
  }

  /**
   * Complete micro schedule
   */
  async complete(id: number): Promise<MicroSchedule> {
    const microSchedule = await this.findOne(id);

    if (microSchedule.status !== MicroScheduleStatus.ACTIVE) {
      throw new BadRequestException('Only active schedules can be completed');
    }

    microSchedule.status = MicroScheduleStatus.COMPLETED;
    microSchedule.actualFinish = new Date();

    return await this.microScheduleRepo.save(microSchedule);
  }

  /**
   * Soft delete micro schedule
   */
  async delete(id: number): Promise<void> {
    const microSchedule = await this.findOne(id);

    // Prevent deletion of active schedules
    if (microSchedule.status === MicroScheduleStatus.ACTIVE) {
      throw new ForbiddenException('Cannot delete active micro schedule');
    }

    microSchedule.deletedAt = new Date();
    await this.microScheduleRepo.save(microSchedule);
  }

  /**
   * Update overshoot flag based on forecast
   */
  async updateOvershootFlag(id: number): Promise<void> {
    const microSchedule = await this.findOne(id);

    if (
      !microSchedule.forecastFinish ||
      !microSchedule.parentActivity ||
      !microSchedule.parentActivity.finishDatePlanned
    ) {
      return;
    }

    const forecastDate = new Date(microSchedule.forecastFinish);
    const parentFinishDate = new Date(
      microSchedule.parentActivity.finishDatePlanned,
    );

    if (forecastDate > parentFinishDate) {
      const diffTime = Math.abs(
        forecastDate.getTime() - parentFinishDate.getTime(),
      );
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      microSchedule.overshootFlag = true;
      microSchedule.overshootDays = diffDays;
    } else {
      microSchedule.overshootFlag = false;
      microSchedule.overshootDays = 0;
    }

    await this.microScheduleRepo.save(microSchedule);
  }

  /**
   * Recalculate totals (allocated and actual quantities)
   */
  async recalculateTotals(id: number): Promise<void> {
    const microSchedule = await this.microScheduleRepo.findOne({
      where: { id },
      relations: ['activities', 'activities.dailyLogs'],
    });

    if (!microSchedule) {
      throw new NotFoundException(`Micro schedule ${id} not found`);
    }

    // Calculate total allocated quantity
    let totalAllocated = 0;
    let totalActual = 0;

    if (microSchedule.activities) {
      for (const activity of microSchedule.activities) {
        totalAllocated += Number(activity.allocatedQty || 0);

        // Sum daily logs for actual quantity
        if (activity.dailyLogs) {
          for (const log of activity.dailyLogs) {
            totalActual += Number(log.qtyDone || 0);
          }
        }
      }
    }

    microSchedule.totalAllocatedQty = totalAllocated;
    microSchedule.totalActualQty = totalActual;

    await this.microScheduleRepo.save(microSchedule);
  }
}
