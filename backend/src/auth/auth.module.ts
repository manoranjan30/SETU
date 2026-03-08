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

@Module({
  imports: [
    UsersModule,
    PassportModule,
    PermissionsModule,
    ProjectsModule,
    TypeOrmModule.forFeature([TempUser]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'supersecretkey',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
