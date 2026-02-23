import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProjectAssignment } from './entities/user-project-assignment.entity';
import { ProjectTeamAudit } from './entities/project-team-audit.entity';
import { User } from '../users/user.entity';
import { EpsNode } from '../eps/eps.entity';
import { Role } from '../roles/role.entity';
import { ProjectAssignmentService } from './project-assignment.service';
import { PermissionResolutionService } from './permission-resolution.service';
import { ProjectsController } from './projects.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserProjectAssignment,
      ProjectTeamAudit,
      User,
      EpsNode,
      Role,
    ]),
  ],
  exports: [
    TypeOrmModule,
    ProjectAssignmentService,
    PermissionResolutionService,
  ],
  providers: [ProjectAssignmentService, PermissionResolutionService],
  controllers: [ProjectsController],
})
export class ProjectsModule { }
