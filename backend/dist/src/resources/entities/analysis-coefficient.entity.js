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
exports.AnalysisCoefficient = void 0;
const typeorm_1 = require("typeorm");
const analysis_template_entity_1 = require("./analysis-template.entity");
const resource_master_entity_1 = require("./resource-master.entity");
let AnalysisCoefficient = class AnalysisCoefficient {
    id;
    templateId;
    template;
    resourceId;
    resource;
    coefficient;
    remarks;
};
exports.AnalysisCoefficient = AnalysisCoefficient;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], AnalysisCoefficient.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], AnalysisCoefficient.prototype, "templateId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => analysis_template_entity_1.AnalysisTemplate, (template) => template.coefficients, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'templateId' }),
    __metadata("design:type", analysis_template_entity_1.AnalysisTemplate)
], AnalysisCoefficient.prototype, "template", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], AnalysisCoefficient.prototype, "resourceId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => resource_master_entity_1.ResourceMaster),
    (0, typeorm_1.JoinColumn)({ name: 'resourceId' }),
    __metadata("design:type", resource_master_entity_1.ResourceMaster)
], AnalysisCoefficient.prototype, "resource", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 12, scale: 6 }),
    __metadata("design:type", Number)
], AnalysisCoefficient.prototype, "coefficient", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AnalysisCoefficient.prototype, "remarks", void 0);
exports.AnalysisCoefficient = AnalysisCoefficient = __decorate([
    (0, typeorm_1.Entity)()
], AnalysisCoefficient);
//# sourceMappingURL=analysis-coefficient.entity.js.map