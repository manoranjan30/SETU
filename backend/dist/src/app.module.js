"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const serve_static_1 = require("@nestjs/serve-static");
const path_1 = require("path");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const users_module_1 = require("./users/users.module");
const roles_module_1 = require("./roles/roles.module");
const auth_module_1 = require("./auth/auth.module");
const eps_module_1 = require("./eps/eps.module");
const user_entity_1 = require("./users/user.entity");
const role_entity_1 = require("./roles/role.entity");
const eps_entity_1 = require("./eps/eps.entity");
const project_profile_entity_1 = require("./eps/project-profile.entity");
const permissions_module_1 = require("./permissions/permissions.module");
const permission_entity_1 = require("./permissions/permission.entity");
const projects_module_1 = require("./projects/projects.module");
const user_project_assignment_entity_1 = require("./projects/entities/user-project-assignment.entity");
const project_team_audit_entity_1 = require("./projects/entities/project-team-audit.entity");
const seed_service_1 = require("./database/seed.service");
const wbs_module_1 = require("./wbs/wbs.module");
const wbs_entity_1 = require("./wbs/entities/wbs.entity");
const activity_entity_1 = require("./wbs/entities/activity.entity");
const activity_relationship_entity_1 = require("./wbs/entities/activity-relationship.entity");
const wbs_template_entity_1 = require("./wbs/entities/wbs-template.entity");
const wbs_template_activity_entity_1 = require("./wbs/entities/wbs-template-activity.entity");
const activity_schedule_entity_1 = require("./wbs/entities/activity-schedule.entity");
const work_calendar_entity_1 = require("./wbs/entities/work-calendar.entity");
const work_week_entity_1 = require("./wbs/entities/work-week.entity");
const boq_module_1 = require("./boq/boq.module");
const common_module_1 = require("./common/common.module");
const execution_module_1 = require("./execution/execution.module");
const boq_element_entity_1 = require("./boq/entities/boq-element.entity");
const boq_item_entity_1 = require("./boq/entities/boq-item.entity");
const measurement_element_entity_1 = require("./boq/entities/measurement-element.entity");
const measurement_progress_entity_1 = require("./boq/entities/measurement-progress.entity");
const boq_sub_item_entity_1 = require("./boq/entities/boq-sub-item.entity");
const table_view_config_entity_1 = require("./common/entities/table-view-config.entity");
const planning_module_1 = require("./planning/planning.module");
const boq_activity_plan_entity_1 = require("./planning/entities/boq-activity-plan.entity");
const recovery_plan_entity_1 = require("./planning/entities/recovery-plan.entity");
const schedule_version_entity_1 = require("./planning/entities/schedule-version.entity");
const activity_version_entity_1 = require("./planning/entities/activity-version.entity");
const resources_module_1 = require("./resources/resources.module");
const resource_master_entity_1 = require("./resources/entities/resource-master.entity");
const analysis_template_entity_1 = require("./resources/entities/analysis-template.entity");
const analysis_coefficient_entity_1 = require("./resources/entities/analysis-coefficient.entity");
const labor_module_1 = require("./labor/labor.module");
const labor_category_entity_1 = require("./labor/entities/labor-category.entity");
const daily_labor_presence_entity_1 = require("./labor/entities/daily-labor-presence.entity");
const activity_labor_update_entity_1 = require("./labor/entities/activity-labor-update.entity");
const labor_excel_mapping_entity_1 = require("./labor/entities/labor-excel-mapping.entity");
const progress_module_1 = require("./progress/progress.module");
const dashboard_module_1 = require("./dashboard/dashboard.module");
const ehs_module_1 = require("./ehs/ehs.module");
const ehs_observation_entity_1 = require("./ehs/entities/ehs-observation.entity");
const ehs_incident_entity_1 = require("./ehs/entities/ehs-incident.entity");
const ehs_environmental_entity_1 = require("./ehs/entities/ehs-environmental.entity");
const ehs_training_entity_1 = require("./ehs/entities/ehs-training.entity");
const ehs_project_config_entity_1 = require("./ehs/entities/ehs-project-config.entity");
const ehs_performance_entity_1 = require("./ehs/entities/ehs-performance.entity");
const ehs_manhours_entity_1 = require("./ehs/entities/ehs-manhours.entity");
const ehs_inspection_entity_1 = require("./ehs/entities/ehs-inspection.entity");
const ehs_legal_register_entity_1 = require("./ehs/entities/ehs-legal-register.entity");
const ehs_machinery_entity_1 = require("./ehs/entities/ehs-machinery.entity");
const ehs_incident_register_entity_1 = require("./ehs/entities/ehs-incident-register.entity");
const ehs_vehicle_entity_1 = require("./ehs/entities/ehs-vehicle.entity");
const ehs_competency_entity_1 = require("./ehs/entities/ehs-competency.entity");
const quality_module_1 = require("./quality/quality.module");
const quality_inspection_entity_1 = require("./quality/entities/quality-inspection.entity");
const quality_material_test_entity_1 = require("./quality/entities/quality-material-test.entity");
const quality_observation_ncr_entity_1 = require("./quality/entities/quality-observation-ncr.entity");
const quality_checklist_entity_1 = require("./quality/entities/quality-checklist.entity");
const quality_snag_list_entity_1 = require("./quality/entities/quality-snag-list.entity");
const quality_audit_entity_1 = require("./quality/entities/quality-audit.entity");
const quality_document_entity_1 = require("./quality/entities/quality-document.entity");
const design_module_1 = require("./design/design.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRoot({
                type: 'postgres',
                host: process.env.DATABASE_HOST || 'localhost',
                port: parseInt(process.env.DATABASE_PORT || '5432', 10),
                username: process.env.DATABASE_USER || 'admin',
                password: process.env.DATABASE_PASSWORD || 'password',
                database: process.env.DATABASE_NAME || 'setu_db',
                entities: [
                    user_entity_1.User,
                    role_entity_1.Role,
                    eps_entity_1.EpsNode,
                    project_profile_entity_1.ProjectProfile,
                    permission_entity_1.Permission,
                    user_project_assignment_entity_1.UserProjectAssignment,
                    project_team_audit_entity_1.ProjectTeamAudit,
                    wbs_entity_1.WbsNode,
                    activity_entity_1.Activity,
                    activity_relationship_entity_1.ActivityRelationship,
                    wbs_template_entity_1.WbsTemplate,
                    wbs_template_entity_1.WbsTemplateNode,
                    wbs_template_activity_entity_1.WbsTemplateActivity,
                    activity_schedule_entity_1.ActivitySchedule,
                    work_calendar_entity_1.WorkCalendar,
                    work_week_entity_1.WorkWeek,
                    boq_element_entity_1.BoqElement,
                    boq_item_entity_1.BoqItem,
                    boq_sub_item_entity_1.BoqSubItem,
                    measurement_element_entity_1.MeasurementElement,
                    measurement_progress_entity_1.MeasurementProgress,
                    table_view_config_entity_1.TableViewConfig,
                    boq_activity_plan_entity_1.BoqActivityPlan,
                    recovery_plan_entity_1.RecoveryPlan,
                    schedule_version_entity_1.ScheduleVersion,
                    activity_version_entity_1.ActivityVersion,
                    resource_master_entity_1.ResourceMaster,
                    analysis_template_entity_1.AnalysisTemplate,
                    analysis_coefficient_entity_1.AnalysisCoefficient,
                    labor_category_entity_1.LaborCategory,
                    daily_labor_presence_entity_1.DailyLaborPresence,
                    activity_labor_update_entity_1.ActivityLaborUpdate,
                    labor_excel_mapping_entity_1.LaborExcelMapping,
                    ehs_observation_entity_1.EhsObservation,
                    ehs_incident_entity_1.EhsIncident,
                    ehs_environmental_entity_1.EhsEnvironmental,
                    ehs_training_entity_1.EhsTraining,
                    ehs_training_entity_1.EhsTraining,
                    ehs_project_config_entity_1.EhsProjectConfig,
                    ehs_performance_entity_1.EhsPerformance,
                    ehs_manhours_entity_1.EhsManhours,
                    ehs_inspection_entity_1.EhsInspection,
                    ehs_legal_register_entity_1.EhsLegalRegister,
                    ehs_machinery_entity_1.EhsMachinery,
                    ehs_incident_register_entity_1.EhsIncidentRegister,
                    ehs_vehicle_entity_1.EhsVehicle,
                    ehs_competency_entity_1.EhsCompetency,
                    quality_inspection_entity_1.QualityInspection,
                    quality_material_test_entity_1.QualityMaterialTest,
                    quality_observation_ncr_entity_1.QualityObservationNcr,
                    quality_checklist_entity_1.QualityChecklist,
                    quality_snag_list_entity_1.QualitySnagList,
                    quality_audit_entity_1.QualityAudit,
                    quality_document_entity_1.QualityDocument,
                ],
                synchronize: true,
            }),
            serve_static_1.ServeStaticModule.forRoot({
                rootPath: (0, path_1.join)(__dirname, '..', 'client'),
            }),
            users_module_1.UsersModule,
            roles_module_1.RolesModule,
            auth_module_1.AuthModule,
            eps_module_1.EpsModule,
            permissions_module_1.PermissionsModule,
            projects_module_1.ProjectsModule,
            wbs_module_1.WbsModule,
            boq_module_1.BoqModule,
            execution_module_1.ExecutionModule,
            common_module_1.CommonModule,
            planning_module_1.PlanningModule,
            resources_module_1.ResourcesModule,
            labor_module_1.LaborModule,
            progress_module_1.ProgressModule,
            dashboard_module_1.DashboardModule,
            ehs_module_1.EhsModule,
            quality_module_1.QualityModule,
            design_module_1.DesignModule,
            typeorm_1.TypeOrmModule.forFeature([permission_entity_1.Permission, role_entity_1.Role, user_entity_1.User]),
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService, seed_service_1.SeedService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map