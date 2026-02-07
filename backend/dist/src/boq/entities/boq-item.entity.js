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
exports.BoqItem = exports.BoqQtyMode = void 0;
const typeorm_1 = require("typeorm");
const eps_entity_1 = require("../../eps/eps.entity");
const measurement_element_entity_1 = require("./measurement-element.entity");
const boq_sub_item_entity_1 = require("./boq-sub-item.entity");
var BoqQtyMode;
(function (BoqQtyMode) {
    BoqQtyMode["MANUAL"] = "MANUAL";
    BoqQtyMode["DERIVED"] = "DERIVED";
})(BoqQtyMode || (exports.BoqQtyMode = BoqQtyMode = {}));
let BoqItem = class BoqItem {
    id;
    projectId;
    boqCode;
    description;
    uom;
    longDescription;
    epsNode;
    epsNodeId;
    qtyMode;
    qty;
    rate;
    consumedQty;
    amount;
    status;
    customAttributes;
    subItems;
    measurements;
    createdOn;
    updatedOn;
    analysisTemplateId;
    analysisTemplate;
};
exports.BoqItem = BoqItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], BoqItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], BoqItem.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], BoqItem.prototype, "boqCode", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], BoqItem.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], BoqItem.prototype, "uom", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], BoqItem.prototype, "longDescription", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => eps_entity_1.EpsNode, { nullable: true }),
    __metadata("design:type", eps_entity_1.EpsNode)
], BoqItem.prototype, "epsNode", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Object)
], BoqItem.prototype, "epsNodeId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: BoqQtyMode,
        default: BoqQtyMode.DERIVED,
    }),
    __metadata("design:type", String)
], BoqItem.prototype, "qtyMode", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], BoqItem.prototype, "qty", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], BoqItem.prototype, "rate", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], BoqItem.prototype, "consumedQty", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], BoqItem.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'DRAFT' }),
    __metadata("design:type", String)
], BoqItem.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], BoqItem.prototype, "customAttributes", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => boq_sub_item_entity_1.BoqSubItem, (subItem) => subItem.boqItem),
    __metadata("design:type", Array)
], BoqItem.prototype, "subItems", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => measurement_element_entity_1.MeasurementElement, (measurement) => measurement.boqItem),
    __metadata("design:type", Array)
], BoqItem.prototype, "measurements", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], BoqItem.prototype, "createdOn", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], BoqItem.prototype, "updatedOn", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], BoqItem.prototype, "analysisTemplateId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)('AnalysisTemplate', { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'analysisTemplateId' }),
    __metadata("design:type", Object)
], BoqItem.prototype, "analysisTemplate", void 0);
exports.BoqItem = BoqItem = __decorate([
    (0, typeorm_1.Entity)()
], BoqItem);
//# sourceMappingURL=boq-item.entity.js.map