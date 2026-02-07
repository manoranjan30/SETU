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
var LaborService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LaborService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const labor_category_entity_1 = require("./entities/labor-category.entity");
const daily_labor_presence_entity_1 = require("./entities/daily-labor-presence.entity");
const activity_labor_update_entity_1 = require("./entities/activity-labor-update.entity");
const labor_excel_mapping_entity_1 = require("./entities/labor-excel-mapping.entity");
let LaborService = LaborService_1 = class LaborService {
    categoryRepo;
    presenceRepo;
    activityLaborRepo;
    mappingRepo;
    logger = new common_1.Logger(LaborService_1.name);
    constructor(categoryRepo, presenceRepo, activityLaborRepo, mappingRepo) {
        this.categoryRepo = categoryRepo;
        this.presenceRepo = presenceRepo;
        this.activityLaborRepo = activityLaborRepo;
        this.mappingRepo = mappingRepo;
    }
    async getCategories(projectId) {
        return this.categoryRepo.find({
            where: [
                { projectId: projectId },
                { projectId: (0, typeorm_2.IsNull)() },
            ],
            order: { categoryGroup: 'ASC', name: 'ASC' },
        });
    }
    async saveCategories(categories) {
        return this.categoryRepo.save(categories);
    }
    async getDailyPresence(projectId, date) {
        const where = { projectId };
        if (date)
            where.date = date;
        return this.presenceRepo.find({
            where,
            relations: ['category'],
            order: { date: 'DESC' },
        });
    }
    async saveDailyPresence(projectId, entries, userId) {
        try {
            const userIdStr = userId?.toString() || 'unknown';
            const toSave = entries.map((e) => ({
                ...e,
                projectId,
                updatedBy: userIdStr,
            }));
            return await this.presenceRepo.save(toSave);
        }
        catch (error) {
            this.logger.error(`Failed to save daily presence for project ${projectId}: ${error.message}`, error.stack);
            throw error;
        }
    }
    async getActivityLabor(activityId) {
        return this.activityLaborRepo.find({
            where: { activityId },
            relations: ['category', 'activity'],
            order: { date: 'DESC' },
        });
    }
    async saveActivityLabor(entries, userId) {
        try {
            const userIdStr = userId?.toString() || 'unknown';
            const toSave = entries.map((e) => ({
                ...e,
                updatedBy: userIdStr,
            }));
            return await this.activityLaborRepo.save(toSave);
        }
        catch (error) {
            this.logger.error(`Failed to save activity labor: ${error.message}`, error.stack);
            throw error;
        }
    }
    async getAllocationsByProject(projectId, date) {
        const query = this.activityLaborRepo
            .createQueryBuilder('alu')
            .leftJoinAndSelect('alu.category', 'category')
            .leftJoinAndSelect('alu.activity', 'activity')
            .innerJoin('activity.wbsNode', 'wbs')
            .where('wbs.projectId = :projectId', { projectId });
        if (date) {
            query.andWhere('alu.date = :date', { date });
        }
        return query.orderBy('alu.date', 'DESC').getMany();
    }
    async getMappings(projectId) {
        return this.mappingRepo.find({ where: { projectId } });
    }
    async saveMapping(mapping) {
        return this.mappingRepo.save(mapping);
    }
    async importLaborData(projectId, data, mappingId, userId) {
        try {
            const mapping = await this.mappingRepo.findOne({
                where: { id: mappingId },
            });
            const colMap = mapping?.columnMappings || {};
            const userIdStr = userId?.toString() || 'unknown';
            const results = [];
            for (const row of data) {
                const date = row.date || row.Date;
                if (!date)
                    continue;
                for (const [colName, categoryId] of Object.entries(colMap)) {
                    const count = parseFloat(row[colName]);
                    if (isNaN(count) || count === 0)
                        continue;
                    results.push({
                        projectId,
                        date,
                        categoryId: Number(categoryId),
                        count,
                        updatedBy: userIdStr,
                        remarks: 'Imported from Excel',
                    });
                }
            }
            if (results.length === 0)
                return [];
            return await this.presenceRepo.save(results);
        }
        catch (error) {
            this.logger.error(`Failed to import labor data for project ${projectId}: ${error.message}`, error.stack);
            throw error;
        }
    }
};
exports.LaborService = LaborService;
exports.LaborService = LaborService = LaborService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(labor_category_entity_1.LaborCategory)),
    __param(1, (0, typeorm_1.InjectRepository)(daily_labor_presence_entity_1.DailyLaborPresence)),
    __param(2, (0, typeorm_1.InjectRepository)(activity_labor_update_entity_1.ActivityLaborUpdate)),
    __param(3, (0, typeorm_1.InjectRepository)(labor_excel_mapping_entity_1.LaborExcelMapping)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], LaborService);
//# sourceMappingURL=labor.service.js.map