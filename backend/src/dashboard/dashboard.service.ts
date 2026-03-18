import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, Between } from 'typeorm';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { DailyLaborPresence } from '../labor/entities/daily-labor-presence.entity';
import { WoActivityPlan } from '../planning/entities/wo-activity-plan.entity';
import { SiteObservation, SiteObservationSeverity, SiteObservationStatus } from '../quality/entities/site-observation.entity';
import { EhsIncident, IncidentType } from '../ehs/entities/ehs-incident.entity';
import { EhsManhours } from '../ehs/entities/ehs-manhours.entity';

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
    @InjectRepository(WoActivityPlan)
    private readonly planRepo: Repository<WoActivityPlan>,
    @InjectRepository(SiteObservation)
    private readonly obsRepo: Repository<SiteObservation>,
    @InjectRepository(EhsIncident)
    private readonly incidentRepo: Repository<EhsIncident>,
    @InjectRepository(EhsManhours)
    private readonly manhoursRepo: Repository<EhsManhours>,
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
      .leftJoin('me.boqSubItem', 'sub')
      .where('p.date >= :weekStart', { weekStart })
      .andWhere('COALESCE(sub.rate, 0) > 0')
      .select('COALESCE(SUM(p.executedQty * sub.rate), 0)', 'total')
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
      .leftJoin('me.boqSubItem', 'sub')
      .where('p.date >= :start', { start: thirtyDaysAgo })
      .andWhere('COALESCE(sub.rate, 0) > 0')
      .select('p.date', 'date')
      .addSelect('SUM(p.executedQty * sub.rate)', 'value')
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

  async getQualityMetrics() {
    const today = new Date();
    
    const openObservations = await this.obsRepo.count({
      where: { status: SiteObservationStatus.OPEN },
    });

    const pendingApprovals = await this.obsRepo.count({
      where: { status: SiteObservationStatus.RECTIFIED },
    });

    const criticalNCRs = await this.obsRepo.count({
      where: {
        status: SiteObservationStatus.OPEN,
        severity: SiteObservationSeverity.CRITICAL,
      },
    });

    // Closed this week
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 7);
    const closedThisWeek = await this.obsRepo.count({
      where: {
        status: SiteObservationStatus.CLOSED,
        closedAt: MoreThanOrEqual(weekStart),
      },
    });

    // NCR Aging Distribution for openly active ones
    const now = new Date();
    const allOpen = await this.obsRepo.find({
      where: { status: SiteObservationStatus.OPEN },
      select: ['createdAt'],
    });

    let under7Days = 0;
    let under14Days = 0;
    let over14Days = 0;

    allOpen.forEach((obs) => {
      const daysDiff = Math.floor(
        (now.getTime() - new Date(obs.createdAt).getTime()) / (1000 * 3600 * 24)
      );
      if (daysDiff < 7) {
        under7Days++;
      } else if (daysDiff <= 14) {
        under14Days++;
      } else {
        over14Days++;
      }
    });

    return {
      openObservations,
      closedThisWeek,
      criticalNCRs,
      pendingApprovals,
      ncrAging: [
        { name: '< 7 Days', count: under7Days },
        { name: '7-14 Days', count: under14Days },
        { name: '> 14 Days', count: over14Days },
      ],
    };
  }

  async getEhsMetrics() {
    const totalManhoursRes = await this.manhoursRepo
      .createQueryBuilder('m')
      .select('SUM(m.safeManhours)', 'totalSafe')
      .getRawOne();
      
    const rawSafeManhours = Number(totalManhoursRes?.totalSafe || 0);
    // Format large numbers (like 124,500)
    const safeManHoursStr = rawSafeManhours > 1000 
      ? rawSafeManhours.toLocaleString('en-US') 
      : String(rawSafeManhours);

    // Incidents this quarter
    const quarterStart = new Date();
    quarterStart.setMonth(Math.floor(quarterStart.getMonth() / 3) * 3, 1);
    quarterStart.setHours(0, 0, 0, 0);

    const ltiCount = await this.incidentRepo.count({
      where: { 
        incidentType: IncidentType.LTI,
        createdAt: MoreThanOrEqual(quarterStart)
      },
    });

    const mtcCount = await this.incidentRepo.count({
      where: { 
        incidentType: IncidentType.MTC,
        createdAt: MoreThanOrEqual(quarterStart)
      },
    });

    const nearMissCount = await this.incidentRepo.count({
      where: { 
        incidentType: IncidentType.NEAR_MISS,
        createdAt: MoreThanOrEqual(quarterStart)
      },
    });

    return {
      safeManHours: safeManHoursStr,
      lti: ltiCount,
      nearMisses: nearMissCount,
      medicalTreated: mtcCount,
      complianceRate: 98 // Hardcoded mapping for PTW as a placeholder till audits feature
    };
  }
}
