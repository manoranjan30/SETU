import { IsString, IsEnum, IsOptional, IsNumber } from 'class-validator';
import { ActivityType, ActivityStatus } from '../entities/activity.entity';

export class CreateActivityDto {
  @IsString()
  activityCode: string;

  @IsString()
  activityName: string;

  @IsEnum(ActivityType)
  activityType: ActivityType;

  @IsOptional()
  @IsNumber()
  responsibleRoleId?: number;

  @IsOptional()
  @IsNumber()
  responsibleUserId?: number;
}

export class UpdateActivityDto {
  @IsOptional()
  @IsString()
  activityName?: string;

  @IsOptional()
  @IsEnum(ActivityType)
  activityType?: ActivityType;

  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;

  @IsOptional()
  @IsNumber()
  responsibleRoleId?: number;

  @IsOptional()
  @IsNumber()
  responsibleUserId?: number;
}
