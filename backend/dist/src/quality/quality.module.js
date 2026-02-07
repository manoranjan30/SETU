"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const quality_service_1 = require("./quality.service");
const quality_controller_1 = require("./quality.controller");
const quality_inspection_entity_1 = require("./entities/quality-inspection.entity");
const quality_material_test_entity_1 = require("./entities/quality-material-test.entity");
const quality_observation_ncr_entity_1 = require("./entities/quality-observation-ncr.entity");
const quality_checklist_entity_1 = require("./entities/quality-checklist.entity");
const quality_snag_list_entity_1 = require("./entities/quality-snag-list.entity");
const quality_audit_entity_1 = require("./entities/quality-audit.entity");
const quality_document_entity_1 = require("./entities/quality-document.entity");
let QualityModule = class QualityModule {
};
exports.QualityModule = QualityModule;
exports.QualityModule = QualityModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                quality_inspection_entity_1.QualityInspection,
                quality_material_test_entity_1.QualityMaterialTest,
                quality_observation_ncr_entity_1.QualityObservationNcr,
                quality_checklist_entity_1.QualityChecklist,
                quality_snag_list_entity_1.QualitySnagList,
                quality_audit_entity_1.QualityAudit,
                quality_document_entity_1.QualityDocument,
            ]),
        ],
        controllers: [quality_controller_1.QualityController],
        providers: [quality_service_1.QualityService],
        exports: [quality_service_1.QualityService],
    })
], QualityModule);
//# sourceMappingURL=quality.module.js.map