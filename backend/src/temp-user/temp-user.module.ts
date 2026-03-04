import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { TempRoleTemplate } from './entities/temp-role-template.entity';
import { TempUser } from './entities/temp-user.entity';
import { TempRoleService } from './temp-role.service';
import { TempRoleController } from './temp-role.controller';
import { TempUserService } from './temp-user.service';
import { TempUserController } from './temp-user.controller';
import { TempUserExpiryCron } from './temp-user-expiry.cron';
import { TempUserAuthGuard } from './temp-user-auth.guard';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { Vendor } from '../workdoc/entities/vendor.entity';
import { WorkOrder } from '../workdoc/entities/work-order.entity';
import { Permission } from '../permissions/permission.entity';
import { ProjectsModule } from '../projects/projects.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TempRoleTemplate,
      TempUser,
      User,
      Role,
      Vendor,
      WorkOrder,
      Permission,
    ]),
    ScheduleModule.forRoot(),
    forwardRef(() => ProjectsModule),
    forwardRef(() => AuditModule),
  ],
  providers: [
    TempRoleService,
    TempUserService,
    TempUserExpiryCron,
    TempUserAuthGuard,
  ],
  controllers: [TempRoleController, TempUserController],
  exports: [TempUserService, TempRoleService, TempUserAuthGuard],
})
export class TempUserModule {}
