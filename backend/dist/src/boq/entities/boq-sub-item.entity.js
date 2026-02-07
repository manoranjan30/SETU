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
exports.BoqSubItem = void 0;
const typeorm_1 = require("typeorm");
const boq_item_entity_1 = require("./boq-item.entity");
const measurement_element_entity_1 = require("./measurement-element.entity");
let BoqSubItem = class BoqSubItem {
    id;
    boqItemId;
    boqItem;
    description;
    uom;
    rate;
    qty;
    amount;
    measurements;
    analysisTemplateId;
    analysisTemplate;
    createdOn;
    updatedOn;
};
exports.BoqSubItem = BoqSubItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], BoqSubItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], BoqSubItem.prototype, "boqItemId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => boq_item_entity_1.BoqItem, (item) => item.subItems, { onDelete: 'CASCADE' }),
    __metadata("design:type", boq_item_entity_1.BoqItem)
], BoqSubItem.prototype, "boqItem", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], BoqSubItem.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], BoqSubItem.prototype, "uom", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], BoqSubItem.prototype, "rate", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 12, scale: 3, default: 0 }),
    __metadata("design:type", Number)
], BoqSubItem.prototype, "qty", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], BoqSubItem.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => measurement_element_entity_1.MeasurementElement, (measurement) => measurement.boqSubItem),
    __metadata("design:type", Array)
], BoqSubItem.prototype, "measurements", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], BoqSubItem.prototype, "analysisTemplateId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)('AnalysisTemplate', { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'analysisTemplateId' }),
    __metadata("design:type", Object)
], BoqSubItem.prototype, "analysisTemplate", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], BoqSubItem.prototype, "createdOn", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], BoqSubItem.prototype, "updatedOn", void 0);
exports.BoqSubItem = BoqSubItem = __decorate([
    (0, typeorm_1.Entity)()
], BoqSubItem);
//# sourceMappingURL=boq-sub-item.entity.js.map