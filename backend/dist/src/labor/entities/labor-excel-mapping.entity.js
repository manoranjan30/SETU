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
exports.LaborExcelMapping = void 0;
const typeorm_1 = require("typeorm");
let LaborExcelMapping = class LaborExcelMapping {
    id;
    projectId;
    mappingName;
    columnMappings;
    createdOn;
    updatedOn;
};
exports.LaborExcelMapping = LaborExcelMapping;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], LaborExcelMapping.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], LaborExcelMapping.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LaborExcelMapping.prototype, "mappingName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json' }),
    __metadata("design:type", Object)
], LaborExcelMapping.prototype, "columnMappings", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], LaborExcelMapping.prototype, "createdOn", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], LaborExcelMapping.prototype, "updatedOn", void 0);
exports.LaborExcelMapping = LaborExcelMapping = __decorate([
    (0, typeorm_1.Entity)('labor_excel_mappings')
], LaborExcelMapping);
//# sourceMappingURL=labor-excel-mapping.entity.js.map