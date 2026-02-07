"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const table_view_config_entity_1 = require("./entities/table-view-config.entity");
const system_setting_entity_1 = require("./entities/system-setting.entity");
const table_view_service_1 = require("./table-view.service");
const table_view_controller_1 = require("./table-view.controller");
const system_settings_service_1 = require("./system-settings.service");
const system_settings_controller_1 = require("./system-settings.controller");
let CommonModule = class CommonModule {
};
exports.CommonModule = CommonModule;
exports.CommonModule = CommonModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([table_view_config_entity_1.TableViewConfig, system_setting_entity_1.SystemSetting])],
        providers: [table_view_service_1.TableViewService, system_settings_service_1.SystemSettingsService],
        controllers: [table_view_controller_1.TableViewController, system_settings_controller_1.SystemSettingsController],
        exports: [table_view_service_1.TableViewService, system_settings_service_1.SystemSettingsService],
    })
], CommonModule);
//# sourceMappingURL=common.module.js.map