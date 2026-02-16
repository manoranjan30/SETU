import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { AuthModule } from './auth/auth.module';
import { EpsModule } from './eps/eps.module';
import { User } from './users/user.entity';
import { Role } from './roles/role.entity';
import { EpsNode } from './eps/eps.entity';
import { ProjectProfile } from './eps/project-profile.entity';
import { UserRoleNodeAssignment } from './eps/user-role-node-assignment.entity';
import { PermissionsModule } from './permissions/permissions.module';
import { Permission } from './permissions/permission.entity';
import { ProjectsModule } from './projects/projects.module';
import { UserProjectAssignment } from './projects/entities/user-project-assignment.entity';
import { ProjectTeamAudit } from './projects/entities/project-team-audit.entity';
import { SeedService } from './database/seed.service';
import { WbsModule } from './wbs/wbs.module';
import { WbsNode } from './wbs/entities/wbs.entity';
import { Activity } from './wbs/entities/activity.entity';
import { ActivityRelationship } from './wbs/entities/activity-relationship.entity';
import {
  WbsTemplate,
  WbsTemplateNode,
} from './wbs/entities/wbs-template.entity';
import { WbsTemplateActivity } from './wbs/entities/wbs-template-activity.entity';
import { ActivitySchedule } from './wbs/entities/activity-schedule.entity';
import { WorkCalendar } from './wbs/entities/work-calendar.entity';
import { WorkWeek } from './wbs/entities/work-week.entity';
import { BoqModule } from './boq/boq.module';
import { CommonModule } from './common/common.module';
import { ExecutionModule } from './execution/execution.module';

import { BoqElement } from './boq/entities/boq-element.entity';
import { BoqItem } from './boq/entities/boq-item.entity';
import { MeasurementElement } from './boq/entities/measurement-element.entity';
import { MeasurementProgress } from './boq/entities/measurement-progress.entity';

import { BoqSubItem } from './boq/entities/boq-sub-item.entity';
import { TableViewConfig } from './common/entities/table-view-config.entity';
import { SystemSetting } from './common/entities/system-setting.entity';
import { PlanningModule } from './planning/planning.module';
import { BoqActivityPlan } from './planning/entities/boq-activity-plan.entity';
import { RecoveryPlan } from './planning/entities/recovery-plan.entity';
import { QuantityProgressRecord } from './planning/entities/quantity-progress-record.entity';
import { ScheduleVersion } from './planning/entities/schedule-version.entity';
import { ActivityVersion } from './planning/entities/activity-version.entity';

