"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanningModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const planning_controller_1 = require("./planning.controller");
const planning_service_1 = require("./planning.service");
const boq_activity_plan_entity_1 = require("./entities/boq-activity-plan.entity");
const recovery_plan_entity_1 = require("./entities/recovery-plan.entity");
const boq_item_entity_1 = require("../boq/entities/boq-item.entity");
const activity_entity_1 = require("../wbs/entities/activity.entity");
const quantity_progress_record_entity_1 = require("./entities/quantity-progress-record.entity");
const boq_sub_item_entity_1 = require("../boq/entities/boq-sub-item.entity");
const measurement_element_entity_1 = require("../boq/entities/measurement-element.entity");
const measurement_progress_entity_1 = require("../boq/entities/measurement-progress.entity");
const eps_entity_1 = require("../eps/eps.entity");
const wbs_entity_1 = require("../wbs/entities/wbs.entity");
const schedule_version_entity_1 = require("./entities/schedule-version.entity");
const activity_relationship_entity_1 = require("../wbs/entities/activity-relationship.entity");
const wbs_module_1 = require("../wbs/wbs.module");
const activity_version_entity_1 = require("./entities/activity-version.entity");
const schedule_version_service_1 = require("./schedule-version.service");
const scheduling_engine_service_1 = require("./scheduling-engine.service");
const import_export_service_1 = require("./import-export.service");
let PlanningModule = class PlanningModule {
};
exports.PlanningModule = PlanningModule;
exports.PlanningModule = PlanningModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                boq_activity_plan_entity_1.BoqActivityPlan,
                recovery_plan_entity_1.RecoveryPlan,
                quantity_progress_record_entity_1.QuantityProgressRecord,
                boq_item_entity_1.BoqItem,
                activity_entity_1.Activity,
                activity_relationship_entity_1.ActivityRelationship,
                boq_sub_item_entity_1.BoqSubItem,
                measurement_element_entity_1.MeasurementElement,
                measurement_progress_entity_1.MeasurementProgress,
                wbs_entity_1.WbsNode,
                eps_entity_1.EpsNode,
                schedule_version_entity_1.ScheduleVersion,
                activity_version_entity_1.ActivityVersion,
            ]),
            wbs_module_1.WbsModule,
        ],
        controllers: [planning_controller_1.PlanningController],
        providers: [
            planning_service_1.PlanningService,
            schedule_version_service_1.ScheduleVersionService,
            import_export_service_1.ImportExportService,
            scheduling_engine_service_1.SchedulingEngineService,
        ],
        exports: [planning_service_1.PlanningService, schedule_version_service_1.ScheduleVersionService],
    })
], PlanningModule);
//# sourceMappingURL=planning.module.js.map