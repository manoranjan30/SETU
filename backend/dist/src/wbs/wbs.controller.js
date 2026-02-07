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
exports.WbsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const wbs_service_1 = require("./wbs.service");
const wbs_import_service_1 = require("./wbs-import.service");
const wbs_dto_1 = require("./dto/wbs.dto");
const activity_dto_1 = require("./dto/activity.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const project_context_guard_1 = require("../projects/guards/project-context.guard");
const project_assignment_guard_1 = require("../projects/guards/project-assignment.guard");
const permissions_guard_1 = require("../auth/permissions.guard");
const permissions_decorator_1 = require("../auth/permissions.decorator");
let WbsController = class WbsController {
    wbsService;
    importService;
    constructor(wbsService, importService) {
        this.wbsService = wbsService;
        this.importService = importService;
    }
    create(projectId, dto, req) {
        return this.wbsService.create(+projectId, dto, req.user.username);
    }
    findAll(projectId) {
        return this.wbsService.findAll(+projectId);
    }
    getAllActivities(projectId) {
        return this.wbsService.getAllActivities(+projectId);
    }
    findOne(projectId, id) {
        return this.wbsService.findOne(+projectId, +id);
    }
    update(projectId, id, dto) {
        return this.wbsService.update(+projectId, +id, dto);
    }
    reorder(projectId, id, dto) {
        return this.wbsService.reorder(+projectId, +id, dto);
    }
    remove(projectId, id) {
        return this.wbsService.delete(+projectId, +id);
    }
    createActivity(projectId, nodeId, dto, req) {
        return this.wbsService.createActivity(+projectId, +nodeId, dto, req.user.username);
    }
    getActivities(projectId, nodeId) {
        return this.wbsService.getActivities(+projectId, +nodeId);
    }
    updateActivity(activityId, dto) {
        return this.wbsService.updateActivity(+activityId, dto);
    }
    deleteActivity(activityId) {
        return this.wbsService.deleteActivity(+activityId);
    }
    applyTemplate(projectId, templateId, req) {
        return this.wbsService.applyTemplate(+projectId, +templateId, req.user.username);
    }
    saveAsTemplate(projectId, body) {
        return this.wbsService.saveAsTemplate(+projectId, body.templateName, body.description);
    }
    async previewImport(file) {
        if (!file)
            throw new common_1.BadRequestException('File is required');
        const data = await this.importService.parseAndPreview(file.buffer);
        const validation = this.importService.validateHierarchy(data);
        return { data, validation };
    }
    async commitImport(projectId, body, req) {
        return this.wbsService.bulkCreate(+projectId, body.data, req.user.username);
    }
};
exports.WbsController = WbsController;
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.Permissions)('WBS.NODE.CREATE'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, wbs_dto_1.CreateWbsDto, Object]),
    __metadata("design:returntype", void 0)
], WbsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.Permissions)('WBS.NODE.READ'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WbsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('activities'),
    (0, permissions_decorator_1.Permissions)('WBS.ACTIVITY.READ'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WbsController.prototype, "getAllActivities", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, permissions_decorator_1.Permissions)('WBS.NODE.READ'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], WbsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, permissions_decorator_1.Permissions)('WBS.NODE.UPDATE'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, wbs_dto_1.UpdateWbsDto]),
    __metadata("design:returntype", void 0)
], WbsController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/reorder'),
    (0, permissions_decorator_1.Permissions)('WBS.NODE.UPDATE'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, wbs_dto_1.ReorderWbsDto]),
    __metadata("design:returntype", void 0)
], WbsController.prototype, "reorder", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, permissions_decorator_1.Permissions)('WBS.NODE.DELETE'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], WbsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':nodeId/activities'),
    (0, permissions_decorator_1.Permissions)('WBS.ACTIVITY.CREATE'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Param)('nodeId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, activity_dto_1.CreateActivityDto, Object]),
    __metadata("design:returntype", void 0)
], WbsController.prototype, "createActivity", null);
__decorate([
    (0, common_1.Get)(':nodeId/activities'),
    (0, permissions_decorator_1.Permissions)('WBS.ACTIVITY.READ'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Param)('nodeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], WbsController.prototype, "getActivities", null);
__decorate([
    (0, common_1.Patch)('activities/:activityId'),
    (0, permissions_decorator_1.Permissions)('WBS.ACTIVITY.UPDATE'),
    __param(0, (0, common_1.Param)('activityId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, activity_dto_1.UpdateActivityDto]),
    __metadata("design:returntype", void 0)
], WbsController.prototype, "updateActivity", null);
__decorate([
    (0, common_1.Delete)('activities/:activityId'),
    (0, permissions_decorator_1.Permissions)('WBS.ACTIVITY.DELETE'),
    __param(0, (0, common_1.Param)('activityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WbsController.prototype, "deleteActivity", null);
__decorate([
    (0, common_1.Post)('templates/:templateId/apply'),
    (0, permissions_decorator_1.Permissions)('WBS.TEMPLATE.APPLY'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Param)('templateId')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], WbsController.prototype, "applyTemplate", null);
__decorate([
    (0, common_1.Post)('save-as-template'),
    (0, permissions_decorator_1.Permissions)('WBS.TEMPLATE.MANAGE'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], WbsController.prototype, "saveAsTemplate", null);
__decorate([
    (0, common_1.Post)('import/preview'),
    (0, permissions_decorator_1.Permissions)('WBS.NODE.CREATE'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WbsController.prototype, "previewImport", null);
__decorate([
    (0, common_1.Post)('import/commit'),
    (0, permissions_decorator_1.Permissions)('WBS.NODE.CREATE'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], WbsController.prototype, "commitImport", null);
exports.WbsController = WbsController = __decorate([
    (0, common_1.Controller)('projects/:projectId/wbs'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, project_context_guard_1.ProjectContextGuard, project_assignment_guard_1.ProjectAssignmentGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [wbs_service_1.WbsService,
        wbs_import_service_1.WbsImportService])
], WbsController);
//# sourceMappingURL=wbs.controller.js.map