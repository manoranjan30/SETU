import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TableViewConfig } from './entities/table-view-config.entity';
import { SystemSetting } from './entities/system-setting.entity';
import { ExportPreset } from './entities/export-preset.entity';
import { ExportHistory } from './entities/export-history.entity';
import { TableViewService } from './table-view.service';
import { TableViewController } from './table-view.controller';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingsController } from './system-settings.controller';
import { ExportPresetService } from './export-preset.service';
import { ExportPresetController } from './export-preset.controller';
import { ExportHistoryService } from './export-history.service';
import { ExportHistoryController } from './export-history.controller';
import { UploadController } from './upload.controller';
import { ApprovalRuntimeService } from './approval-runtime.service';
import { AdminIssueTrackerController } from './admin-issue-tracker.controller';
import { PlanningModule } from '../planning/planning.module';
import { User } from '../users/user.entity';
import { EpsNode } from '../eps/eps.entity';

@Module({
  imports: [
    PlanningModule,
    TypeOrmModule.forFeature([
      TableViewConfig,
      SystemSetting,
      ExportPreset,
      ExportHistory,
      User,
      EpsNode,
    ]),
  ],
  providers: [
    TableViewService,
    SystemSettingsService,
    ApprovalRuntimeService,
    ExportPresetService,
    ExportHistoryService,
  ],
  controllers: [
    TableViewController,
    SystemSettingsController,
    ExportPresetController,
    ExportHistoryController,
    UploadController,
    AdminIssueTrackerController,
  ],
  exports: [
    TableViewService,
    SystemSettingsService,
    ApprovalRuntimeService,
    ExportPresetService,
    ExportHistoryService,
  ],
})
export class CommonModule {}
