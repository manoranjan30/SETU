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
exports.MeasurementElement = void 0;
const typeorm_1 = require("typeorm");
const eps_entity_1 = require("../../eps/eps.entity");
const boq_item_entity_1 = require("./boq-item.entity");
const boq_sub_item_entity_1 = require("./boq-sub-item.entity");
const activity_entity_1 = require("../../wbs/entities/activity.entity");
let MeasurementElement = class MeasurementElement {
    id;
    projectId;
    boqSubItem;
    boqSubItemId;
    boqItem;
    boqItemId;
    epsNode;
    epsNodeId;
    activity;
    activityId;
    elementId;
    elementName;
    elementCategory;
    elementType;
    grid;
    linkingElement;
    uom;
    length;
    breadth;
    depth;
    height;
    bottomLevel;
    topLevel;
    perimeter;
    baseArea;
    qty;
    executedQty;
    baseCoordinates;
    plineAllLengths;
    customAttributes;
    analysisTemplateId;
    analysisTemplate;
    importedOn;
};
exports.MeasurementElement = MeasurementElement;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], MeasurementElement.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], MeasurementElement.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => boq_sub_item_entity_1.BoqSubItem, (subItem) => subItem.measurements, {
        onDelete: 'CASCADE',
        nullable: true,
    }),
    __metadata("design:type", boq_sub_item_entity_1.BoqSubItem)
], MeasurementElement.prototype, "boqSubItem", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], MeasurementElement.prototype, "boqSubItemId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => boq_item_entity_1.BoqItem, (boqItem) => boqItem.measurements, {
        onDelete: 'CASCADE',
    }),
    __metadata("design:type", boq_item_entity_1.BoqItem)
], MeasurementElement.prototype, "boqItem", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], MeasurementElement.prototype, "boqItemId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => eps_entity_1.EpsNode, { onDelete: 'CASCADE' }),
    __metadata("design:type", eps_entity_1.EpsNode)
], MeasurementElement.prototype, "epsNode", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], MeasurementElement.prototype, "epsNodeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => activity_entity_1.Activity, {
        onDelete: 'CASCADE',
        nullable: true,
        createForeignKeyConstraints: false,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'activityId' }),
    __metadata("design:type", activity_entity_1.Activity)
], MeasurementElement.prototype, "activity", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], MeasurementElement.prototype, "activityId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], MeasurementElement.prototype, "elementId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MeasurementElement.prototype, "elementName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], MeasurementElement.prototype, "elementCategory", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], MeasurementElement.prototype, "elementType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], MeasurementElement.prototype, "grid", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], MeasurementElement.prototype, "linkingElement", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], MeasurementElement.prototype, "uom", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 3, default: 0 }),
    __metadata("design:type", Number)
], MeasurementElement.prototype, "length", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 3, default: 0 }),
    __metadata("design:type", Number)
], MeasurementElement.prototype, "breadth", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 3, default: 0 }),
    __metadata("design:type", Number)
], MeasurementElement.prototype, "depth", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 3, default: 0 }),
    __metadata("design:type", Number)
], MeasurementElement.prototype, "height", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 3, default: 0 }),
    __metadata("design:type", Number)
], MeasurementElement.prototype, "bottomLevel", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 3, default: 0 }),
    __metadata("design:type", Number)
], MeasurementElement.prototype, "topLevel", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 3, default: 0 }),
    __metadata("design:type", Number)
], MeasurementElement.prototype, "perimeter", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 12, scale: 3, default: 0 }),
    __metadata("design:type", Number)
], MeasurementElement.prototype, "baseArea", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 12, scale: 3 }),
    __metadata("design:type", Number)
], MeasurementElement.prototype, "qty", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 12, scale: 3, default: 0 }),
    __metadata("design:type", Number)
], MeasurementElement.prototype, "executedQty", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], MeasurementElement.prototype, "baseCoordinates", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], MeasurementElement.prototype, "plineAllLengths", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], MeasurementElement.prototype, "customAttributes", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], MeasurementElement.prototype, "analysisTemplateId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)('AnalysisTemplate', { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'analysisTemplateId' }),
    __metadata("design:type", Object)
], MeasurementElement.prototype, "analysisTemplate", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], MeasurementElement.prototype, "importedOn", void 0);
exports.MeasurementElement = MeasurementElement = __decorate([
    (0, typeorm_1.Entity)()
], MeasurementElement);
//# sourceMappingURL=measurement-element.entity.js.map