import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TableViewConfig } from './entities/table-view-config.entity';
import { SystemSetting } from './entities/system-setting.entity';
import { TableViewService } from './table-view.service';
import { TableViewController } from './table-view.controller';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingsController } from './system-settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TableViewConfig, SystemSetting])],
  providers: [TableViewService, SystemSettingsService],
  controllers: [TableViewController, SystemSettingsController],
  exports: [TableViewService, SystemSettingsService],
})
export class CommonModule { }
