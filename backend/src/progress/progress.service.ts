import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ExecutionProgressEntry,
  ExecutionProgressEntryStatus,
} from '../execution/entities/execution-progress-entry.entity';
import { WorkOrderItem } from '../workdoc/entities/work-order-item.entity';
import { BoqSubItem } from '../boq/entities/boq-sub-item.entity';

@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);

  constructor(
    @InjectRepository(ExecutionProgressEntry)
    private progressRepo: Repository<ExecutionProgressEntry>,
    @InjectRepository(WorkOrderItem)
    private workOrderItemRepo: Repository<WorkOrderItem>,
    @InjectRepository(BoqSubItem)
    private subItemRepo: Repository<BoqSubItem>,
  ) {}

  // 1. Burn Rate Stats (Financials)
  async getBurnRateStats(projectId: number) {
    const progress = await this.progressRepo.find({
      where: { projectId, status: ExecutionProgressEntryStatus.APPROVED },
      relations: ['workOrderItem', 'workOrderItem.boqSubItem'],
      order: { entryDate: 'DESC' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    let dailyBurn = 0;
    let weeklyBurn = 0;
    let monthlyBurn = 0;
    let totalBurn = 0;
    let skippedEntries = 0;

    const dailyTrends: Record<string, number> = {};

    for (const p of progress) {
      const rate =
        Number(p.workOrderItem?.rate || 0) ||
        Number(p.workOrderItem?.boqSubItem?.rate || 0);

      if (rate <= 0) {
        skippedEntries += 1;
        this.logger.warn(
          `Skipping progress log ${p.id} in burn stats because no rate is available.`,
        );
        continue;
      }

      const value = Number(p.enteredQty) * rate;
      const pDate = new Date(p.entryDate);
      pDate.setHours(0, 0, 0, 0);

      totalBurn += value;

      if (pDate.getTime() === today.getTime()) {
        dailyBurn += value;
      }

      if (pDate >= weekAgo) {
        weeklyBurn += value;
      }

      if (pDate >= monthStart) {
        monthlyBurn += value;
      }

      // For Trend Chart (last 30 days)
      const dateStr = pDate.toISOString().split('T')[0];
      dailyTrends[dateStr] = (dailyTrends[dateStr] || 0) + value;
    }

    return {
      today: dailyBurn,
      thisWeek: weeklyBurn,
      thisMonth: monthlyBurn,
      total: totalBurn,
      trends: dailyTrends,
      skippedEntries,
    };
  }

  // 2. Plan vs Achieved (Schedule Variance)
  async getPlanVsAchieved(projectId: number) {
    // Need to link Activities -> BOQ Items -> Executed Qty
    // This is complex, simplified version for MVP:

    // A. Get Planned Value from Schedule (Activities in range)
    // B. Get Earned Value from Progress (Activities in range)

    return {
      planned: 0, // Placeholder for MVP
      achieved: 0,
      variance: 0,
      status: 'On Track',
    };
  }

  // 3. Efficiency Insights
  async getEfficiencyInsights(projectId: number) {
    const topBurnersRaw = await this.progressRepo
      .createQueryBuilder('entry')
      .innerJoin('entry.workOrderItem', 'woItem')
      .leftJoin('woItem.boqItem', 'boqItem')
      .leftJoin('woItem.boqSubItem', 'boqSubItem')
      .select('woItem.boqItemId', 'boqItemId')
      .addSelect('COALESCE(boqItem.description, woItem.description)', 'name')
      .addSelect(
        'COALESCE(SUM(entry.enteredQty * COALESCE(NULLIF(woItem.rate, 0), boqSubItem.rate, 0)), 0)',
        'value',
      )
      .where('entry.projectId = :projectId', { projectId })
      .andWhere('entry.status = :status', {
        status: ExecutionProgressEntryStatus.APPROVED,
      })
      .groupBy('woItem.boqItemId')
      .addGroupBy('boqItem.description')
      .addGroupBy('woItem.description')
      .orderBy('"value"', 'DESC')
      .limit(5)
      .getRawMany();

    return {
      topBurners: topBurnersRaw.map((row) => ({
        name: row.name,
        value: Number(row.value || 0),
      })),
      alerts: [],
    };
  }
}
