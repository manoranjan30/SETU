import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual } from 'typeorm';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { MeasurementElement } from '../boq/entities/measurement-element.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { BoqActivityPlan } from '../planning/entities/boq-activity-plan.entity';
import { Activity } from '../wbs/entities/activity.entity';

@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);

  constructor(
    @InjectRepository(MeasurementProgress)
    private progressRepo: Repository<MeasurementProgress>,
    @InjectRepository(MeasurementElement)
    private elementRepo: Repository<MeasurementElement>,
    @InjectRepository(BoqActivityPlan)
    private planRepo: Repository<BoqActivityPlan>,
  ) {}

  // 1. Burn Rate Stats (Financials)
  async getBurnRateStats(projectId: number) {
    // Fetch all progress with rates
    const progress = await this.progressRepo.find({
      where: { measurementElement: { projectId } },
      relations: ['measurementElement', 'measurementElement.boqItem'],
      order: { date: 'DESC' },
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

    const dailyTrends: Record<string, number> = {};

    for (const p of progress) {
      const boqRate = Number(p.measurementElement.boqItem?.rate) || 0;
      const value = Number(p.executedQty) * boqRate;
      const pDate = new Date(p.date);
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
    // Find top burning BOQ items
    const topBurners = await this.elementRepo.find({
      where: { projectId },
      relations: ['boqItem'],
      order: { executedQty: 'DESC' },
      take: 5,
    });

    return {
      topBurners: topBurners.map((e) => ({
        name: e.boqItem?.description || e.elementName,
        value: Number(e.executedQty) * (Number(e.boqItem?.rate) || 0),
      })),
      alerts: [],
    };
  }
}
