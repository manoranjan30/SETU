"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const progress_controller_1 = require("./progress.controller");
const progress_service_1 = require("./progress.service");
const measurement_progress_entity_1 = require("../boq/entities/measurement-progress.entity");
const measurement_element_entity_1 = require("../boq/entities/measurement-element.entity");
const boq_item_entity_1 = require("../boq/entities/boq-item.entity");
const boq_activity_plan_entity_1 = require("../planning/entities/boq-activity-plan.entity");
let ProgressModule = class ProgressModule {
};
exports.ProgressModule = ProgressModule;
exports.ProgressModule = ProgressModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                measurement_progress_entity_1.MeasurementProgress,
                measurement_element_entity_1.MeasurementElement,
                boq_item_entity_1.BoqItem,
                boq_activity_plan_entity_1.BoqActivityPlan,
            ]),
        ],
        controllers: [progress_controller_1.ProgressController],
        providers: [progress_service_1.ProgressService],
        exports: [progress_service_1.ProgressService],
    })
], ProgressModule);
//# sourceMappingURL=progress.module.js.map