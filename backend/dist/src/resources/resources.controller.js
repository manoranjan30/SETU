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
exports.ResourcesController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const resources_service_1 = require("./resources.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const permissions_guard_1 = require("../auth/permissions.guard");
const permissions_decorator_1 = require("../auth/permissions.decorator");
let ResourcesController = class ResourcesController {
    resourcesService;
    constructor(resourcesService) {
        this.resourcesService = resourcesService;
    }
    async getResources() {
        return this.resourcesService.findAllResources();
    }
    async createResource(body) {
        return this.resourcesService.createResource(body);
    }
    async updateResource(id, body) {
        return this.resourcesService.updateResource(+id, body);
    }
    async deleteResource(id) {
        return this.resourcesService.deleteResource(+id);
    }
    async getTemplateFile(res) {
        const csv = await this.resourcesService.getResourceTemplate();
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=resource_template.csv');
        return res.send(csv);
    }
    async importResources(file, mappingStr) {
        const mapping = JSON.parse(mappingStr || '{}');
        return this.resourcesService.importResources(file, mapping);
    }
    async getTemplates() {
        return this.resourcesService.findAllTemplates();
    }
    async getTemplate(id) {
        return this.resourcesService.findTemplateById(+id);
    }
    async createTemplate(body) {
        return this.resourcesService.createTemplate(body);
    }
    async updateTemplate(id, body) {
        return this.resourcesService.updateTemplate(+id, body);
    }
    deleteTemplate(id) {
        return this.resourcesService.deleteTemplate(+id);
    }
    suggestMappings(body) {
        return this.resourcesService.suggestMappings(body.items);
    }
    getProjectTotals(projectId) {
        return this.resourcesService.calculateProjectResources(+projectId);
    }
};
exports.ResourcesController = ResourcesController;
__decorate([
    (0, common_1.Get)('master'),
    (0, permissions_decorator_1.Permissions)('RESOURCE.MASTER.READ'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ResourcesController.prototype, "getResources", null);
__decorate([
    (0, common_1.Post)('master'),
    (0, permissions_decorator_1.Permissions)('RESOURCE.MASTER.CREATE'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ResourcesController.prototype, "createResource", null);
__decorate([
    (0, common_1.Put)('master/:id'),
    (0, permissions_decorator_1.Permissions)('RESOURCE.MASTER.UPDATE'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], ResourcesController.prototype, "updateResource", null);
__decorate([
    (0, common_1.Delete)('master/:id'),
    (0, permissions_decorator_1.Permissions)('RESOURCE.MASTER.DELETE'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ResourcesController.prototype, "deleteResource", null);
__decorate([
    (0, common_1.Get)('template'),
    (0, permissions_decorator_1.Permissions)('RESOURCE.MASTER.READ'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ResourcesController.prototype, "getTemplateFile", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, permissions_decorator_1.Permissions)('RESOURCE.MASTER.IMPORT'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)('mapping')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ResourcesController.prototype, "importResources", null);
__decorate([
    (0, common_1.Get)('templates'),
    (0, permissions_decorator_1.Permissions)('RESOURCE.TEMPLATE.MANAGE'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ResourcesController.prototype, "getTemplates", null);
__decorate([
    (0, common_1.Get)('templates/:id'),
    (0, permissions_decorator_1.Permissions)('RESOURCE.TEMPLATE.MANAGE'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ResourcesController.prototype, "getTemplate", null);
__decorate([
    (0, common_1.Post)('templates'),
    (0, permissions_decorator_1.Permissions)('RESOURCE.TEMPLATE.MANAGE'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ResourcesController.prototype, "createTemplate", null);
__decorate([
    (0, common_1.Put)('templates/:id'),
    (0, permissions_decorator_1.Permissions)('RESOURCE.TEMPLATE.MANAGE'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], ResourcesController.prototype, "updateTemplate", null);
__decorate([
    (0, common_1.Delete)('templates/:id'),
    (0, permissions_decorator_1.Permissions)('RESOURCE.TEMPLATE.MANAGE'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "deleteTemplate", null);
__decorate([
    (0, common_1.Post)('suggest-mapping'),
    (0, permissions_decorator_1.Permissions)('RESOURCE.MASTER.READ'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "suggestMappings", null);
__decorate([
    (0, common_1.Get)('project-totals/:projectId'),
    (0, permissions_decorator_1.Permissions)('RESOURCE.MASTER.READ'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ResourcesController.prototype, "getProjectTotals", null);
exports.ResourcesController = ResourcesController = __decorate([
    (0, common_1.Controller)('resources'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [resources_service_1.ResourcesService])
], ResourcesController);
//# sourceMappingURL=resources.controller.js.map