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
exports.ExecutionController = void 0;
const common_1 = require("@nestjs/common");
const execution_service_1 = require("./execution.service");
const execution_breakdown_service_1 = require("./execution-breakdown.service");
const features_config_1 = require("../config/features.config");
let ExecutionController = class ExecutionController {
    service;
    breakdownService;
    constructor(service, breakdownService) {
        this.service = service;
        this.breakdownService = breakdownService;
    }
    async saveMeasurements(projectId, body, req) {
        const userId = req.user?.id || 1;
        return this.service.batchSaveMeasurements(+projectId, body.entries, userId);
    }
    async getLogs(projectId) {
        return this.service.getProjectProgressLogs(+projectId);
    }
    async updateLog(logId, body, req) {
        const userId = req.user?.id || 1;
        return this.service.updateProgressLog(+logId, body.newQty, userId);
    }
    async deleteLog(logId) {
        return this.service.deleteProgressLog(+logId);
    }
    async getExecutionBreakdown(query) {
        if (!features_config_1.FEATURES.ENABLE_MICRO_PROGRESS) {
            return { error: 'Feature not enabled', enabled: false };
        }
        return this.breakdownService.getBreakdown(+query.activityId, +query.epsNodeId);
    }
    async hasMicroSchedule(activityId) {
        if (!features_config_1.FEATURES.ENABLE_MICRO_PROGRESS) {
            return { hasMicro: false };
        }
        const hasMicro = await this.breakdownService.hasMicroSchedule(+activityId);
        return { hasMicro };
    }
    async saveMicroProgress(dto, req) {
        if (!features_config_1.FEATURES.ENABLE_MICRO_PROGRESS) {
            throw new Error('Feature not enabled');
        }
        const userId = req.user?.id || 1;
        const entries = dto.entries.map((entry) => ({
            boqItemId: entry.boqItemId,
            activityId: dto.activityId,
            projectId: dto.projectId || req.params.projectId,
            wbsNodeId: dto.epsNodeId,
            microActivityId: entry.microActivityId || null,
            executedQty: Number(entry.quantity),
            date: dto.date,
            notes: dto.remarks || '',
        }));
        return await this.service.batchSaveMeasurements(dto.projectId || req.params.projectId, entries, userId);
    }
    async getPendingApprovals(projectId) {
        return this.service.getPendingProgressLogs(+projectId);
    }
    async approveMeasurements(body, req) {
        const userId = req.user?.id || 1;
        return this.service.approveProgress(body.logIds, userId);
    }
    async rejectMeasurements(body, req) {
        const userId = req.user?.id || 1;
        return this.service.rejectProgress(body.logIds, userId, body.reason);
    }
};
exports.ExecutionController = ExecutionController;
__decorate([
    (0, common_1.Post)(':projectId/measurements'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ExecutionController.prototype, "saveMeasurements", null);
__decorate([
    (0, common_1.Get)(':projectId/logs'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ExecutionController.prototype, "getLogs", null);
__decorate([
    (0, common_1.Patch)('logs/:logId'),
    __param(0, (0, common_1.Param)('logId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ExecutionController.prototype, "updateLog", null);
__decorate([
    (0, common_1.Delete)('logs/:logId'),
    __param(0, (0, common_1.Param)('logId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ExecutionController.prototype, "deleteLog", null);
__decorate([
    (0, common_1.Get)('breakdown'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExecutionController.prototype, "getExecutionBreakdown", null);
__decorate([
    (0, common_1.Get)('has-micro/:activityId'),
    __param(0, (0, common_1.Param)('activityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ExecutionController.prototype, "hasMicroSchedule", null);
__decorate([
    (0, common_1.Post)('progress/micro'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExecutionController.prototype, "saveMicroProgress", null);
__decorate([
    (0, common_1.Get)(':projectId/approvals/pending'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ExecutionController.prototype, "getPendingApprovals", null);
__decorate([
    (0, common_1.Post)('approve'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExecutionController.prototype, "approveMeasurements", null);
__decorate([
    (0, common_1.Post)('reject'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExecutionController.prototype, "rejectMeasurements", null);
exports.ExecutionController = ExecutionController = __decorate([
    (0, common_1.Controller)('execution'),
    __metadata("design:paramtypes", [execution_service_1.ExecutionService,
        execution_breakdown_service_1.ExecutionBreakdownService])
], ExecutionController);
//# sourceMappingURL=execution.controller.js.map