"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const eps_entity_1 = require("../eps/eps.entity");
const activity_entity_1 = require("../wbs/entities/activity.entity");
const measurement_progress_entity_1 = require("../boq/entities/measurement-progress.entity");
const daily_labor_presence_entity_1 = require("../labor/entities/daily-labor-presence.entity");
const boq_activity_plan_entity_1 = require("../planning/entities/boq-activity-plan.entity");
let DashboardService = class DashboardService {
    epsRepo;
    activityRepo;
    progressRepo;
    laborRepo;
    planRepo;
    constructor(epsRepo, activityRepo, progressRepo, laborRepo, planRepo) {
        this.epsRepo = epsRepo;
        this.activityRepo = activityRepo;
        this.progressRepo = progressRepo;
        this.laborRepo = laborRepo;
        this.planRepo = planRepo;
    }
    async getPortfolioSummary() {
        const projects = await this.epsRepo.find({
            where: { type: eps_entity_1.EpsNodeType.PROJECT },
            relations: ['projectProfile'],
        });
        const totalProjects = projects.length;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const delayedActivities = await this.activityRepo
            .createQueryBuilder('a')
            .where('a.finishDatePlanned < :today', { today })
            .andWhere('a.finishDateActual IS NULL')
            .andWhere('a.percentComplete < 100')
            .getCount();
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - 7);
        const weekProgress = await this.progressRepo
            .createQueryBuilder('p')
            .leftJoin('p.measurementElement', 'me')
            .leftJoin('me.boqItem', 'boq')
            .where('p.date >= :weekStart', { weekStart })
            .select('COALESCE(SUM(p.executedQty * boq.rate), 0)', 'total')
            .getRawOne();
        const todayLabor = await this.laborRepo
            .createQueryBuilder('l')
            .where('l.date = :today', { today: today.toISOString().split('T')[0] })
            .select('COALESCE(SUM(l.count), 0)', 'total')
            .getRawOne();
        return {
            totalProjects,
            activeProjects: totalProjects,
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
        const alerts = [];
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
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(eps_entity_1.EpsNode)),
    __param(1, (0, typeorm_1.InjectRepository)(activity_entity_1.Activity)),
    __param(2, (0, typeorm_1.InjectRepository)(measurement_progress_entity_1.MeasurementProgress)),
    __param(3, (0, typeorm_1.InjectRepository)(daily_labor_presence_entity_1.DailyLaborPresence)),
    __param(4, (0, typeorm_1.InjectRepository)(boq_activity_plan_entity_1.BoqActivityPlan)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map