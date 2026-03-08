import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { UserProjectAssignment } from '../projects/entities/user-project-assignment.entity';
import { PushNotificationService } from './push-notification.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserProjectAssignment])],
  providers: [PushNotificationService],
  exports: [PushNotificationService],
})
export class NotificationsModule {}
