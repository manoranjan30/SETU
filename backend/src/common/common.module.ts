import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TableViewConfig } from './entities/table-view-config.entity';
import { SystemSetting } from './entities/system-setting.entity';
import { TableViewService } from './table-view.service';
import { TableViewController } from './table-view.controller';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingsController } from './system-settings.controller';
import { UploadController } from './upload.controller';
import { ApprovalRuntimeService } from './approval-runtime.service';
import { AdminIssueTrackerController } from './admin-issue-tracker.controller';
import { PlanningModule } from '../planning/planning.module';
import { User } from '../users/user.entity';

@Module({
  imports: [
    PlanningModule,
    TypeOrmModule.forFeature([TableViewConfig, SystemSetting, User]),
  ],
  providers: [TableViewService, SystemSettingsService, ApprovalRuntimeService],
  controllers: [
    TableViewController,
    SystemSettingsController,
    UploadController,
    AdminIssueTrackerController,
  ],
  exports: [TableViewService, SystemSettingsService, ApprovalRuntimeService],
})
export class CommonModule {}
