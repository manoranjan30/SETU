import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';
import { WoActivityPlan } from './entities/wo-activity-plan.entity';
import { RecoveryPlan } from './entities/recovery-plan.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { QuantityProgressRecord } from './entities/quantity-progress-record.entity';
import { BoqSubItem } from '../boq/entities/boq-sub-item.entity';
import { MeasurementElement } from '../boq/entities/measurement-element.entity';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { EpsNode } from '../eps/eps.entity';
import { WbsNode } from '../wbs/entities/wbs.entity';
import { ScheduleVersion } from './entities/schedule-version.entity';
import { ActivityRelationship } from '../wbs/entities/activity-relationship.entity';
import { WbsModule } from '../wbs/wbs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityVersion } from './entities/activity-version.entity';
import { ScheduleVersionService } from './schedule-version.service';
import { SchedulingEngineService } from './scheduling-engine.service';
import { ImportExportService } from './import-export.service';
import { WorkOrderItem } from '../workdoc/entities/work-order-item.entity';
import { WorkOrder } from '../workdoc/entities/work-order.entity';
import { Vendor } from '../workdoc/entities/vendor.entity';
import { ReleaseStrategy } from './entities/release-strategy.entity';
import { ReleaseStrategyCondition } from './entities/release-strategy-condition.entity';
import { ReleaseStrategyStep } from './entities/release-strategy-step.entity';
import { ReleaseStrategyVersionAudit } from './entities/release-strategy-version-audit.entity';
import { UserProjectAssignment } from '../projects/entities/user-project-assignment.entity';
import { TempUser } from '../temp-user/entities/temp-user.entity';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { ReleaseStrategyService } from './release-strategy.service';
import { TowerProgressService } from './tower-progress.service';
import { BuildingLineCoordinate } from './entities/building-line-coordinate.entity';
import { BuildingLineCoordinateService } from './building-line-coordinate.service';
import { QualityFloorStructure } from '../quality/entities/quality-floor-structure.entity';
import { QualityUnit } from '../quality/entities/quality-unit.entity';
import { QualityRoom } from '../quality/entities/quality-room.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WoActivityPlan,
      RecoveryPlan,
      QuantityProgressRecord,
      BoqItem,
      Activity,
      ActivityRelationship,
      BoqSubItem,
      MeasurementElement,
      MeasurementProgress,
      WbsNode,
      EpsNode,
      ScheduleVersion,
      ActivityVersion,
      WorkOrderItem,
      WorkOrder,
      Vendor,
      ReleaseStrategy,
      ReleaseStrategyCondition,
      ReleaseStrategyStep,
      ReleaseStrategyVersionAudit,
      UserProjectAssignment,
      TempUser,
      User,
      Role,
      BuildingLineCoordinate,
      QualityFloorStructure,
      QualityUnit,
      QualityRoom,
    ]),
    WbsModule,
    NotificationsModule,
  ],
  controllers: [PlanningController],
  providers: [
    PlanningService,
    ScheduleVersionService,
    ImportExportService,
    SchedulingEngineService,
    ReleaseStrategyService,
    TowerProgressService,
    BuildingLineCoordinateService,
  ],
  exports: [PlanningService, ScheduleVersionService, ReleaseStrategyService, TowerProgressService, BuildingLineCoordinateService],
})
export class PlanningModule {}
