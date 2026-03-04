import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardBuilderService } from './dashboard-builder.service';
import { DashboardBuilderController } from './dashboard-builder.controller';
import { DataSourceRegistryService } from './data-source-registry.service';
import { QueryExecutorService } from './query-executor.service';

// Dashboard Builder entities
import { CustomDashboard } from './entities/custom-dashboard.entity';
import { DashboardWidget } from './entities/dashboard-widget.entity';
import { DashboardAssignment } from './entities/dashboard-assignment.entity';
import { DashboardTemplate } from './entities/dashboard-template.entity';
import { CustomReport } from './entities/custom-report.entity';
import { ReportSchedule } from './entities/report-schedule.entity';
import { DataSourceMeta } from './entities/data-source-meta.entity';
import { DashboardShareLog } from './entities/dashboard-share-log.entity';

// External entities needed by data sources
import { Activity } from '../wbs/entities/activity.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { DailyLaborPresence } from '../labor/entities/daily-labor-presence.entity';
import { QuantityProgressRecord } from '../planning/entities/quantity-progress-record.entity';
import { EpsNode } from '../eps/eps.entity';

// Data Sources
import { ALL_DATA_SOURCES } from './data-sources';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Dashboard Builder entities
      CustomDashboard,
      DashboardWidget,
      DashboardAssignment,
      DashboardTemplate,
      CustomReport,
      ReportSchedule,
      DataSourceMeta,
      DashboardShareLog,
      // External entities for data sources
      Activity,
      BoqItem,
      DailyLaborPresence,
      QuantityProgressRecord,
      EpsNode,
    ]),
  ],
  controllers: [DashboardBuilderController],
  providers: [
    DashboardBuilderService,
    DataSourceRegistryService,
    QueryExecutorService,
    ...ALL_DATA_SOURCES,
  ],
  exports: [
    DashboardBuilderService,
    DataSourceRegistryService,
    QueryExecutorService,
  ],
})
export class DashboardBuilderModule { }
