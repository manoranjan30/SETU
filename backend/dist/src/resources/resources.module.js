"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourcesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const resources_controller_1 = require("./resources.controller");
const resources_service_1 = require("./resources.service");
const resource_master_entity_1 = require("./entities/resource-master.entity");
const analysis_template_entity_1 = require("./entities/analysis-template.entity");
const analysis_coefficient_entity_1 = require("./entities/analysis-coefficient.entity");
const boq_item_entity_1 = require("../boq/entities/boq-item.entity");
let ResourcesModule = class ResourcesModule {
};
exports.ResourcesModule = ResourcesModule;
exports.ResourcesModule = ResourcesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                resource_master_entity_1.ResourceMaster,
                analysis_template_entity_1.AnalysisTemplate,
                analysis_coefficient_entity_1.AnalysisCoefficient,
                boq_item_entity_1.BoqItem,
            ]),
        ],
        controllers: [resources_controller_1.ResourcesController],
        providers: [resources_service_1.ResourcesService],
        exports: [resources_service_1.ResourcesService],
    })
], ResourcesModule);
//# sourceMappingURL=resources.module.js.map