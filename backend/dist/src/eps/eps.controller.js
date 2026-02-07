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
exports.EpsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const eps_service_1 = require("./eps.service");
const create_eps_node_dto_1 = require("./dto/create-eps-node.dto");
const update_eps_node_dto_1 = require("./dto/update-eps-node.dto");
const update_project_profile_dto_1 = require("./dto/update-project-profile.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
let EpsController = class EpsController {
    epsService;
    constructor(epsService) {
        this.epsService = epsService;
    }
    getProfile(id) {
        return this.epsService.getProfile(+id);
    }
    updateProfile(id, updateProfileDto, req) {
        return this.epsService.updateProfile(+id, updateProfileDto, req.user);
    }
    uploadFile(file, req) {
        return this.epsService.importCsv(file.buffer, req.user);
    }
    create(createEpsDto, req) {
        return this.epsService.create(createEpsDto, req.user);
    }
    getProjectTree(id) {
        return this.epsService.getProjectTree(+id);
    }
    async findAll(req) {
        try {
            const nodes = await this.epsService.findAll(req.user);
            if (!nodes || nodes.length === 0) {
                return [
                    {
                        id: -666,
                        name: `DEBUG: 0 nodes found.`,
                        type: 'COMPANY',
                        parentId: null,
                        order: 0,
                    },
                ];
            }
            return nodes;
        }
        catch (e) {
            console.error('CONTROLLER CRASH:', e);
            return [];
        }
    }
    findOne(id) {
        return this.epsService.findOne(+id);
    }
    update(id, updateEpsDto, req) {
        return this.epsService.update(+id, updateEpsDto, req.user);
    }
    remove(id, req) {
        return this.epsService.remove(+id, req.user);
    }
};
exports.EpsController = EpsController;
__decorate([
    (0, common_1.Get)(':id/profile'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EpsController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Patch)(':id/profile'),
    (0, roles_decorator_1.Roles)('Admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_project_profile_dto_1.UpdateProjectProfileDto, Object]),
    __metadata("design:returntype", void 0)
], EpsController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, roles_decorator_1.Roles)('Admin'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], EpsController.prototype, "uploadFile", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('Admin'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_eps_node_dto_1.CreateEpsNodeDto, Object]),
    __metadata("design:returntype", void 0)
], EpsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id/tree'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EpsController.prototype, "getProjectTree", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EpsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EpsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)('Admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_eps_node_dto_1.UpdateEpsNodeDto, Object]),
    __metadata("design:returntype", void 0)
], EpsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)('Admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], EpsController.prototype, "remove", null);
exports.EpsController = EpsController = __decorate([
    (0, common_1.Controller)('eps'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [eps_service_1.EpsService])
], EpsController);
//# sourceMappingURL=eps.controller.js.map