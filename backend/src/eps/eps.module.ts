import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EpsController } from './eps.controller';

import { EpsService } from './eps.service';
import { EpsNode } from './eps.entity';
import { ProjectProfile } from './project-profile.entity';
import { PermissionsModule } from '../permissions/permissions.module';
import { UserRoleNodeAssignment } from './user-role-node-assignment.entity';
import { UserProjectAssignment } from '../projects/entities/user-project-assignment.entity';
import { User } from '../users/user.entity';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EpsNode,
      ProjectProfile,
      UserRoleNodeAssignment,
      User,
      UserProjectAssignment,
    ]),
    PermissionsModule,
    ProjectsModule,
  ],
  controllers: [EpsController],
  providers: [EpsService],
  exports: [EpsService],
})
export class EpsModule { }

