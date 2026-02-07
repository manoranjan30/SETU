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
exports.MeasurementProgress = void 0;
const typeorm_1 = require("typeorm");
const measurement_element_entity_1 = require("./measurement-element.entity");
let MeasurementProgress = class MeasurementProgress {
    id;
    measurementElement;
    measurementElementId;
    executedQty;
    date;
    updatedBy;
    customAttributes;
    loggedOn;
};
exports.MeasurementProgress = MeasurementProgress;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], MeasurementProgress.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => measurement_element_entity_1.MeasurementElement, { onDelete: 'CASCADE' }),
    __metadata("design:type", measurement_element_entity_1.MeasurementElement)
], MeasurementProgress.prototype, "measurementElement", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], MeasurementProgress.prototype, "measurementElementId", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 12, scale: 3 }),
    __metadata("design:type", Number)
], MeasurementProgress.prototype, "executedQty", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", Date)
], MeasurementProgress.prototype, "date", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], MeasurementProgress.prototype, "updatedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], MeasurementProgress.prototype, "customAttributes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], MeasurementProgress.prototype, "loggedOn", void 0);
exports.MeasurementProgress = MeasurementProgress = __decorate([
    (0, typeorm_1.Entity)()
], MeasurementProgress);
//# sourceMappingURL=measurement-progress.entity.js.map