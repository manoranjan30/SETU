"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectContextGuard = void 0;
const common_1 = require("@nestjs/common");
let ProjectContextGuard = class ProjectContextGuard {
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        let projectId = request.headers['x-project-id'];
        if (!projectId && request.params && request.params.projectId) {
            projectId = request.params.projectId;
        }
        if (!projectId && request.query && request.query.projectId) {
            projectId = request.query.projectId;
        }
        if (!projectId) {
            throw new common_1.BadRequestException('Project Context Missing: projectId required in Header (x-project-id) or Path/Query');
        }
        const projectIdNum = parseInt(String(projectId), 10);
        if (isNaN(projectIdNum)) {
            throw new common_1.BadRequestException('Invalid Project ID: must be a number');
        }
        request.projectContext = { projectId: projectIdNum };
        return true;
    }
};
exports.ProjectContextGuard = ProjectContextGuard;
exports.ProjectContextGuard = ProjectContextGuard = __decorate([
    (0, common_1.Injectable)()
], ProjectContextGuard);
//# sourceMappingURL=project-context.guard.js.map