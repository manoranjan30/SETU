"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const execution_controller_1 = require("./execution.controller");
const execution_service_1 = require("./execution.service");
const execution_breakdown_service_1 = require("./execution-breakdown.service");
const progress_validation_service_1 = require("./progress-validation.service");
const boq_module_1 = require("../boq/boq.module");
const activity_entity_1 = require("../wbs/entities/activity.entity");
const boq_activity_plan_entity_1 = require("../planning/entities/boq-activity-plan.entity");
const boq_item_entity_1 = require("../boq/entities/boq-item.entity");
const measurement_progress_entity_1 = require("../boq/entities/measurement-progress.entity");
const measurement_element_entity_1 = require("../boq/entities/measurement-element.entity");
const micro_schedule_activity_entity_1 = require("../micro-schedule/entities/micro-schedule-activity.entity");
const micro_daily_log_entity_1 = require("../micro-schedule/entities/micro-daily-log.entity");
const micro_quantity_ledger_entity_1 = require("../micro-schedule/entities/micro-quantity-ledger.entity");
const eps_entity_1 = require("../eps/eps.entity");
let ExecutionModule = class ExecutionModule {
};
exports.ExecutionModule = ExecutionModule;
exports.ExecutionModule = ExecutionModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                activity_entity_1.Activity,
                boq_activity_plan_entity_1.BoqActivityPlan,
                boq_item_entity_1.BoqItem,
                measurement_progress_entity_1.MeasurementProgress,
                measurement_element_entity_1.MeasurementElement,
                micro_schedule_activity_entity_1.MicroScheduleActivity,
                micro_daily_log_entity_1.MicroDailyLog,
                micro_quantity_ledger_entity_1.MicroQuantityLedger,
                eps_entity_1.EpsNode,
            ]),
            boq_module_1.BoqModule,
        ],
        controllers: [execution_controller_1.ExecutionController],
        providers: [
            execution_service_1.ExecutionService,
            execution_breakdown_service_1.ExecutionBreakdownService,
            progress_validation_service_1.ProgressValidationService,
        ],
    })
], ExecutionModule);
//# sourceMappingURL=execution.module.js.map