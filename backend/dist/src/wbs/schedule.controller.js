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
exports.ScheduleController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const cpm_service_1 = require("./cpm.service");
const schedule_import_service_1 = require("./schedule-import.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const permissions_guard_1 = require("../auth/permissions.guard");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const project_assignment_guard_1 = require("../projects/guards/project-assignment.guard");
let ScheduleController = class ScheduleController {
    cpmService;
    importService;
    constructor(cpmService, importService) {
        this.cpmService = cpmService;
        this.importService = importService;
    }
    async getSchedule(projectId) {
        return this.cpmService.getProjectSchedule(projectId);
    }
    async calculate(projectId) {
        await this.cpmService.calculateSchedule(projectId);
        return { message: 'Schedule calculated successfully' };
    }
    async repairDurations(projectId) {
        await this.cpmService.repairDurations(projectId);
        return { message: 'Durations repaired successfully' };
    }
    async reschedule(projectId) {
        await this.cpmService.rescheduleProject(projectId);
        return { message: 'Project rescheduled successfully' };
    }
    async importSchedule(projectId, file) {
        const isXml = file.originalname.endsWith('.xml');
        if (isXml) {
            return this.importService.importMsProject(projectId, file.buffer);
        }
        return { message: 'File type not yet supported' };
    }
};
exports.ScheduleController = ScheduleController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.Permissions)('SCHEDULE.READ'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ScheduleController.prototype, "getSchedule", null);
__decorate([
    (0, common_1.Post)('calculate'),
    (0, permissions_decorator_1.Permissions)('SCHEDULE.UPDATE'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ScheduleController.prototype, "calculate", null);
__decorate([
    (0, common_1.Post)('repair-durations'),
    (0, permissions_decorator_1.Permissions)('SCHEDULE.UPDATE'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ScheduleController.prototype, "repairDurations", null);
__decorate([
    (0, common_1.Post)('reschedule'),
    (0, permissions_decorator_1.Permissions)('SCHEDULE.UPDATE'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ScheduleController.prototype, "reschedule", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, permissions_decorator_1.Permissions)('SCHEDULE.IMPORT'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.UploadedFile)(new common_1.ParseFilePipe({
        validators: [],
    }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], ScheduleController.prototype, "importSchedule", null);
exports.ScheduleController = ScheduleController = __decorate([
    (0, common_1.Controller)('projects/:projectId/schedule'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, project_assignment_guard_1.ProjectAssignmentGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [cpm_service_1.CpmService,
        schedule_import_service_1.ScheduleImportService])
], ScheduleController);
//# sourceMappingURL=schedule.controller.js.map