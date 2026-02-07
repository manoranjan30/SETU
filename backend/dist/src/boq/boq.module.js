"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoqModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const boq_element_entity_1 = require("./entities/boq-element.entity");
const boq_item_entity_1 = require("./entities/boq-item.entity");
const measurement_element_entity_1 = require("./entities/measurement-element.entity");
const measurement_progress_entity_1 = require("./entities/measurement-progress.entity");
const eps_entity_1 = require("../eps/eps.entity");
const boq_service_1 = require("./boq.service");
const boq_controller_1 = require("./boq.controller");
const boq_import_service_1 = require("./boq-import.service");
const boq_sub_item_entity_1 = require("./entities/boq-sub-item.entity");
const audit_module_1 = require("../audit/audit.module");
const planning_module_1 = require("../planning/planning.module");
const common_2 = require("@nestjs/common");
let BoqModule = class BoqModule {
};
exports.BoqModule = BoqModule;
exports.BoqModule = BoqModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                boq_element_entity_1.BoqElement,
                eps_entity_1.EpsNode,
                boq_item_entity_1.BoqItem,
                boq_sub_item_entity_1.BoqSubItem,
                measurement_element_entity_1.MeasurementElement,
                measurement_progress_entity_1.MeasurementProgress,
            ]),
            audit_module_1.AuditModule,
            (0, common_2.forwardRef)(() => planning_module_1.PlanningModule),
        ],
        controllers: [boq_controller_1.BoqController],
        providers: [boq_service_1.BoqService, boq_import_service_1.BoqImportService],
        exports: [boq_service_1.BoqService],
    })
], BoqModule);
//# sourceMappingURL=boq.module.js.map