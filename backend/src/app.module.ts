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
import { WoActivityPlan } from './planning/entities/wo-activity-plan.entity';
import { RecoveryPlan } from './planning/entities/recovery-plan.entity';
import { QuantityProgressRecord } from './planning/entities/quantity-progress-record.entity';
import { ScheduleVersion } from './planning/entities/schedule-version.entity';
import { ActivityVersion } from './planning/entities/activity-version.entity';
import { ReleaseStrategy } from './planning/entities/release-strategy.entity';
import { ReleaseStrategyCondition } from './planning/entities/release-strategy-condition.entity';
import { ReleaseStrategyStep } from './planning/entities/release-strategy-step.entity';
import { ReleaseStrategyVersionAudit } from './planning/entities/release-strategy-version-audit.entity';

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
import { QualityItem } from './quality/entities/quality-item.entity';
import { QualityHistory } from './quality/entities/quality-history.entity';
import { QualityAudit } from './quality/entities/quality-audit.entity';
import { QualityDocument } from './quality/entities/quality-document.entity';
import { QualitySnagPhoto } from './quality/entities/quality-snag-photo.entity';
import { QualityFloorStructure } from './quality/entities/quality-floor-structure.entity';
import { QualityUnit } from './quality/entities/quality-unit.entity';
import { QualityRoom } from './quality/entities/quality-room.entity';
import { BuildingLineCoordinate } from './planning/entities/building-line-coordinate.entity';
import { IssueTrackerDepartment } from './planning/entities/issue-tracker-department.entity';
import { IssueTrackerDeptProjectConfig } from './planning/entities/issue-tracker-dept-project-config.entity';
import { IssueTrackerTag } from './planning/entities/issue-tracker-tag.entity';
import { IssueTrackerIssue } from './planning/entities/issue-tracker-issue.entity';
import { IssueTrackerStep } from './planning/entities/issue-tracker-step.entity';
import { IssueTrackerActivityLog } from './planning/entities/issue-tracker-activity-log.entity';
import { IssueTrackerAttachment } from './planning/entities/issue-tracker-attachment.entity';
import { IssueTrackerNotification } from './planning/entities/issue-tracker-notification.entity';
import { QualityActivityList } from './quality/entities/quality-activity-list.entity';
import { QualityActivity } from './quality/entities/quality-activity.entity';
import { QualitySequenceEdge } from './quality/entities/quality-sequence-edge.entity';
import { QualityChecklistTemplate } from './quality/entities/quality-checklist-template.entity';
import { QualityStageTemplate } from './quality/entities/quality-stage-template.entity';
import { QualityChecklistItemTemplate } from './quality/entities/quality-checklist-item-template.entity';
import { QualityInspectionStage } from './quality/entities/quality-inspection-stage.entity';
import { QualityExecutionItem } from './quality/entities/quality-execution-item.entity';
import { QualitySignature } from './quality/entities/quality-signature.entity';
import { ActivityObservation } from './quality/entities/activity-observation.entity';
import { InspectionApproval } from './quality/entities/inspection-approval.entity';
import { SiteObservation } from './quality/entities/site-observation.entity';

// Workflow Designer
import { ApprovalWorkflowTemplate } from './quality/entities/approval-workflow-template.entity';
import { ApprovalWorkflowNode } from './quality/entities/approval-workflow-node.entity';
import { ApprovalWorkflowEdge } from './quality/entities/approval-workflow-edge.entity';
import { InspectionWorkflowRun } from './quality/entities/inspection-workflow-run.entity';
import { InspectionWorkflowStep } from './quality/entities/inspection-workflow-step.entity';
import { QualityRatingConfig } from './quality/entities/quality-rating-config.entity';
import { ProjectRating } from './quality/entities/quality-project-rating.entity';

