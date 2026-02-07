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
exports.BoqController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const platform_express_1 = require("@nestjs/platform-express");
const boq_service_1 = require("./boq.service");
const boq_import_service_1 = require("./boq-import.service");
const create_boq_element_dto_1 = require("./dto/create-boq-element.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const permissions_guard_1 = require("../auth/permissions.guard");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const user_entity_1 = require("../users/user.entity");
const get_user_decorator_1 = require("../auth/get-user.decorator");
let BoqController = class BoqController {
    boqService;
    boqImportService;
    constructor(boqService, boqImportService) {
        this.boqService = boqService;
        this.boqImportService = boqImportService;
    }
    async downloadTemplate(res) {
        const buffer = this.boqImportService.getTemplateBuffer();
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename=BOQ_Import_Template.xlsx',
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }
    async importBoq(projectId, file, mappingStr, defaultEpsIdStr, hierarchyMappingStr) {
        let mapping = null;
        if (mappingStr) {
            try {
                mapping = JSON.parse(mappingStr);
            }
            catch (e) { }
        }
        let hierarchyMapping = undefined;
        if (hierarchyMappingStr) {
            try {
                hierarchyMapping = JSON.parse(hierarchyMappingStr);
            }
            catch (e) { }
        }
        const defaultEpsId = defaultEpsIdStr
            ? parseInt(defaultEpsIdStr, 10)
            : undefined;
        return await this.boqImportService.importBoq(projectId, file.buffer, mapping, defaultEpsId, hierarchyMapping);
    }
    async downloadMeasurementTemplate(res) {
        const buffer = this.boqImportService.getMeasurementTemplate();
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename=Measurement_Import_Template.xlsx',
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }
    async importMeasurements(projectId, boqItemId, file, mappingStr, defaultEpsIdStr, valueMapStr, hierarchyMappingStr, boqSubItemIdStr) {
        let mapping = null;
        if (mappingStr) {
            try {
                mapping = JSON.parse(mappingStr);
            }
            catch (e) { }
        }
        let valueMap = undefined;
        if (valueMapStr) {
            try {
                valueMap = JSON.parse(valueMapStr);
            }
            catch (e) { }
        }
        let hierarchyMapping = undefined;
        if (hierarchyMappingStr) {
            try {
                hierarchyMapping = JSON.parse(hierarchyMappingStr);
            }
            catch (e) { }
        }
        const defaultEpsId = defaultEpsIdStr
            ? parseInt(defaultEpsIdStr, 10)
            : undefined;
        const boqSubItemId = boqSubItemIdStr
            ? parseInt(boqSubItemIdStr, 10)
            : undefined;
        try {
            console.log('CONTROLLER: Starting Import for Project', projectId, 'Item', boqItemId, 'SubItem', boqSubItemId);
            const count = await this.boqImportService.importMeasurements(projectId, boqItemId, file.buffer, mapping, defaultEpsId, valueMap, hierarchyMapping, boqSubItemId);
            console.log('CONTROLLER: Import Success. Count:', count);
            return { count, message: `Imported ${count} measurements.` };
        }
        catch (e) {
            console.error('CONTROLLER IMPORT CRASH:', e);
            throw e;
        }
    }
    async create(dto, user) {
        return await this.boqService.createBoqItem({
            projectId: dto.projectId,
            boqCode: dto.boqCode,
            description: dto.boqName,
            longDescription: dto.longDescription,
            uom: dto.unitOfMeasure,
            qtyMode: 'MANUAL',
            qty: dto.totalQuantity,
            rate: 0,
            amount: 0,
            epsNodeId: dto.epsNodeId || null,
        }, user.id);
    }
    async createSubItem(body) {
        return await this.boqService.createSubItem(body);
    }
    async updateSubItem(id, body) {
        return await this.boqService.updateSubItem(id, body);
    }
    async addMeasurement(body) {
        return await this.boqService.addMeasurement(body);
    }
    async addProgress(body) {
        return await this.boqService.addProgress(body);
    }
    async getForEps(nodeId) {
        return await this.boqService.findByEpsNode(nodeId);
    }
    async getForProject(projectId) {
        return await this.boqService.getProjectBoq(projectId);
    }
    async update(id, updateDto, user) {
        return await this.boqService.updateBoqItem(id, updateDto, user.id);
    }
    async remove(id, user) {
        return await this.boqService.deleteBoqItem(id, user.id);
    }
    async bulkDeleteMeasurements(body) {
        return await this.boqService.deleteMeasurements(body.ids);
    }
    async updateMeasurement(id, body) {
        return await this.boqService.updateMeasurement(id, body);
    }
    async bulkUpdateMeasurements(body) {
        return await this.boqService.bulkUpdateMeasurements(body.ids, body.data);
    }
};
exports.BoqController = BoqController;
__decorate([
    (0, common_1.Get)('template'),
    (0, swagger_1.ApiOperation)({ summary: 'Download BOQ Import Excel Template' }),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BoqController.prototype, "downloadTemplate", null);
__decorate([
    (0, common_1.Post)('import/:projectId'),
    (0, swagger_1.ApiOperation)({ summary: 'Import BOQ from Excel File' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)('mapping')),
    __param(3, (0, common_1.Body)('defaultEpsId')),
    __param(4, (0, common_1.Body)('hierarchyMapping')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], BoqController.prototype, "importBoq", null);
__decorate([
    (0, common_1.Get)('measurements/template'),
    (0, swagger_1.ApiOperation)({ summary: 'Download Measurement Import Template' }),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BoqController.prototype, "downloadMeasurementTemplate", null);
__decorate([
    (0, common_1.Post)('measurements/import/:projectId/:boqItemId'),
    (0, swagger_1.ApiOperation)({ summary: 'Import Measurements for a BOQ Item' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('boqItemId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, common_1.Body)('mapping')),
    __param(4, (0, common_1.Body)('defaultEpsId')),
    __param(5, (0, common_1.Body)('valueMap')),
    __param(6, (0, common_1.Body)('hierarchyMapping')),
    __param(7, (0, common_1.Body)('boqSubItemId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], BoqController.prototype, "importMeasurements", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.Permissions)('MANAGE_BOQ'),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a new BOQ Element (Legacy compatibility or Manual Layer 1)',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_boq_element_dto_1.CreateBoqElementDto, user_entity_1.User]),
    __metadata("design:returntype", Promise)
], BoqController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('sub-item'),
    (0, permissions_decorator_1.Permissions)('MANAGE_BOQ'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a Sub Item (Layer 2)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BoqController.prototype, "createSubItem", null);
__decorate([
    (0, common_1.Patch)('sub-item/:id'),
    (0, permissions_decorator_1.Permissions)('MANAGE_BOQ'),
    (0, swagger_1.ApiOperation)({ summary: 'Update Sub Item (Rate/Description)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], BoqController.prototype, "updateSubItem", null);
__decorate([
    (0, common_1.Post)('measurement'),
    (0, permissions_decorator_1.Permissions)('MANAGE_BOQ'),
    (0, swagger_1.ApiOperation)({ summary: 'Add a Measurement (Layer 2)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BoqController.prototype, "addMeasurement", null);
__decorate([
    (0, common_1.Post)('progress'),
    (0, permissions_decorator_1.Permissions)('MANAGE_BOQ'),
    (0, swagger_1.ApiOperation)({ summary: 'Add Progress Transaction (Layer 4)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BoqController.prototype, "addProgress", null);
__decorate([
    (0, common_1.Get)('eps/:nodeId'),
    (0, permissions_decorator_1.Permissions)('VIEW_BOQ'),
    (0, swagger_1.ApiOperation)({ summary: 'Get BOQ items for a specific EPS Node' }),
    __param(0, (0, common_1.Param)('nodeId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], BoqController.prototype, "getForEps", null);
__decorate([
    (0, common_1.Get)('project/:projectId'),
    (0, permissions_decorator_1.Permissions)('VIEW_BOQ'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all BOQ items for a Project (Layer 1)' }),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], BoqController.prototype, "getForProject", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, permissions_decorator_1.Permissions)('MANAGE_BOQ'),
    (0, swagger_1.ApiOperation)({ summary: 'Update BOQ Item (Qty blocked if Derived)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, user_entity_1.User]),
    __metadata("design:returntype", Promise)
], BoqController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, permissions_decorator_1.Permissions)('MANAGE_BOQ'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete BOQ Item (Cascades to measurements)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, user_entity_1.User]),
    __metadata("design:returntype", Promise)
], BoqController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('measurements/bulk-delete'),
    (0, swagger_1.ApiOperation)({ summary: 'Bulk Delete Measurements and Recalculate' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BoqController.prototype, "bulkDeleteMeasurements", null);
__decorate([
    (0, common_1.Patch)('measurement/:id'),
    (0, permissions_decorator_1.Permissions)('MANAGE_BOQ'),
    (0, swagger_1.ApiOperation)({ summary: 'Update Single Measurement' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], BoqController.prototype, "updateMeasurement", null);
__decorate([
    (0, common_1.Patch)('measurements/bulk'),
    (0, permissions_decorator_1.Permissions)('MANAGE_BOQ'),
    (0, swagger_1.ApiOperation)({ summary: 'Bulk Update Measurements' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BoqController.prototype, "bulkUpdateMeasurements", null);
exports.BoqController = BoqController = __decorate([
    (0, swagger_1.ApiTags)('BOQ Management'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('boq'),
    __metadata("design:paramtypes", [boq_service_1.BoqService,
        boq_import_service_1.BoqImportService])
], BoqController);
//# sourceMappingURL=boq.controller.js.map