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
exports.LaborController = void 0;
const common_1 = require("@nestjs/common");
const labor_service_1 = require("./labor.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const permissions_guard_1 = require("../auth/permissions.guard");
const permissions_decorator_1 = require("../auth/permissions.decorator");
let LaborController = class LaborController {
    laborService;
    constructor(laborService) {
        this.laborService = laborService;
    }
    getCategories(projectId) {
        return this.laborService.getCategories(projectId ? parseInt(projectId) : undefined);
    }
    saveCategories(categories) {
        return this.laborService.saveCategories(categories);
    }
    getDailyPresence(projectId, date) {
        return this.laborService.getDailyPresence(parseInt(projectId), date);
    }
    saveDailyPresence(projectId, body) {
        return this.laborService.saveDailyPresence(parseInt(projectId), body.entries, body.userId);
    }
    getActivityLabor(activityId) {
        return this.laborService.getActivityLabor(parseInt(activityId));
    }
    getAllocationsByProject(projectId, date) {
        return this.laborService.getAllocationsByProject(parseInt(projectId), date);
    }
    saveActivityLabor(body) {
        return this.laborService.saveActivityLabor(body.entries, body.userId);
    }
    getMappings(projectId) {
        return this.laborService.getMappings(parseInt(projectId));
    }
    saveMapping(mapping) {
        return this.laborService.saveMapping(mapping);
    }
    importData(projectId, body) {
        return this.laborService.importLaborData(parseInt(projectId), body.data, body.mappingId, body.userId);
    }
};
exports.LaborController = LaborController;
__decorate([
    (0, common_1.Get)('categories'),
    (0, permissions_decorator_1.Permissions)('LABOR.CATEGORY.READ'),
    __param(0, (0, common_1.Query)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LaborController.prototype, "getCategories", null);
__decorate([
    (0, common_1.Post)('categories'),
    (0, permissions_decorator_1.Permissions)('LABOR.CATEGORY.MANAGE'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", void 0)
], LaborController.prototype, "saveCategories", null);
__decorate([
    (0, common_1.Get)('presence/:projectId'),
    (0, permissions_decorator_1.Permissions)('LABOR.ENTRY.READ'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LaborController.prototype, "getDailyPresence", null);
__decorate([
    (0, common_1.Post)('presence/:projectId'),
    (0, permissions_decorator_1.Permissions)('LABOR.ENTRY.CREATE'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LaborController.prototype, "saveDailyPresence", null);
__decorate([
    (0, common_1.Get)('activity/:activityId'),
    (0, permissions_decorator_1.Permissions)('LABOR.ENTRY.READ'),
    __param(0, (0, common_1.Param)('activityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LaborController.prototype, "getActivityLabor", null);
__decorate([
    (0, common_1.Get)('allocations/:projectId'),
    (0, permissions_decorator_1.Permissions)('LABOR.ENTRY.READ'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LaborController.prototype, "getAllocationsByProject", null);
__decorate([
    (0, common_1.Post)('activity'),
    (0, permissions_decorator_1.Permissions)('LABOR.ENTRY.CREATE'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LaborController.prototype, "saveActivityLabor", null);
__decorate([
    (0, common_1.Get)('mappings/:projectId'),
    (0, permissions_decorator_1.Permissions)('LABOR.MAPPING.MANAGE'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LaborController.prototype, "getMappings", null);
__decorate([
    (0, common_1.Post)('mappings'),
    (0, permissions_decorator_1.Permissions)('LABOR.MAPPING.MANAGE'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LaborController.prototype, "saveMapping", null);
__decorate([
    (0, common_1.Post)('import/:projectId'),
    (0, permissions_decorator_1.Permissions)('LABOR.ENTRY.IMPORT'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LaborController.prototype, "importData", null);
exports.LaborController = LaborController = __decorate([
    (0, common_1.Controller)('labor'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [labor_service_1.LaborService])
], LaborController);
//# sourceMappingURL=labor.controller.js.map