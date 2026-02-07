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
exports.TableViewController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const table_view_service_1 = require("./table-view.service");
const swagger_1 = require("@nestjs/swagger");
let TableViewController = class TableViewController {
    service;
    constructor(service) {
        this.service = service;
    }
    async getViews(req, tableId) {
        return await this.service.getViews(req.user.id, tableId);
    }
    async saveView(req, body) {
        return await this.service.saveView(req.user.id, body);
    }
    async deleteView(req, id) {
        return await this.service.deleteView(req.user.id, id);
    }
};
exports.TableViewController = TableViewController;
__decorate([
    (0, common_1.Get)(':tableId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get saved views for a specific table' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('tableId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TableViewController.prototype, "getViews", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Save or Update a View' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TableViewController.prototype, "saveView", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a saved view' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], TableViewController.prototype, "deleteView", null);
exports.TableViewController = TableViewController = __decorate([
    (0, swagger_1.ApiTags)('Table Views'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('table-views'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [table_view_service_1.TableViewService])
], TableViewController);
//# sourceMappingURL=table-view.controller.js.map