"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WbsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const wbs_service_1 = require("./wbs.service");
const wbs_controller_1 = require("./wbs.controller");
const wbs_template_controller_1 = require("./wbs-template.controller");
const wbs_entity_1 = require("./entities/wbs.entity");
const projects_module_1 = require("../projects/projects.module");
const auth_module_1 = require("../auth/auth.module");
const project_profile_entity_1 = require("../eps/project-profile.entity");
const activity_entity_1 = require("./entities/activity.entity");
const activity_relationship_entity_1 = require("./entities/activity-relationship.entity");
const wbs_template_entity_1 = require("./entities/wbs-template.entity");
const wbs_import_service_1 = require("./wbs-import.service");
const schedule_import_service_1 = require("./schedule-import.service");
const wbs_template_activity_entity_1 = require("./entities/wbs-template-activity.entity");
const cpm_service_1 = require("./cpm.service");
const activity_schedule_entity_1 = require("./entities/activity-schedule.entity");
const work_calendar_entity_1 = require("./entities/work-calendar.entity");
const work_week_entity_1 = require("./entities/work-week.entity");
const schedule_controller_1 = require("./schedule.controller");
const calendars_controller_1 = require("./calendars.controller");
let WbsModule = class WbsModule {
};
exports.WbsModule = WbsModule;
exports.WbsModule = WbsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                wbs_entity_1.WbsNode,
                project_profile_entity_1.ProjectProfile,
                activity_entity_1.Activity,
                activity_relationship_entity_1.ActivityRelationship,
                wbs_template_entity_1.WbsTemplate,
                wbs_template_entity_1.WbsTemplateNode,
                wbs_template_activity_entity_1.WbsTemplateActivity,
                activity_schedule_entity_1.ActivitySchedule,
                work_calendar_entity_1.WorkCalendar,
                work_week_entity_1.WorkWeek,
            ]),
            projects_module_1.ProjectsModule,
            auth_module_1.AuthModule,
        ],
        controllers: [
            wbs_controller_1.WbsController,
            wbs_template_controller_1.WbsTemplateController,
            schedule_controller_1.ScheduleController,
            calendars_controller_1.CalendarsController,
        ],
        providers: [wbs_service_1.WbsService, wbs_import_service_1.WbsImportService, cpm_service_1.CpmService, schedule_import_service_1.ScheduleImportService],
        exports: [wbs_service_1.WbsService, cpm_service_1.CpmService, schedule_import_service_1.ScheduleImportService],
    })
], WbsModule);
//# sourceMappingURL=wbs.module.js.map