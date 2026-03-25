import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, IsNull, In } from 'typeorm';
import {
  MicroScheduleActivity,
  MicroActivityStatus,
} from './entities/micro-schedule-activity.entity';
import { MicroSchedule } from './entities/micro-schedule.entity';
import { CreateMicroActivityDto } from './dto/create-micro-activity.dto';
import { MicroLedgerService } from './micro-ledger.service';
import { MicroDailyLog } from './entities/micro-daily-log.entity';
import {
  ExecutionProgressEntry,
  ExecutionProgressEntryStatus,
} from '../execution/entities/execution-progress-entry.entity';
import { ExecutionProgressAdjustment } from '../execution/entities/execution-progress-adjustment.entity';

@Injectable()
export class MicroActivityService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(MicroScheduleActivity)
    private readonly activityRepo: Repository<MicroScheduleActivity>,
    @InjectRepository(MicroSchedule)
    private readonly microScheduleRepo: Repository<MicroSchedule>,
    @InjectRepository(MicroDailyLog)
    private readonly dailyLogRepo: Repository<MicroDailyLog>,
    @InjectRepository(ExecutionProgressEntry)
    private readonly executionEntryRepo: Repository<ExecutionProgressEntry>,
    @InjectRepository(ExecutionProgressAdjustment)
    private readonly executionAdjustmentRepo: Repository<ExecutionProgressAdjustment>,
    private readonly ledgerService: MicroLedgerService,
  ) {}

  /**
   * Create a new micro activity with quantity validation
   */
  async create(dto: CreateMicroActivityDto): Promise<MicroScheduleActivity> {
    // Validate micro schedule exists
    const microSchedule = await this.microScheduleRepo.findOne({
      where: { id: dto.microScheduleId, deletedAt: IsNull() },
      relations: ['parentActivity'],
    });

    if (!microSchedule) {
      throw new NotFoundException(
        `Micro schedule ${dto.microScheduleId} not found`,
      );
    }

    // Validate quantity allocation if WO item is linked
    if (dto.workOrderItemId) {
      const validation = await this.ledgerService.validateAllocation(
        dto.parentActivityId,
        dto.workOrderItemId,
        dto.allocatedQty,
      );

      if (!validation.allowed) {
        throw new BadRequestException(validation.message);
      }
    }

    // Validate dates are within micro schedule range
    const plannedStart = new Date(dto.plannedStart);
    const plannedFinish = new Date(dto.plannedFinish);
    const msStart = new Date(microSchedule.plannedStart);
    const msFinish = new Date(microSchedule.plannedFinish);

    if (plannedStart < msStart || plannedFinish > msFinish) {
      throw new BadRequestException(
        `Activity dates must be within micro schedule range (${msStart.toISOString().split('T')[0]} to ${msFinish.toISOString().split('T')[0]})`,
      );
    }

    if (plannedFinish <= plannedStart) {
      throw new BadRequestException(
        'Planned finish must be after planned start',
      );
    }

    // Create activity
    const activity = this.activityRepo.create({
      microScheduleId: dto.microScheduleId,
      parentActivityId: dto.parentActivityId,
      boqItemId: dto.boqItemId,
      workOrderItemId: dto.workOrderItemId,
      workOrderId: dto.workOrderId,
      vendorId: dto.vendorId, // Pass vendor if available
      epsNodeId: dto.epsNodeId,
      name: dto.name,
      description: dto.description,
      allocatedQty: dto.allocatedQty,
      uom: dto.uom,
      plannedStart,
      plannedFinish,
      status: dto.status || MicroActivityStatus.PLANNED,
    });

    const saved = await this.activityRepo.save(activity);

    // Update ledger
    if (dto.workOrderItemId) {
      await this.ledgerService.updateAllocatedQty(
        dto.parentActivityId,
        dto.workOrderItemId,
        dto.allocatedQty,
      );
    }

    return saved;
  }

  /**
   * Get activity by ID
   */
  async findOne(id: number): Promise<MicroScheduleActivity> {
    const activity = await this.activityRepo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: [
        'microSchedule',
        'parentActivity',
        'boqItem',
        'workOrderItem',
        'workOrder',
        'vendor',
        'epsNode',
        'dailyLogs',
      ],
    });

    if (!activity) {
      throw new NotFoundException(`Micro activity ${id} not found`);
    }

    return activity;
  }

  /**
   * Get all activities for a micro schedule
   */
  async findByMicroSchedule(
    microScheduleId: number,
  ): Promise<MicroScheduleActivity[]> {
    return await this.activityRepo.find({
      where: { microScheduleId, deletedAt: IsNull() },
      relations: ['epsNode', 'boqItem', 'workOrderItem', 'workOrder', 'vendor'],
      order: { plannedStart: 'ASC' },
    });
  }

  /**
   * Update activity
   */
  async update(
    id: number,
    updates: Partial<MicroScheduleActivity>,
  ): Promise<MicroScheduleActivity> {
    const activity = await this.findOne(id);

    // Prevent updates to completed activities
    if (activity.status === MicroActivityStatus.COMPLETED) {
      throw new BadRequestException('Cannot modify completed activity');
    }

    // Handle quantity changes
    if (updates.allocatedQty && activity.workOrderItemId) {
      const delta =
        Number(updates.allocatedQty) - Number(activity.allocatedQty);

      if (delta !== 0) {
        const validation = await this.ledgerService.validateAllocation(
          activity.parentActivityId,
          activity.workOrderItemId,
          delta,
        );

        if (!validation.allowed) {
          throw new BadRequestException(validation.message);
        }

        // Update ledger
        await this.ledgerService.updateAllocatedQty(
          activity.parentActivityId,
          activity.workOrderItemId,
          delta,
        );
      }

      activity.allocatedQty = updates.allocatedQty;
    }

    // Update other fields
    if (updates.name) activity.name = updates.name;
    if (updates.description !== undefined)
      activity.description = updates.description;
    if (updates.plannedStart)
      activity.plannedStart = new Date(updates.plannedStart as any);
    if (updates.plannedFinish)
      activity.plannedFinish = new Date(updates.plannedFinish as any);
    if (updates.status) activity.status = updates.status;

    return await this.activityRepo.save(activity);
  }

  /**
   * Calculate and update progress percentage
   */
  async updateProgress(id: number): Promise<void> {
    const activity = await this.activityRepo.findOne({
      where: { id },
      relations: ['dailyLogs'],
    });

    if (!activity) {
      throw new NotFoundException(`Activity ${id} not found`);
    }

    // Calculate total actual quantity from daily logs
    let totalActual = 0;
    if (activity.dailyLogs) {
      for (const log of activity.dailyLogs) {
        totalActual += Number(log.qtyDone || 0);
      }
    }

    // Calculate progress percentage
    const allocated = Number(activity.allocatedQty);
    if (allocated > 0) {
      activity.progressPercent = Math.min(100, (totalActual / allocated) * 100);
    }

    // Update status based on progress
    if (activity.progressPercent >= 100) {
      activity.status = MicroActivityStatus.COMPLETED;
      activity.actualFinish = new Date();
    } else if (activity.progressPercent > 0) {
      activity.status = MicroActivityStatus.IN_PROGRESS;
      if (!activity.actualStart) {
        activity.actualStart = new Date();
      }
    }

    await this.activityRepo.save(activity);
  }

  /**
   * Calculate forecast finish date based on productivity
   */
  async calculateForecast(id: number): Promise<Date | null> {
    const activity = await this.activityRepo.findOne({
      where: { id },
      relations: ['dailyLogs'],
    });

    if (!activity || !activity.dailyLogs || activity.dailyLogs.length === 0) {
      return null;
    }

    // Calculate total actual quantity and days worked
    let totalActual = 0;
    const uniqueDates = new Set<string>();

    for (const log of activity.dailyLogs) {
      totalActual += Number(log.qtyDone || 0);
      uniqueDates.add(new Date(log.logDate).toISOString().split('T')[0]);
    }

    const daysWorked = uniqueDates.size;
    if (daysWorked === 0) return null;

    // Calculate average daily productivity
    const avgDailyRate = totalActual / daysWorked;

    // Calculate remaining quantity
    const remaining = Number(activity.allocatedQty) - totalActual;

    if (remaining <= 0) {
      // Already complete
      return new Date();
    }

    // Calculate required days
    const requiredDays = Math.ceil(remaining / avgDailyRate);

    // Calculate forecast finish
    const today = new Date();
    const forecastFinish = new Date(today);
    forecastFinish.setDate(today.getDate() + requiredDays);

    // Update activity
    activity.forecastFinish = forecastFinish;

    // Calculate variance
    const plannedFinish = new Date(activity.plannedFinish);
    const diffTime = forecastFinish.getTime() - plannedFinish.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    activity.varianceDays = diffDays;

    // Update status if delayed
    if (diffDays > 0) {
      activity.status = MicroActivityStatus.DELAYED;
    }

    await this.activityRepo.save(activity);

    return forecastFinish;
  }

  /**
   * Soft delete activity
   */
  async delete(id: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const activity = await manager.findOne(MicroScheduleActivity, {
        where: { id, deletedAt: IsNull() },
      });

      if (!activity) {
        throw new NotFoundException(`Micro activity ${id} not found`);
      }

      const dailyLogCount = await manager.count(MicroDailyLog, {
        where: { microActivityId: id },
      });
      const approvedEntryCount = await manager.count(ExecutionProgressEntry, {
        where: {
          microActivityId: id,
          status: ExecutionProgressEntryStatus.APPROVED,
        },
      });

      // Prevent deletion only when real committed progress/logged execution exists.
      if (dailyLogCount > 0 || approvedEntryCount > 0) {
        throw new BadRequestException(
          'Cannot delete activity because approved or logged progress has already been recorded against it.',
        );
      }

      const pendingOrRejectedEntries = await manager.find(ExecutionProgressEntry, {
        where: { microActivityId: id },
        select: ['id'],
      });
      const pendingIds = pendingOrRejectedEntries.map((entry) => entry.id);
      if (pendingIds.length > 0) {
        await manager.delete(ExecutionProgressAdjustment, {
          executionProgressEntryId: In(pendingIds),
        });
        await manager.delete(ExecutionProgressEntry, { id: In(pendingIds) });
      }

      if (activity.workOrderItemId) {
        await this.ledgerService.updateAllocatedQty(
          activity.parentActivityId,
          activity.workOrderItemId,
          -Number(activity.allocatedQty),
        );
      }

      activity.status = MicroActivityStatus.PLANNED;
      activity.progressPercent = 0;
      activity.actualStart = null as any;
      activity.actualFinish = null as any;
      activity.forecastFinish = activity.plannedFinish;
      activity.deletedAt = new Date();
      await manager.save(MicroScheduleActivity, activity);
    });
  }
}
