import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PluginController } from './plugin.controller';
import { PluginManagerService } from './plugin-manager.service';
import { PluginManifestService } from './plugin-manifest.service';
import { PluginPackage } from './entities/plugin-package.entity';
import { PluginInstall } from './entities/plugin-install.entity';
import { PluginPermission } from './entities/plugin-permission.entity';
import { PluginMenu } from './entities/plugin-menu.entity';
import { PluginPage } from './entities/plugin-page.entity';
import { PluginWidget } from './entities/plugin-widget.entity';
import { PluginReport } from './entities/plugin-report.entity';
import { PluginWorkflow } from './entities/plugin-workflow.entity';
import { PluginSetting } from './entities/plugin-setting.entity';
import { PluginAuditLog } from './entities/plugin-audit-log.entity';
import { Permission } from '../permissions/permission.entity';
import { DashboardBuilderModule } from '../dashboard-builder/dashboard-builder.module';
import { User } from '../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
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
      Permission,
      User,
    ]),
    DashboardBuilderModule,
  ],
  controllers: [PluginController],
  providers: [PluginManagerService, PluginManifestService],
  exports: [PluginManagerService],
})
export class PluginsModule {}