import { DesignModule } from './design/design.module';
import { DrawingCategory } from './design/entities/drawing-category.entity';
import { DrawingRegister } from './design/entities/drawing-register.entity';
import { DrawingRevision } from './design/entities/drawing-revision.entity';
import { DrawingOpenReceipt } from './design/entities/drawing-open-receipt.entity';
import { WorkDocModule } from './workdoc/workdoc.module';
import { Vendor } from './workdoc/entities/vendor.entity';
import { WorkOrder } from './workdoc/entities/work-order.entity';
import { WorkOrderItem } from './workdoc/entities/work-order-item.entity';
// WorkOrderBoqMap removed — WO Items now link directly to BOQ via FKs
import { WorkDocTemplate } from './workdoc/entities/work-doc-template.entity';
import { TemplateBuilderModule } from './template-builder/template-builder.module';
import { PdfTemplate } from './template-builder/entities/pdf-template.entity';
import { MicroScheduleModule } from './micro-schedule/micro-schedule.module';
import { MicroSchedule } from './micro-schedule/entities/micro-schedule.entity';
import { MicroScheduleActivity } from './micro-schedule/entities/micro-schedule-activity.entity';
import { MicroDailyLog } from './micro-schedule/entities/micro-daily-log.entity';
import { MicroQuantityLedger } from './micro-schedule/entities/micro-quantity-ledger.entity';
import { DelayReason } from './micro-schedule/entities/delay-reason.entity';
import { AuditModule } from './audit/audit.module';
import { AuditLog } from './audit/audit-log.entity';

import { TempUserModule } from './temp-user/temp-user.module';
import { TempRoleTemplate } from './temp-user/entities/temp-role-template.entity';
import { TempUser } from './temp-user/entities/temp-user.entity';

