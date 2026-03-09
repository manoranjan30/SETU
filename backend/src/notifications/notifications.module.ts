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
import { TempUser } from '../temp-user/entities/temp-user.entity';
import { Role } from '../roles/role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserProjectAssignment,
      QualityInspection,
      InspectionWorkflowStep,
      ActivityObservation,
      TempUser,
      Role,
    ]),
  ],
  providers: [PushNotificationService, PendingTasksService],
  controllers: [PendingTasksController],
  exports: [PushNotificationService, PendingTasksService],
})
export class NotificationsModule {}
