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
exports.TableViewService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const table_view_config_entity_1 = require("./entities/table-view-config.entity");
let TableViewService = class TableViewService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async getViews(userId, tableId) {
        return await this.repo.find({
            where: { userId, tableId },
            order: { isDefault: 'DESC', viewName: 'ASC' },
        });
    }
    async saveView(userId, dto) {
        if (dto.isDefault) {
            await this.repo.update({ userId, tableId: dto.tableId }, { isDefault: false });
        }
        const existing = await this.repo.findOne({
            where: { userId, tableId: dto.tableId, viewName: dto.viewName },
        });
        if (existing) {
            existing.config = dto.config;
            existing.isDefault = dto.isDefault ?? existing.isDefault;
            return await this.repo.save(existing);
        }
        else {
            const newView = this.repo.create({ ...dto, userId });
            return await this.repo.save(newView);
        }
    }
    async deleteView(userId, id) {
        const view = await this.repo.findOne({ where: { id, userId } });
        if (!view)
            throw new common_1.NotFoundException('View not found');
        return await this.repo.remove(view);
    }
};
exports.TableViewService = TableViewService;
exports.TableViewService = TableViewService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(table_view_config_entity_1.TableViewConfig)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], TableViewService);
//# sourceMappingURL=table-view.service.js.map