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
exports.PlanningController = void 0;
const common_1 = require("@nestjs/common");
const planning_service_1 = require("./planning.service");
const boq_activity_plan_entity_1 = require("./entities/boq-activity-plan.entity");
const schedule_version_service_1 = require("./schedule-version.service");
const import_export_service_1 = require("./import-export.service");
const look_ahead_dto_1 = require("./dto/look-ahead.dto");
const platform_express_1 = require("@nestjs/platform-express");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const project_context_guard_1 = require("../projects/guards/project-context.guard");
const project_assignment_guard_1 = require("../projects/guards/project-assignment.guard");
const permissions_guard_1 = require("../auth/permissions.guard");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const auditable_decorator_1 = require("../audit/auditable.decorator");
let PlanningController = class PlanningController {
    planningService;
    versionService;
    importService;
    constructor(planningService, versionService, importService) {
        this.planningService = planningService;
        this.versionService = versionService;
        this.importService = importService;
    }
    async getMatrix(projectId) {
        return this.planningService.getProjectPlanningMatrix(parseInt(projectId));
    }
    async getMapperBoq(projectId) {
        return this.planningService.getUnmappedBoqItems(parseInt(projectId));
    }
    async getStats(projectId) {
        return this.planningService.getPlanningStats(projectId);
    }
    async getUnlinkedActivities(projectId) {
        return this.planningService.getUnlinkedActivities(projectId);
    }
    async getGapAnalysis(projectId) {
        return this.planningService.getGapAnalysis(projectId);
    }
    async getExecutionReadyActivities(projectId, wbsNodeId) {
        return this.planningService.findActivitiesWithBoq(projectId, wbsNodeId ? parseInt(wbsNodeId) : undefined);
    }
    async distributeBoq(boqItemId, activityId, quantity, basis, boqSubItemId, measurementId) {
        return this.planningService.distributeBoqToActivity(boqItemId, activityId, quantity, basis, undefined, undefined, boqSubItemId, measurementId);
    }
    async unlinkBoq(boqItemId, boqSubItemId, measurementId) {
        return this.planningService.unlinkBoq(boqItemId, boqSubItemId, measurementId);
    }
    async getRecoveryPlans(projectId) {
        return this.planningService.getRecoveryPlans(projectId);
    }
    async createRecoveryPlan(body) {
        return this.planningService.createRecoveryPlan(body);
    }
    async recordProgress(body) {
        return this.planningService.recordProgress(body);
    }
    async completeActivity(activityId) {
        return this.planningService.completeActivity(activityId);
    }
    async distributeSchedule(body, req) {
        return this.planningService.distributeActivitiesToEps(body.activityIds, body.targetEpsIds, req.user);
    }
    undistributeSchedule(body, req) {
        return this.planningService.undistributeActivities(body.activityIds, body.targetEpsIds, req.user);
    }
    async repairLinks() {
        return this.planningService.repairDistributedActivitiesV6();
    }
    async debugProject(projectId) {
        return this.planningService.debugProjectActivities(+projectId);
    }
    async getDistributionMatrix(projectId) {
        return this.planningService.getDistributionMatrix(+projectId);
    }
    async getRelationships(projectId) {
        return this.planningService.getProjectRelationships(+projectId);
    }
    async debugActivityByName(name) {
        return this.planningService.findActivityByName(name);
    }
    async searchEps(name) {
        return this.planningService.searchEps(name);
    }
    createVersion(projectId, body) {
        return this.versionService.createVersion(+projectId, body.code, body.type, body.sourceVersionId);
    }
    getVersions(projectId) {
        return this.versionService.getVersions(+projectId);
    }
    getVersionActivities(versionId) {
        return this.versionService.getVersionActivities(+versionId);
    }
    deleteVersion(projectId, versionId) {
        return this.versionService.deleteVersion(projectId, versionId);
    }
    updateVersionActivity(versionId, activityId, body) {
        return this.versionService.updateActivityDate(+versionId, +activityId, body.startDate, body.finishDate, body.actualStart, body.actualFinish);
    }
    async compareVersions(v1, v2) {
        return this.versionService.compareVersions(+v1, +v2);
    }
    async recalculateSchedule(versionId) {
        return this.versionService.recalculateSchedule(+versionId);
    }
    async exportVersion(versionId, res) {
        const activities = await this.versionService.getVersionActivities(+versionId);
        let relationships = [];
        const projectId = activities[0]?.activity?.projectId;
        if (projectId) {
            relationships =
                await this.planningService.getProjectRelationships(projectId);
        }
        const buffer = this.importService.generateRevisionTemplate(activities, relationships);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="Schedule_R${versionId}.xlsx"`,
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }
    async importRevision(projectId, file, body) {
        const updates = this.importService.parseRevisionFile(file.buffer);
        return this.versionService.createRevisionWithUpdates(+projectId, +body.sourceVersionId, updates, body.code || 'Rev');
    }
    async getLookAhead(body) {
        return this.planningService.getLookAheadResources(body.projectId, body.startDate, body.endDate);
    }
};
exports.PlanningController = PlanningController;
__decorate([
    (0, common_1.Get)(':projectId/matrix'),
    (0, permissions_decorator_1.Permissions)('PLANNING.MATRIX.READ'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "getMatrix", null);
__decorate([
    (0, common_1.Get)('mapper/boq/:projectId'),
    (0, permissions_decorator_1.Permissions)('PLANNING.MATRIX.READ'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "getMapperBoq", null);
__decorate([
    (0, common_1.Get)(':projectId/stats'),
    (0, permissions_decorator_1.Permissions)('PLANNING.MATRIX.READ'),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)(':projectId/unlinked-activities'),
    (0, permissions_decorator_1.Permissions)('PLANNING.MATRIX.READ'),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "getUnlinkedActivities", null);
__decorate([
    (0, common_1.Get)(':projectId/gap-analysis'),
    (0, permissions_decorator_1.Permissions)('PLANNING.ANALYSIS.READ'),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "getGapAnalysis", null);
__decorate([
    (0, common_1.Get)(':projectId/execution-ready'),
    (0, permissions_decorator_1.Permissions)('PLANNING.MATRIX.READ'),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('wbsNodeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "getExecutionReadyActivities", null);
__decorate([
    (0, common_1.Post)('distribute'),
    (0, permissions_decorator_1.Permissions)('PLANNING.MATRIX.UPDATE'),
    __param(0, (0, common_1.Body)('boqItemId')),
    __param(1, (0, common_1.Body)('activityId')),
    __param(2, (0, common_1.Body)('quantity')),
    __param(3, (0, common_1.Body)('basis')),
    __param(4, (0, common_1.Body)('boqSubItemId')),
    __param(5, (0, common_1.Body)('measurementId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Number, String, Number, Number]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "distributeBoq", null);
__decorate([
    (0, common_1.Post)('unlink'),
    (0, permissions_decorator_1.Permissions)('PLANNING.MATRIX.UPDATE'),
    __param(0, (0, common_1.Body)('boqItemId')),
    __param(1, (0, common_1.Body)('boqSubItemId')),
    __param(2, (0, common_1.Body)('measurementId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Number]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "unlinkBoq", null);
__decorate([
    (0, common_1.Get)(':projectId/recovery'),
    (0, permissions_decorator_1.Permissions)('PLANNING.ANALYSIS.READ'),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "getRecoveryPlans", null);
__decorate([
    (0, common_1.Post)('recovery'),
    (0, permissions_decorator_1.Permissions)('PLANNING.RECOVERY.MANAGE'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "createRecoveryPlan", null);
__decorate([
    (0, common_1.Post)('measurements'),
    (0, permissions_decorator_1.Permissions)('EXECUTION.ENTRY.CREATE'),
    (0, auditable_decorator_1.Auditable)('PROGRESS', 'RECORD_PROGRESS'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "recordProgress", null);
__decorate([
    (0, common_1.Post)('activities/:activityId/complete'),
    (0, permissions_decorator_1.Permissions)('EXECUTION.ENTRY.UPDATE'),
    (0, auditable_decorator_1.Auditable)('SCHEDULE', 'COMPLETE_ACTIVITY', 'activityId'),
    __param(0, (0, common_1.Param)('activityId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "completeActivity", null);
__decorate([
    (0, common_1.Post)('distribute-schedule'),
    (0, permissions_decorator_1.Permissions)('PLANNING.MATRIX.UPDATE'),
    (0, auditable_decorator_1.Auditable)('SCHEDULE', 'DISTRIBUTE_ACTIVITIES'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "distributeSchedule", null);
__decorate([
    (0, common_1.Post)('undistribute'),
    (0, permissions_decorator_1.Permissions)('PLANNING.MATRIX.UPDATE'),
    (0, auditable_decorator_1.Auditable)('SCHEDULE', 'UNDISTRIBUTE_ACTIVITIES'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PlanningController.prototype, "undistributeSchedule", null);
__decorate([
    (0, common_1.Get)('activities/repair-links'),
    (0, permissions_decorator_1.Permissions)('ADMIN.SETTINGS.MANAGE'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "repairLinks", null);
__decorate([
    (0, common_1.Get)('debug/:projectId'),
    (0, permissions_decorator_1.Permissions)('ADMIN.SETTINGS.MANAGE'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "debugProject", null);
__decorate([
    (0, common_1.Get)(':projectId/distribution-matrix'),
    (0, permissions_decorator_1.Permissions)('PLANNING.MATRIX.READ'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "getDistributionMatrix", null);
__decorate([
    (0, common_1.Get)(':projectId/relationships'),
    (0, permissions_decorator_1.Permissions)('PLANNING.MATRIX.READ'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "getRelationships", null);
__decorate([
    (0, common_1.Get)('debug/activity/:name'),
    __param(0, (0, common_1.Param)('name')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "debugActivityByName", null);
__decorate([
    (0, common_1.Get)('debug/search-eps/:name'),
    __param(0, (0, common_1.Param)('name')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "searchEps", null);
__decorate([
    (0, common_1.Post)(':projectId/versions'),
    (0, permissions_decorator_1.Permissions)('SCHEDULE.VERSION.CREATE'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PlanningController.prototype, "createVersion", null);
__decorate([
    (0, common_1.Get)(':projectId/versions'),
    (0, permissions_decorator_1.Permissions)('SCHEDULE.VERSION.READ'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PlanningController.prototype, "getVersions", null);
__decorate([
    (0, common_1.Get)('versions/:versionId/activities'),
    (0, permissions_decorator_1.Permissions)('SCHEDULE.VERSION.READ'),
    __param(0, (0, common_1.Param)('versionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PlanningController.prototype, "getVersionActivities", null);
__decorate([
    (0, common_1.Delete)(':projectId/versions/:versionId'),
    (0, permissions_decorator_1.Permissions)('SCHEDULE.VERSION.DELETE'),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('versionId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", void 0)
], PlanningController.prototype, "deleteVersion", null);
__decorate([
    (0, common_1.Patch)('versions/:versionId/activities/:activityId'),
    (0, permissions_decorator_1.Permissions)('SCHEDULE.VERSION.UPDATE'),
    __param(0, (0, common_1.Param)('versionId')),
    __param(1, (0, common_1.Param)('activityId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], PlanningController.prototype, "updateVersionActivity", null);
__decorate([
    (0, common_1.Get)('versions/compare'),
    (0, permissions_decorator_1.Permissions)('SCHEDULE.VERSION.READ'),
    __param(0, (0, common_1.Query)('v1')),
    __param(1, (0, common_1.Query)('v2')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "compareVersions", null);
__decorate([
    (0, common_1.Post)('versions/:versionId/recalculate'),
    (0, permissions_decorator_1.Permissions)('SCHEDULE.VERSION.UPDATE'),
    __param(0, (0, common_1.Param)('versionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "recalculateSchedule", null);
__decorate([
    (0, common_1.Get)('versions/:versionId/export'),
    (0, permissions_decorator_1.Permissions)('SCHEDULE.VERSION.READ'),
    __param(0, (0, common_1.Param)('versionId')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "exportVersion", null);
__decorate([
    (0, common_1.Post)(':projectId/versions/import-revision'),
    (0, permissions_decorator_1.Permissions)('SCHEDULE.VERSION.CREATE'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "importRevision", null);
__decorate([
    (0, common_1.Post)('look-ahead'),
    (0, permissions_decorator_1.Permissions)('PLANNING.LOOKAHEAD.CREATE'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [look_ahead_dto_1.LookAheadDto]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "getLookAhead", null);
exports.PlanningController = PlanningController = __decorate([
    (0, common_1.Controller)('planning'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, project_context_guard_1.ProjectContextGuard, project_assignment_guard_1.ProjectAssignmentGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [planning_service_1.PlanningService,
        schedule_version_service_1.ScheduleVersionService,
        import_export_service_1.ImportExportService])
], PlanningController);
//# sourceMappingURL=planning.controller.js.map