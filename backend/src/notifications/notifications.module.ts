import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { UserProjectAssignment } from '../projects/entities/user-project-assignment.entity';
import { PushNotificationService } from './push-notification.service';
import { PendingTasksService } from './pending-tasks.service';
import { PendingTasksController } from './pending-tasks.controller';
import { QualityInspection } from '../quality/entities/quality-inspection.entity';
import { InspectionWorkflowStep } from '../quality/entities/inspection-workflow-step.entity';
import { ActivityObservation } from '../quality/entities/activity-observation.entity';
import { QualityMaterialApprovalRun } from '../quality/entities/quality-material-approval-run.entity';
import { QualityMaterialApprovalStep } from '../quality/entities/quality-material-approval-step.entity';
import { QualityMaterialTestObligation } from '../quality/entities/quality-material-test-obligation.entity';
import { TempUser } from '../temp-user/entities/temp-user.entity';
import { Role } from '../roles/role.entity';
import { EpsNode } from '../eps/eps.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { NotificationContextService } from './notification-context.service';
import { NotificationComposerService } from './notification-composer.service';
import { NotificationLog } from './notification-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserProjectAssignment,
      NotificationLog,
      QualityInspection,
      InspectionWorkflowStep,
      ActivityObservation,
      QualityMaterialApprovalRun,
      QualityMaterialApprovalStep,
      QualityMaterialTestObligation,
      TempUser,
      Role,
      EpsNode,
      Activity,
    ]),
  ],
  providers: [
    PushNotificationService,
    PendingTasksService,
    NotificationContextService,
    NotificationComposerService,
  ],
  controllers: [PendingTasksController],
  exports: [
    PushNotificationService,
    PendingTasksService,
    NotificationContextService,
    NotificationComposerService,
  ],
})
export class NotificationsModule {}
