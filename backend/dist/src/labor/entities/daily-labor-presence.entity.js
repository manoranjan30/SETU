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
exports.DailyLaborPresence = void 0;
const typeorm_1 = require("typeorm");
const labor_category_entity_1 = require("./labor-category.entity");
let DailyLaborPresence = class DailyLaborPresence {
    id;
    projectId;
    date;
    categoryId;
    category;
    count;
    contractorName;
    remarks;
    createdOn;
    updatedOn;
    updatedBy;
};
exports.DailyLaborPresence = DailyLaborPresence;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], DailyLaborPresence.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], DailyLaborPresence.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", String)
], DailyLaborPresence.prototype, "date", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], DailyLaborPresence.prototype, "categoryId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => labor_category_entity_1.LaborCategory),
    (0, typeorm_1.JoinColumn)({ name: 'categoryId' }),
    __metadata("design:type", labor_category_entity_1.LaborCategory)
], DailyLaborPresence.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], DailyLaborPresence.prototype, "count", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DailyLaborPresence.prototype, "contractorName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], DailyLaborPresence.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DailyLaborPresence.prototype, "createdOn", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], DailyLaborPresence.prototype, "updatedOn", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DailyLaborPresence.prototype, "updatedBy", void 0);
exports.DailyLaborPresence = DailyLaborPresence = __decorate([
    (0, typeorm_1.Entity)('daily_labor_presence')
], DailyLaborPresence);
//# sourceMappingURL=daily-labor-presence.entity.js.map