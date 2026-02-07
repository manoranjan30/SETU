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
exports.WbsTemplateController = void 0;
const common_1 = require("@nestjs/common");
const wbs_service_1 = require("./wbs.service");
const wbs_template_dto_1 = require("./dto/wbs-template.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const permissions_guard_1 = require("../auth/permissions.guard");
const permissions_decorator_1 = require("../auth/permissions.decorator");
let WbsTemplateController = class WbsTemplateController {
    wbsService;
    constructor(wbsService) {
        this.wbsService = wbsService;
    }
    createTemplate(dto) {
        return this.wbsService.createTemplate(dto);
    }
    getTemplates() {
        return this.wbsService.getTemplates();
    }
    getTemplateNodes(templateId) {
        return this.wbsService.getTemplateNodes(+templateId);
    }
    createTemplateNode(dto) {
        return this.wbsService.createTemplateNode(dto);
    }
    deleteTemplateNode(nodeId) {
        return this.wbsService.deleteTemplateNode(+nodeId);
    }
    deleteTemplate(templateId) {
        return this.wbsService.deleteTemplate(+templateId);
    }
};
exports.WbsTemplateController = WbsTemplateController;
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.Permissions)('WBS.TEMPLATE.MANAGE'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [wbs_template_dto_1.CreateWbsTemplateDto]),
    __metadata("design:returntype", void 0)
], WbsTemplateController.prototype, "createTemplate", null);
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.Permissions)('WBS.TEMPLATE.READ'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], WbsTemplateController.prototype, "getTemplates", null);
__decorate([
    (0, common_1.Get)(':templateId/nodes'),
    (0, permissions_decorator_1.Permissions)('WBS.TEMPLATE.READ'),
    __param(0, (0, common_1.Param)('templateId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WbsTemplateController.prototype, "getTemplateNodes", null);
__decorate([
    (0, common_1.Post)('nodes'),
    (0, permissions_decorator_1.Permissions)('WBS.TEMPLATE.MANAGE'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WbsTemplateController.prototype, "createTemplateNode", null);
__decorate([
    (0, common_1.Delete)('nodes/:nodeId'),
    (0, permissions_decorator_1.Permissions)('WBS.TEMPLATE.MANAGE'),
    __param(0, (0, common_1.Param)('nodeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WbsTemplateController.prototype, "deleteTemplateNode", null);
__decorate([
    (0, common_1.Delete)(':templateId'),
    (0, permissions_decorator_1.Permissions)('WBS.TEMPLATE.MANAGE'),
    __param(0, (0, common_1.Param)('templateId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WbsTemplateController.prototype, "deleteTemplate", null);
exports.WbsTemplateController = WbsTemplateController = __decorate([
    (0, common_1.Controller)('wbs/templates'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [wbs_service_1.WbsService])
], WbsTemplateController);
//# sourceMappingURL=wbs-template.controller.js.map