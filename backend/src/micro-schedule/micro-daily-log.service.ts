import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { MicroDailyLog } from './entities/micro-daily-log.entity';
import { MicroScheduleActivity } from './entities/micro-schedule-activity.entity';
import { CreateDailyLogDto } from './dto/create-daily-log.dto';
import { MicroActivityService } from './micro-activity.service';
import { MicroLedgerService } from './micro-ledger.service';

@Injectable()
export class MicroDailyLogService {
  constructor(
    @InjectRepository(MicroDailyLog)
    private readonly logRepo: Repository<MicroDailyLog>,
    @InjectRepository(MicroScheduleActivity)
    private readonly activityRepo: Repository<MicroScheduleActivity>,
    private readonly activityService: MicroActivityService,
    private readonly ledgerService: MicroLedgerService,
  ) {}

  /**
   * Create a new daily log entry
   */
  async create(dto: CreateDailyLogDto, userId: number): Promise<MicroDailyLog> {
    // Validate activity exists
    const activity = await this.activityRepo.findOne({
      where: { id: dto.microActivityId },
      relations: ['microSchedule', 'boqItem', 'workOrderItem'],
    });

    if (!activity) {
      throw new NotFoundException(
        `Micro activity ${dto.microActivityId} not found`,
      );
    }

    // Validate log date is within activity range
    const logDate = new Date(dto.logDate);
    const activityStart = new Date(activity.plannedStart);
    const activityFinish = new Date(activity.plannedFinish);

    if (logDate < activityStart || logDate > activityFinish) {
      throw new BadRequestException(
        `Log date must be within activity range (${activityStart.toISOString().split('T')[0]} to ${activityFinish.toISOString().split('T')[0]})`,
      );
    }

    // Check for duplicate log on same date
    const existing = await this.logRepo.findOne({
      where: {
        microActivityId: dto.microActivityId,
        logDate,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Log already exists for ${dto.logDate}. Use update instead.`,
      );
    }

    // Validate quantity doesn't exceed allocated
    const totalLogged = await this.getTotalLoggedQty(dto.microActivityId);
    const newTotal = totalLogged + dto.qtyDone;

    if (newTotal > Number(activity.allocatedQty)) {
      throw new BadRequestException(
        `Total logged quantity (${newTotal}) exceeds allocated quantity (${activity.allocatedQty})`,
      );
    }

    // Create log
    const log = this.logRepo.create({
      microActivityId: dto.microActivityId,
      logDate,
      qtyDone: dto.qtyDone,
      manpowerCount: dto.manpowerCount || 0,
      equipmentHours: dto.equipmentHours || 0,
      delayReasonId: dto.delayReasonId,
      remarks: dto.remarks,
      createdBy: userId,
    });

    const saved = await this.logRepo.save(log);

    // Trigger updates
    await this.afterLogCreated(activity, dto.qtyDone);

    return saved;
  }

  /**
   * Post-creation updates
   */
  private async afterLogCreated(
    activity: MicroScheduleActivity,
    qtyDone: number,
  ): Promise<void> {
    // 1. Update activity progress
    await this.activityService.updateProgress(activity.id);

    // 2. Calculate forecast
    await this.activityService.calculateForecast(activity.id);

    // 3. Update ledger consumed quantity
    if (activity.workOrderItemId) {
      await this.ledgerService.updateConsumedQty(
        activity.parentActivityId,
        activity.workOrderItemId,
        qtyDone,
      );
    }

    // 4. Update micro schedule totals
    // This will be handled by MicroScheduleService.recalculateTotals()
  }

  /**
   * Get total logged quantity for an activity
   */
  async getTotalLoggedQty(microActivityId: number): Promise<number> {
    const result = await this.logRepo
      .createQueryBuilder('log')
      .select('SUM(log.qtyDone)', 'total')
      .where('log.microActivityId = :id', { id: microActivityId })
      .getRawOne();

    return Number(result?.total || 0);
  }

  /**
   * Get log by ID
   */
  async findOne(id: number): Promise<MicroDailyLog> {
    const log = await this.logRepo.findOne({
      where: { id },
      relations: ['microActivity', 'delayReason', 'creator'],
    });

    if (!log) {
      throw new NotFoundException(`Daily log ${id} not found`);
    }

    return log;
  }

  /**
   * Get all logs for an activity
   */
  async findByActivity(microActivityId: number): Promise<MicroDailyLog[]> {
    return await this.logRepo.find({
      where: { microActivityId },
      relations: ['delayReason', 'creator'],
      order: { logDate: 'ASC' },
    });
  }

  /**
   * Get logs for a date range
   */
  async findByDateRange(
    microActivityId: number,
    startDate: string,
    endDate: string,
  ): Promise<MicroDailyLog[]> {
    return await this.logRepo.find({
      where: {
        microActivityId,
        logDate: Between(new Date(startDate), new Date(endDate)),
      },
      relations: ['delayReason', 'creator'],
      order: { logDate: 'ASC' },
    });
  }

  /**
   * Get today's logs for a micro schedule
   */
  async getTodayLogs(microScheduleId: number): Promise<MicroDailyLog[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await this.logRepo
      .createQueryBuilder('log')
      .innerJoin('log.microActivity', 'activity')
      .where('activity.microScheduleId = :microScheduleId', { microScheduleId })
      .andWhere('log.logDate >= :today', { today })
      .andWhere('log.logDate < :tomorrow', { tomorrow })
      .leftJoinAndSelect('log.microActivity', 'ma')
      .leftJoinAndSelect('log.delayReason', 'dr')
      .leftJoinAndSelect('log.creator', 'user')
      .orderBy('log.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Update log
   */
  async update(
    id: number,
    updates: Partial<MicroDailyLog>,
  ): Promise<MicroDailyLog> {
    const log = await this.findOne(id);

    // Handle quantity changes
    if (updates.qtyDone !== undefined) {
      const activity = await this.activityRepo.findOne({
        where: { id: log.microActivityId },
      });

      if (!activity) {
        throw new NotFoundException('Activity not found');
      }

      const totalLogged = await this.getTotalLoggedQty(log.microActivityId);
      const currentLogQty = Number(log.qtyDone);
      const newLogQty = Number(updates.qtyDone);
      const delta = newLogQty - currentLogQty;
      const newTotal = totalLogged + delta;

      if (newTotal > Number(activity.allocatedQty)) {
        throw new BadRequestException(
          `Total logged quantity (${newTotal}) exceeds allocated quantity (${activity.allocatedQty})`,
        );
      }

      log.qtyDone = updates.qtyDone;

      // Update ledger
      if (activity.workOrderItemId && delta !== 0) {
        await this.ledgerService.updateConsumedQty(
          activity.parentActivityId,
          activity.workOrderItemId,
          delta,
        );
      }

      // Recalculate progress
      await this.activityService.updateProgress(activity.id);
      await this.activityService.calculateForecast(activity.id);
    }

    // Update other fields
    if (updates.manpowerCount !== undefined)
      log.manpowerCount = updates.manpowerCount;
    if (updates.equipmentHours !== undefined)
      log.equipmentHours = updates.equipmentHours;
    if (updates.delayReasonId !== undefined)
      log.delayReasonId = updates.delayReasonId;
    if (updates.remarks !== undefined) log.remarks = updates.remarks;

    return await this.logRepo.save(log);
  }

  /**
   * Delete log
   */
  async delete(id: number): Promise<void> {
    const log = await this.findOne(id);
    const activity = await this.activityRepo.findOne({
      where: { id: log.microActivityId },
      relations: ['boqItem', 'workOrderItem'],
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    // Update ledger (return consumed quantity)
    if (activity.workOrderItemId) {
      await this.ledgerService.updateConsumedQty(
        activity.parentActivityId,
        activity.workOrderItemId,
        -Number(log.qtyDone),
      );
    }

    // Delete log
    await this.logRepo.remove(log);

    // Recalculate progress
    await this.activityService.updateProgress(activity.id);
    await this.activityService.calculateForecast(activity.id);
  }

  /**
   * Get productivity statistics for an activity
   */
  async getProductivityStats(microActivityId: number): Promise<{
    avgDailyRate: number;
    totalDaysWorked: number;
    totalQtyDone: number;
    avgManpower: number;
    avgEquipmentHours: number;
  }> {
    const logs = await this.findByActivity(microActivityId);

    if (logs.length === 0) {
      return {
        avgDailyRate: 0,
        totalDaysWorked: 0,
        totalQtyDone: 0,
        avgManpower: 0,
        avgEquipmentHours: 0,
      };
    }

    let totalQty = 0;
    let totalManpower = 0;
    let totalEquipmentHours = 0;

    for (const log of logs) {
      totalQty += Number(log.qtyDone);
      totalManpower += log.manpowerCount;
      totalEquipmentHours += Number(log.equipmentHours);
    }

    return {
      avgDailyRate: totalQty / logs.length,
      totalDaysWorked: logs.length,
      totalQtyDone: totalQty,
      avgManpower: totalManpower / logs.length,
      avgEquipmentHours: totalEquipmentHours / logs.length,
    };
  }
}
