import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, Between } from 'typeorm';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { DailyLaborPresence } from '../labor/entities/daily-labor-presence.entity';
import { BoqActivityPlan } from '../planning/entities/boq-activity-plan.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
    @InjectRepository(MeasurementProgress)
    private readonly progressRepo: Repository<MeasurementProgress>,
    @InjectRepository(DailyLaborPresence)
    private readonly laborRepo: Repository<DailyLaborPresence>,
    @InjectRepository(BoqActivityPlan)
    private readonly planRepo: Repository<BoqActivityPlan>,
  ) {}

  async getPortfolioSummary() {
    // Get all projects
    const projects = await this.epsRepo.find({
      where: { type: EpsNodeType.PROJECT },
      relations: ['projectProfile'],
    });

    const totalProjects = projects.length;

    // Get activities with schedule issues
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const delayedActivities = await this.activityRepo
      .createQueryBuilder('a')
      .where('a.finishDatePlanned < :today', { today })
      .andWhere('a.finishDateActual IS NULL')
      .andWhere('a.percentComplete < 100')
      .getCount();

    // This week's burn (from Progress)
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 7);

    const weekProgress = await this.progressRepo
      .createQueryBuilder('p')
      .leftJoin('p.measurementElement', 'me')
      .leftJoin('me.boqItem', 'boq')
      .where('p.date >= :weekStart', { weekStart })
      .select('COALESCE(SUM(p.executedQty * boq.rate), 0)', 'total')
      .getRawOne();

    // Today's manpower
    const todayLabor = await this.laborRepo
      .createQueryBuilder('l')
      .where('l.date = :today', { today: today.toISOString().split('T')[0] })
      .select('COALESCE(SUM(l.count), 0)', 'total')
      .getRawOne();

    return {
      totalProjects,
      activeProjects: totalProjects, // Can refine based on status
      delayedActivities,
      thisWeekBurn: Number(weekProgress?.total || 0),
      todayManpower: Number(todayLabor?.total || 0),
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.projectProfile?.projectStatus || 'ACTIVE',
      })),
    };
  }

  async getPortfolioBurnRate() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Last 30 days trend
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyBurn = await this.progressRepo
      .createQueryBuilder('p')
      .leftJoin('p.measurementElement', 'me')
      .leftJoin('me.boqItem', 'boq')
      .where('p.date >= :start', { start: thirtyDaysAgo })
      .select('p.date', 'date')
      .addSelect('SUM(p.executedQty * boq.rate)', 'value')
      .groupBy('p.date')
      .orderBy('p.date', 'ASC')
      .getRawMany();

    return {
      trends: dailyBurn.map((d) => ({
        date: d.date,
        value: Number(d.value || 0),
      })),
      total: dailyBurn.reduce((sum, d) => sum + Number(d.value || 0), 0),
    };
  }

  async getTodaysManpower() {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    const byCategory = await this.laborRepo
      .createQueryBuilder('l')
      .leftJoin('l.category', 'c')
      .where('l.date = :date', { date: dateStr })
      .select('c.name', 'category')
      .addSelect('SUM(l.count)', 'count')
      .groupBy('c.name')
      .getRawMany();

    const total = byCategory.reduce((sum, c) => sum + Number(c.count || 0), 0);

    return {
      total,
      byCategory: byCategory.map((c) => ({
        name: c.category || 'Uncategorized',
        count: Number(c.count || 0),
      })),
    };
  }

  async getUpcomingMilestones() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Get activities finishing in next 7 days
    const milestones = await this.activityRepo
      .createQueryBuilder('a')
      .leftJoin('a.wbsNode', 'w')
      .leftJoin('w.project', 'p')
      .where('a.finishDatePlanned BETWEEN :today AND :nextWeek', {
        today,
        nextWeek,
      })
      .andWhere('a.finishDateActual IS NULL')
      .select([
        'a.id as id',
        'a.activityName as name',
        'a.finishDatePlanned as dueDate',
        'p.name as projectName',
        'a.percentComplete as progress',
      ])
      .orderBy('a.finishDatePlanned', 'ASC')
      .limit(10)
      .getRawMany();

    return milestones;
  }

  async getAlerts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alerts: {
      type: string;
      message: string;
      severity: string;
      count?: number;
    }[] = [];

    // 1. Overdue activities
    const overdueCount = await this.activityRepo
      .createQueryBuilder('a')
      .where('a.finishDatePlanned < :today', { today })
      .andWhere('a.finishDateActual IS NULL')
      .andWhere('a.percentComplete < 100')
      .getCount();

    if (overdueCount > 0) {
      alerts.push({
        type: 'OVERDUE',
        message: `${overdueCount} activities are overdue`,
        severity: 'HIGH',
        count: overdueCount,
      });
    }

    // 2. Activities starting today with no progress
    const startingToday = await this.activityRepo
      .createQueryBuilder('a')
      .where('a.startDatePlanned = :today', { today })
      .andWhere('a.percentComplete = 0')
      .getCount();

    if (startingToday > 0) {
      alerts.push({
        type: 'STARTING_TODAY',
        message: `${startingToday} activities scheduled to start today`,
        severity: 'MEDIUM',
        count: startingToday,
      });
    }

    // 3. Low manpower warning (if significantly lower than average)
    const todayLabor = await this.laborRepo
      .createQueryBuilder('l')
      .where('l.date = :date', { date: today.toISOString().split('T')[0] })
      .select('COALESCE(SUM(l.count), 0)', 'total')
      .getRawOne();

    if (Number(todayLabor?.total || 0) === 0) {
      alerts.push({
        type: 'NO_MANPOWER',
        message: 'No manpower recorded for today',
        severity: 'LOW',
      });
    }

    return alerts;
  }
}
