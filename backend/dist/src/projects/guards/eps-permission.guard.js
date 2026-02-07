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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EpsPermissionGuard = exports.RequireEpsPermission = exports.NODE_PARAM_KEY = exports.PERMISSION_KEY = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const permission_resolution_service_1 = require("../permission-resolution.service");
exports.PERMISSION_KEY = 'required_permission';
exports.NODE_PARAM_KEY = 'node_param_key';
const RequireEpsPermission = (permission, nodeParam = 'id') => {
    return (target, key, descriptor) => {
        (0, common_1.SetMetadata)(exports.PERMISSION_KEY, permission)(target, key, descriptor);
        (0, common_1.SetMetadata)(exports.NODE_PARAM_KEY, nodeParam)(target, key, descriptor);
    };
};
exports.RequireEpsPermission = RequireEpsPermission;
let EpsPermissionGuard = class EpsPermissionGuard {
    resolutionService;
    reflector;
    constructor(resolutionService, reflector) {
        this.resolutionService = resolutionService;
        this.reflector = reflector;
    }
    async canActivate(context) {
        const permission = this.reflector.getAllAndOverride(exports.PERMISSION_KEY, [context.getHandler(), context.getClass()]);
        if (!permission)
            return true;
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (user?.roles?.includes('Admin'))
            return true;
        const nodeParam = this.reflector.getAllAndOverride(exports.NODE_PARAM_KEY, [
            context.getHandler(),
            context.getClass(),
        ]) || 'id';
        const nodeIdRaw = request.params[nodeParam] ||
            request.query[nodeParam] ||
            request.body[nodeParam];
        if (!nodeIdRaw) {
            return false;
        }
        const nodeId = parseInt(String(nodeIdRaw), 10);
        if (isNaN(nodeId))
            return false;
        const authorized = await this.resolutionService.hasPermission(user.sub, permission, nodeId);
        if (!authorized) {
            throw new common_1.ForbiddenException(`Missing permission: ${permission} on Node ${nodeId}`);
        }
        return true;
    }
};
exports.EpsPermissionGuard = EpsPermissionGuard;
exports.EpsPermissionGuard = EpsPermissionGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [permission_resolution_service_1.PermissionResolutionService,
        core_1.Reflector])
], EpsPermissionGuard);
//# sourceMappingURL=eps-permission.guard.js.map