// Dashboard Builder
import { CustomDashboard } from './dashboard-builder/entities/custom-dashboard.entity';
import { DashboardWidget } from './dashboard-builder/entities/dashboard-widget.entity';
import { DashboardAssignment } from './dashboard-builder/entities/dashboard-assignment.entity';
import { DashboardTemplate } from './dashboard-builder/entities/dashboard-template.entity';
import { CustomReport } from './dashboard-builder/entities/custom-report.entity';
import { ReportSchedule } from './dashboard-builder/entities/report-schedule.entity';
import { DataSourceMeta } from './dashboard-builder/entities/data-source-meta.entity';
import { DashboardShareLog } from './dashboard-builder/entities/dashboard-share-log.entity';
import { DashboardBuilderModule } from './dashboard-builder/dashboard-builder.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PluginsModule } from './plugins/plugins.module';
import { MilestoneModule } from './milestone/milestone.module';
import { SnagModule } from './snag/snag.module';
import { PluginPackage } from './plugins/entities/plugin-package.entity';
import { PluginInstall } from './plugins/entities/plugin-install.entity';
import { PluginPermission } from './plugins/entities/plugin-permission.entity';
import { PluginMenu } from './plugins/entities/plugin-menu.entity';
import { PluginPage } from './plugins/entities/plugin-page.entity';
import { PluginWidget } from './plugins/entities/plugin-widget.entity';
import { PluginReport } from './plugins/entities/plugin-report.entity';
import { PluginWorkflow } from './plugins/entities/plugin-workflow.entity';
import { PluginSetting } from './plugins/entities/plugin-setting.entity';
import { PluginAuditLog } from './plugins/entities/plugin-audit-log.entity';
import { CustomerMilestoneTemplate } from './milestone/entities/customer-milestone-template.entity';
import { CustomerMilestoneTemplateActivityLink } from './milestone/entities/customer-milestone-template-activity-link.entity';
import { CustomerMilestoneAchievement } from './milestone/entities/customer-milestone-achievement.entity';
import { FlatSaleInfo } from './milestone/entities/flat-sale-info.entity';
import { MilestoneCollectionTranche } from './milestone/entities/milestone-collection-tranche.entity';
import { SnagList } from './snag/entities/snag-list.entity';
import { SnagRound } from './snag/entities/snag-round.entity';
import { SnagItem } from './snag/entities/snag-item.entity';
import { SnagPhoto } from './snag/entities/snag-photo.entity';
import { SnagReleaseApproval } from './snag/entities/snag-release-approval.entity';
import { SnagReleaseApprovalStep } from './snag/entities/snag-release-approval-step.entity';
// AI Insights
import { AiInsightsModule } from './ai-insights/ai-insights.module';
import { SyncModule } from './sync/sync.module';
import { AiModelConfig } from './ai-insights/entities/ai-model-config.entity';
import { InsightTemplate } from './ai-insights/entities/insight-template.entity';
import { InsightRun } from './ai-insights/entities/insight-run.entity';
import { ExecutionProgressEntry } from './execution/entities/execution-progress-entry.entity';
import { ExecutionProgressAdjustment } from './execution/entities/execution-progress-adjustment.entity';
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
        WoActivityPlan,
        RecoveryPlan,
        ScheduleVersion,
        ActivityVersion,
        ReleaseStrategy,
        ReleaseStrategyCondition,
        ReleaseStrategyStep,
        ReleaseStrategyVersionAudit,
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
        QualityItem,
        QualityHistory,
        QualityAudit,
        QualityDocument,
        QualitySnagPhoto,
        QualityFloorStructure,
        QualityUnit,
        QualityRoom,
        BuildingLineCoordinate,
        IssueTrackerDepartment,
        IssueTrackerDeptProjectConfig,
        IssueTrackerTag,
        IssueTrackerIssue,
        IssueTrackerStep,
        IssueTrackerActivityLog,
        IssueTrackerAttachment,
        IssueTrackerNotification,
        QualityActivityList,
        QualityActivity,
        QualitySequenceEdge,
        QualityChecklistTemplate,
        QualityStageTemplate,
        QualityChecklistItemTemplate,
        QualityInspectionStage,
        QualityExecutionItem,
        QualitySignature,
        ActivityObservation,
        InspectionApproval,
        SiteObservation,
        // Workflow Designer
        ApprovalWorkflowTemplate,
        ApprovalWorkflowNode,
        ApprovalWorkflowEdge,
        InspectionWorkflowRun,
        InspectionWorkflowStep,
        QualityRatingConfig,
        ProjectRating,
        // Design
        DrawingCategory,
        DrawingRegister,
        DrawingRevision,
        DrawingOpenReceipt,
        SystemSetting,
        // WorkDoc
        Vendor,
        WorkOrder,
        WorkOrderItem,
        ExecutionProgressEntry,
        ExecutionProgressAdjustment,
        // WorkOrderBoqMap removed
        WorkDocTemplate,
        // Template Builder
        PdfTemplate,
        // Micro Schedule
        MicroSchedule,
        MicroScheduleActivity,
        MicroDailyLog,
        MicroQuantityLedger,
        DelayReason,
        QuantityProgressRecord,
        UserRoleNodeAssignment,
        AuditLog,
        TempRoleTemplate,
        TempUser,
        // Dashboard Builder
        CustomDashboard,
        DashboardWidget,
        DashboardAssignment,
        DashboardTemplate,
        CustomReport,
        ReportSchedule,
        DataSourceMeta,
        DashboardShareLog,
        PluginPackage,
        PluginInstall,
        PluginPermission,
        PluginMenu,
        PluginPage,
        PluginWidget,
        PluginReport,
        PluginWorkflow,
        PluginSetting,
        PluginAuditLog,
        CustomerMilestoneTemplate,
        CustomerMilestoneTemplateActivityLink,
        CustomerMilestoneAchievement,
        FlatSaleInfo,
        MilestoneCollectionTranche,
        SnagList,
        SnagRound,
        SnagItem,
        SnagPhoto,
        SnagReleaseApproval,
        SnagReleaseApprovalStep,
        // AI Insights
        AiModelConfig,
        InsightTemplate,
        InsightRun,
      ],
      synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
      migrationsRun: process.env.TYPEORM_MIGRATIONS_RUN === 'true',
    }),
    ServeStaticModule.forRoot(
      {
        rootPath: join(process.cwd(), 'client'),
      },
      {
        rootPath: join(process.cwd(), 'uploads'),
        serveRoot: '/uploads',
      },
    ),
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
    MicroScheduleModule,
    AuditModule,
    TempUserModule,
    DashboardBuilderModule,
    NotificationsModule,
    PluginsModule,
    MilestoneModule,
    SnagModule,
    AiInsightsModule,
    SyncModule,
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
