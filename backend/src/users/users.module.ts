import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './user.entity';
import { TempUser } from '../temp-user/entities/temp-user.entity';
import { Permission } from '../permissions/permission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, TempUser, Permission])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
