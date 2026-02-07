"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EhsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const ehs_controller_1 = require("./ehs.controller");
const ehs_service_1 = require("./ehs.service");
const ehs_observation_entity_1 = require("./entities/ehs-observation.entity");
const ehs_incident_entity_1 = require("./entities/ehs-incident.entity");
const ehs_training_entity_1 = require("./entities/ehs-training.entity");
const ehs_environmental_entity_1 = require("./entities/ehs-environmental.entity");
const ehs_project_config_entity_1 = require("./entities/ehs-project-config.entity");
const ehs_performance_entity_1 = require("./entities/ehs-performance.entity");
const ehs_manhours_entity_1 = require("./entities/ehs-manhours.entity");
const ehs_inspection_entity_1 = require("./entities/ehs-inspection.entity");
const ehs_legal_register_entity_1 = require("./entities/ehs-legal-register.entity");
const ehs_machinery_entity_1 = require("./entities/ehs-machinery.entity");
const ehs_incident_register_entity_1 = require("./entities/ehs-incident-register.entity");
const ehs_vehicle_entity_1 = require("./entities/ehs-vehicle.entity");
const ehs_competency_entity_1 = require("./entities/ehs-competency.entity");
const eps_entity_1 = require("../eps/eps.entity");
const daily_labor_presence_entity_1 = require("../labor/entities/daily-labor-presence.entity");
let EhsModule = class EhsModule {
};
exports.EhsModule = EhsModule;
exports.EhsModule = EhsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                ehs_observation_entity_1.EhsObservation,
                ehs_incident_entity_1.EhsIncident,
                ehs_training_entity_1.EhsTraining,
                ehs_environmental_entity_1.EhsEnvironmental,
                ehs_project_config_entity_1.EhsProjectConfig,
                ehs_performance_entity_1.EhsPerformance,
                ehs_manhours_entity_1.EhsManhours,
                ehs_inspection_entity_1.EhsInspection,
                ehs_legal_register_entity_1.EhsLegalRegister,
                ehs_machinery_entity_1.EhsMachinery,
                ehs_incident_register_entity_1.EhsIncidentRegister,
                ehs_vehicle_entity_1.EhsVehicle,
                ehs_competency_entity_1.EhsCompetency,
                eps_entity_1.EpsNode,
                daily_labor_presence_entity_1.DailyLaborPresence,
            ]),
        ],
        controllers: [ehs_controller_1.EhsController],
        providers: [ehs_service_1.EhsService],
        exports: [ehs_service_1.EhsService],
    })
], EhsModule);
//# sourceMappingURL=ehs.module.js.map