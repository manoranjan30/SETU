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
exports.EhsEnvironmental = exports.WaterSource = void 0;
const typeorm_1 = require("typeorm");
const eps_entity_1 = require("../../eps/eps.entity");
const user_entity_1 = require("../../users/user.entity");
var WaterSource;
(function (WaterSource) {
    WaterSource["MUNICIPAL"] = "MUNICIPAL";
    WaterSource["TANKER"] = "TANKER";
    WaterSource["BOREWELL"] = "BOREWELL";
    WaterSource["STP"] = "STP";
    WaterSource["RAINWATER"] = "RAINWATER";
})(WaterSource || (exports.WaterSource = WaterSource = {}));
let EhsEnvironmental = class EhsEnvironmental {
    id;
    projectId;
    project;
    date;
    waterDomestic;
    waterConstruction;
    waterSource;
    tankerCount;
    hazardousWaste;
    nonHazardousWaste;
    steelScrap;
    concreteDebris;
    dustControlDone;
    sprinklingFrequency;
    noiseLevel;
    pm25;
    pm10;
    dgRunHours;
    fuelConsumption;
    electricityUsage;
    remarks;
    createdById;
    createdBy;
    createdAt;
    updatedAt;
};
exports.EhsEnvironmental = EhsEnvironmental;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], EhsEnvironmental.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], EhsEnvironmental.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => eps_entity_1.EpsNode),
    (0, typeorm_1.JoinColumn)({ name: 'projectId' }),
    __metadata("design:type", eps_entity_1.EpsNode)
], EhsEnvironmental.prototype, "project", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", String)
], EhsEnvironmental.prototype, "date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], EhsEnvironmental.prototype, "waterDomestic", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], EhsEnvironmental.prototype, "waterConstruction", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: WaterSource,
        nullable: true,
    }),
    __metadata("design:type", String)
], EhsEnvironmental.prototype, "waterSource", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], EhsEnvironmental.prototype, "tankerCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], EhsEnvironmental.prototype, "hazardousWaste", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], EhsEnvironmental.prototype, "nonHazardousWaste", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], EhsEnvironmental.prototype, "steelScrap", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], EhsEnvironmental.prototype, "concreteDebris", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], EhsEnvironmental.prototype, "dustControlDone", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], EhsEnvironmental.prototype, "sprinklingFrequency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], EhsEnvironmental.prototype, "noiseLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], EhsEnvironmental.prototype, "pm25", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], EhsEnvironmental.prototype, "pm10", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], EhsEnvironmental.prototype, "dgRunHours", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], EhsEnvironmental.prototype, "fuelConsumption", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], EhsEnvironmental.prototype, "electricityUsage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], EhsEnvironmental.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], EhsEnvironmental.prototype, "createdById", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'createdById' }),
    __metadata("design:type", user_entity_1.User)
], EhsEnvironmental.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], EhsEnvironmental.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], EhsEnvironmental.prototype, "updatedAt", void 0);
exports.EhsEnvironmental = EhsEnvironmental = __decorate([
    (0, typeorm_1.Entity)('ehs_environmental_logs')
], EhsEnvironmental);
//# sourceMappingURL=ehs-environmental.entity.js.map