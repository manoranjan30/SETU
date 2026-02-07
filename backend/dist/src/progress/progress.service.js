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
var ProgressService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const measurement_progress_entity_1 = require("../boq/entities/measurement-progress.entity");
const measurement_element_entity_1 = require("../boq/entities/measurement-element.entity");
const boq_activity_plan_entity_1 = require("../planning/entities/boq-activity-plan.entity");
let ProgressService = ProgressService_1 = class ProgressService {
    progressRepo;
    elementRepo;
    planRepo;
    logger = new common_1.Logger(ProgressService_1.name);
    constructor(progressRepo, elementRepo, planRepo) {
        this.progressRepo = progressRepo;
        this.elementRepo = elementRepo;
        this.planRepo = planRepo;
    }
    async getBurnRateStats(projectId) {
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
        const dailyTrends = {};
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
    async getPlanVsAchieved(projectId) {
        return {
            planned: 0,
            achieved: 0,
            variance: 0,
            status: 'On Track',
        };
    }
    async getEfficiencyInsights(projectId) {
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
};
exports.ProgressService = ProgressService;
exports.ProgressService = ProgressService = ProgressService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(measurement_progress_entity_1.MeasurementProgress)),
    __param(1, (0, typeorm_1.InjectRepository)(measurement_element_entity_1.MeasurementElement)),
    __param(2, (0, typeorm_1.InjectRepository)(boq_activity_plan_entity_1.BoqActivityPlan)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ProgressService);
//# sourceMappingURL=progress.service.js.map