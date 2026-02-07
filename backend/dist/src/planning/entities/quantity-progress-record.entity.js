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
exports.QuantityProgressRecord = exports.ProgressStatus = void 0;
const typeorm_1 = require("typeorm");
const boq_item_entity_1 = require("../../boq/entities/boq-item.entity");
var ProgressStatus;
(function (ProgressStatus) {
    ProgressStatus["DRAFT"] = "DRAFT";
    ProgressStatus["APPROVED"] = "APPROVED";
    ProgressStatus["REJECTED"] = "REJECTED";
})(ProgressStatus || (exports.ProgressStatus = ProgressStatus = {}));
let QuantityProgressRecord = class QuantityProgressRecord {
    id;
    projectId;
    boqItem;
    boqItemId;
    measuredQty;
    totalToDate;
    measureDate;
    status;
    locationId;
    remarks;
    createdOn;
    updatedOn;
    createdBy;
    approvedBy;
    approvedDate;
};
exports.QuantityProgressRecord = QuantityProgressRecord;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], QuantityProgressRecord.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], QuantityProgressRecord.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => boq_item_entity_1.BoqItem, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'boq_item_id' }),
    __metadata("design:type", boq_item_entity_1.BoqItem)
], QuantityProgressRecord.prototype, "boqItem", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], QuantityProgressRecord.prototype, "boqItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2 }),
    __metadata("design:type", Number)
], QuantityProgressRecord.prototype, "measuredQty", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], QuantityProgressRecord.prototype, "totalToDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", Date)
], QuantityProgressRecord.prototype, "measureDate", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ProgressStatus,
        default: ProgressStatus.DRAFT,
    }),
    __metadata("design:type", String)
], QuantityProgressRecord.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], QuantityProgressRecord.prototype, "locationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], QuantityProgressRecord.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], QuantityProgressRecord.prototype, "createdOn", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], QuantityProgressRecord.prototype, "updatedOn", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], QuantityProgressRecord.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], QuantityProgressRecord.prototype, "approvedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], QuantityProgressRecord.prototype, "approvedDate", void 0);
exports.QuantityProgressRecord = QuantityProgressRecord = __decorate([
    (0, typeorm_1.Entity)('quantity_progress_record')
], QuantityProgressRecord);
//# sourceMappingURL=quantity-progress-record.entity.js.map