import { ResourcesModule } from './resources/resources.module';
import { ResourceMaster } from './resources/entities/resource-master.entity';
import { AnalysisTemplate } from './resources/entities/analysis-template.entity';
import { AnalysisCoefficient } from './resources/entities/analysis-coefficient.entity';
import { LaborModule } from './labor/labor.module';
import { LaborCategory } from './labor/entities/labor-category.entity';
import { DailyLaborPresence } from './labor/entities/daily-labor-presence.entity';
import { ActivityLaborUpdate } from './labor/entities/activity-labor-update.entity';
import { LaborExcelMapping } from './labor/entities/labor-excel-mapping.entity';
import { ProgressModule } from './progress/progress.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EhsModule } from './ehs/ehs.module';
import { EhsObservation } from './ehs/entities/ehs-observation.entity';
import { EhsIncident } from './ehs/entities/ehs-incident.entity';
import { EhsEnvironmental } from './ehs/entities/ehs-environmental.entity';
import { EhsTraining } from './ehs/entities/ehs-training.entity';
import { EhsProjectConfig } from './ehs/entities/ehs-project-config.entity';
import { EhsPerformance } from './ehs/entities/ehs-performance.entity';
import { EhsManhours } from './ehs/entities/ehs-manhours.entity';
import { EhsInspection } from './ehs/entities/ehs-inspection.entity';
import { EhsLegalRegister } from './ehs/entities/ehs-legal-register.entity';
import { EhsMachinery } from './ehs/entities/ehs-machinery.entity';
import { EhsIncidentRegister } from './ehs/entities/ehs-incident-register.entity';
import { EhsVehicle } from './ehs/entities/ehs-vehicle.entity';
import { EhsCompetency } from './ehs/entities/ehs-competency.entity';
import { QualityModule } from './quality/quality.module';
import { QualityInspection } from './quality/entities/quality-inspection.entity';
import { QualityMaterialTest } from './quality/entities/quality-material-test.entity';
import { QualityObservationNcr } from './quality/entities/quality-observation-ncr.entity';
import { QualityChecklist } from './quality/entities/quality-checklist.entity';
import { QualitySnagList } from './quality/entities/quality-snag-list.entity';
import { QualityAudit } from './quality/entities/quality-audit.entity';
import { QualityDocument } from './quality/entities/quality-document.entity';
import { DesignModule } from './design/design.module';
import { DrawingCategory } from './design/entities/drawing-category.entity';
import { DrawingRegister } from './design/entities/drawing-register.entity';
import { DrawingRevision } from './design/entities/drawing-revision.entity';
import { WorkDocModule } from './workdoc/workdoc.module';
import { Vendor } from './workdoc/entities/vendor.entity';
import { WorkOrder } from './workdoc/entities/work-order.entity';
import { WorkOrderItem } from './workdoc/entities/work-order-item.entity';
import { WorkOrderBoqMap } from './workdoc/entities/work-order-boq-map.entity';
import { WorkDocTemplate } from './workdoc/entities/work-doc-template.entity';
import { TemplateBuilderModule } from './template-builder/template-builder.module';
import { PdfTemplate } from './template-builder/entities/pdf-template.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USER || 'admin',
      password: process.env.DATABASE_PASSWORD || 'password',
      database: process.env.DATABASE_NAME || 'setu_db',
      entities: [
        User,
        Role,
        EpsNode,
        ProjectProfile,
        Permission,
        UserProjectAssignment,
        ProjectTeamAudit,
        WbsNode,
        Activity,
        ActivityRelationship,
        WbsTemplate,
        WbsTemplateNode,
        WbsTemplateActivity,
        ActivitySchedule,
        WorkCalendar,
        WorkWeek,
        BoqElement,
        BoqItem,
        BoqSubItem,
        MeasurementElement,
        MeasurementProgress,
        TableViewConfig,
        BoqActivityPlan,
        RecoveryPlan,
        ScheduleVersion,
        ActivityVersion,
        // Resources
        ResourceMaster,
        AnalysisTemplate,
        AnalysisCoefficient,
        // Labor
        LaborCategory,
        DailyLaborPresence,
        ActivityLaborUpdate,
        LaborExcelMapping,
        // EHS
        EhsObservation,
        EhsIncident,
        EhsEnvironmental,
        EhsTraining,
        EhsProjectConfig,
        EhsPerformance,
        EhsManhours,
        EhsInspection,
        EhsLegalRegister,
        EhsMachinery,
        EhsIncidentRegister,
        EhsVehicle,
        EhsCompetency,
        // Quality
        QualityInspection,
        QualityMaterialTest,
        QualityObservationNcr,
        QualityChecklist,
        QualitySnagList,
        QualityAudit,
        QualityDocument,
        // Design
        DrawingCategory,
        DrawingRegister,
        DrawingRevision,
        SystemSetting,
        // WorkDoc
        Vendor,
        WorkOrder,
        WorkOrderItem,
        WorkOrderBoqMap,
        WorkDocTemplate,
        // Template Builder
        PdfTemplate,
      ],
      synchronize: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'client'),
    }),
    UsersModule,
    RolesModule,
    AuthModule,
    EpsModule,
    PermissionsModule,
    ProjectsModule,
    WbsModule,
    BoqModule,
    ExecutionModule,
    CommonModule,
    PlanningModule,
    ResourcesModule,
    LaborModule,
    ProgressModule,
    DashboardModule,
    EhsModule,
    QualityModule,
    DesignModule,
    WorkDocModule,
    TemplateBuilderModule,
    TypeOrmModule.forFeature([
      Permission,
      Role,
      User,
      DrawingCategory,
      WorkDocTemplate,
    ]),
  ],
  controllers: [AppController],
  providers: [AppService, SeedService],
})
export class AppModule {}
