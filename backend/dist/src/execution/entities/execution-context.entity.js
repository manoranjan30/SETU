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
exports.ExecutionContext = void 0;
const typeorm_1 = require("typeorm");
const eps_entity_1 = require("../../eps/eps.entity");
const boq_element_entity_1 = require("../../boq/entities/boq-element.entity");
const activity_entity_1 = require("../../wbs/entities/activity.entity");
let ExecutionContext = class ExecutionContext {
    id;
    projectId;
    epsNode;
    boqElement;
    activity;
    plannedQuantity;
    actualQuantity;
    remainingQuantity;
    percentComplete;
    status;
    actualStartDate;
    actualFinishDate;
    createdOn;
    updatedOn;
};
exports.ExecutionContext = ExecutionContext;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ExecutionContext.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], ExecutionContext.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => eps_entity_1.EpsNode, { onDelete: 'CASCADE' }),
    __metadata("design:type", eps_entity_1.EpsNode)
], ExecutionContext.prototype, "epsNode", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => boq_element_entity_1.BoqElement, { onDelete: 'CASCADE' }),
    __metadata("design:type", boq_element_entity_1.BoqElement)
], ExecutionContext.prototype, "boqElement", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => activity_entity_1.Activity, { onDelete: 'SET NULL', nullable: true }),
    __metadata("design:type", activity_entity_1.Activity)
], ExecutionContext.prototype, "activity", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 12, scale: 2 }),
    __metadata("design:type", Number)
], ExecutionContext.prototype, "plannedQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], ExecutionContext.prototype, "actualQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], ExecutionContext.prototype, "remainingQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 5, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], ExecutionContext.prototype, "percentComplete", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'],
        default: 'NOT_STARTED',
    }),
    __metadata("design:type", String)
], ExecutionContext.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ExecutionContext.prototype, "actualStartDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ExecutionContext.prototype, "actualFinishDate", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ExecutionContext.prototype, "createdOn", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ExecutionContext.prototype, "updatedOn", void 0);
exports.ExecutionContext = ExecutionContext = __decorate([
    (0, typeorm_1.Entity)()
], ExecutionContext);
//# sourceMappingURL=execution-context.entity.js.map