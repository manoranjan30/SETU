import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { PermissionsModule } from '../permissions/permissions.module';
import { LocalStrategy } from './local.strategy';
import { ProjectsModule } from '../projects/projects.module';
import { TempUser } from '../temp-user/entities/temp-user.entity';
import { Role } from '../roles/role.entity';
import { AuthOtpChallenge } from './entities/auth-otp-challenge.entity';
import { EmailDeliveryService } from './email-delivery.service';
import { SystemSetting } from '../common/entities/system-setting.entity';
import { SystemSettingsService } from '../common/system-settings.service';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    PermissionsModule,
    ProjectsModule,
    TypeOrmModule.forFeature([
      TempUser,
      Role,
      AuthOtpChallenge,
      SystemSetting,
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'supersecretkey',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    EmailDeliveryService,
    SystemSettingsService,
  ],
  controllers: [AuthController],
  exports: [AuthService, EmailDeliveryService],
})
export class AuthModule {}
