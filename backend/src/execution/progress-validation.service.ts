import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, IsNull } from 'typeorm';
import { MeasurementElement } from '../boq/entities/measurement-element.entity';
import { MicroScheduleActivity } from '../micro-schedule/entities/micro-schedule-activity.entity';
import { MicroQuantityLedger } from '../micro-schedule/entities/micro-quantity-ledger.entity';
import { MicroDailyLog } from '../micro-schedule/entities/micro-daily-log.entity';
import { CreateProgressDto } from './dto/create-progress.dto';

/**
 * Service for validating and enforcing quantity constraints
 * when logging progress (micro or direct)
 */
@Injectable()
export class ProgressValidationService {
  private readonly logger = new Logger(ProgressValidationService.name);

  constructor(
    private dataSource: DataSource,
    @InjectRepository(MicroScheduleActivity)
    private readonly microActivityRepo: Repository<MicroScheduleActivity>,
    @InjectRepository(MicroQuantityLedger)
    private readonly ledgerRepo: Repository<MicroQuantityLedger>,
    @InjectRepository(MicroDailyLog)
    private readonly dailyLogRepo: Repository<MicroDailyLog>,
    @InjectRepository(MeasurementElement)
    private readonly measurementRepo: Repository<MeasurementElement>,
  ) {}

  /**
   * Validate if progress logging is allowed
   * Enforces: Sum(Progress) <= Allocated Quantity
   */
  async validateProgress(dto: CreateProgressDto): Promise<void> {
    if (dto.microActivityId) {
      // Validate against Micro Activity allocation
      await this.validateMicroActivityProgress(dto);
    } else {
      // Validate against Balance (Direct Execution)
      await this.validateDirectProgress(dto);
    }
  }

  private async validateMicroActivityProgress(
    dto: CreateProgressDto,
  ): Promise<void> {
    const activity = await this.microActivityRepo.findOne({
      where: { id: dto.microActivityId },
    });

    if (!activity) {
      throw new BadRequestException(
        `Micro Activity ${dto.microActivityId} not found`,
      );
    }

    // Sum existing daily logs
    const dailyLogs = await this.dailyLogRepo.find({
      where: { microActivityId: dto.microActivityId },
    });

    const executedQty = dailyLogs.reduce(
      (sum, log) => sum + Number(log.qtyDone || 0),
      0,
    );

    const newTotal = executedQty + Number(dto.quantity);

    if (newTotal > Number(activity.allocatedQty)) {
      throw new BadRequestException(
        `Exceeds micro activity scope. ` +
          `Allocated: ${activity.allocatedQty}, ` +
          `Already Executed: ${executedQty}, ` +
          `Requested: ${dto.quantity}, ` +
          `Available: ${Number(activity.allocatedQty) - executedQty}`,
      );
    }

    this.logger.log(
      `[ValidateMicro] Activity ${dto.microActivityId}: ` +
        `${newTotal}/${activity.allocatedQty} OK`,
    );
  }

  private async validateDirectProgress(dto: CreateProgressDto): Promise<void> {
    // Get ledger for this activity-BOQ combination
    const ledger = await this.ledgerRepo.findOne({
      where: {
        parentActivityId: dto.activityId,
        boqItemId: dto.boqItemId,
      },
    });

    if (!ledger) {
      throw new BadRequestException(
        `No ledger found for Activity ${dto.activityId} and BOQ ${dto.boqItemId}`,
      );
    }

    // Sum existing direct execution progress (measurements not linked to micro)
    const measurements = await this.measurementRepo.find({
      where: {
        activityId: dto.activityId,
        boqItemId: dto.boqItemId,
        epsNodeId: dto.epsNodeId,
        microActivityId: IsNull(),
      },
    });

    const directExecuted = measurements.reduce(
      (sum, me) => sum + Number(me.executedQty || 0),
      0,
    );

    const newTotal = directExecuted + Number(dto.quantity);
    const balanceQty = Number(ledger.balanceQty);

    if (newTotal > balanceQty) {
      throw new BadRequestException(
        `Exceeds direct execution quota. ` +
          `Balance Available: ${balanceQty}, ` +
          `Already Executed: ${directExecuted}, ` +
          `Requested: ${dto.quantity}, ` +
          `Available: ${balanceQty - directExecuted}`,
      );
    }

    this.logger.log(
      `[ValidateDirect] Activity ${dto.activityId} BOQ ${dto.boqItemId}: ` +
        `${newTotal}/${balanceQty} OK`,
    );
  }
}
