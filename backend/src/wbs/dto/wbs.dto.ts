import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { WbsStatus } from '../entities/wbs.entity';

export class CreateWbsDto {
  @IsOptional()
  @IsNumber()
  parentId?: number;

  @IsString()
  wbsName: string;

  @IsOptional()
  @IsString()
  discipline?: string;

  @IsOptional()
  @IsBoolean()
  isControlAccount?: boolean;

  @IsOptional()
  @IsNumber()
  responsibleRoleId?: number;

  @IsOptional()
  @IsNumber()
  responsibleUserId?: number;
}

export class UpdateWbsDto {
  @IsOptional()
  @IsString()
  wbsName?: string;

  @IsOptional()
  @IsString()
  discipline?: string;

  @IsOptional()
  @IsBoolean()
  isControlAccount?: boolean;

  @IsOptional()
  @IsNumber()
  responsibleRoleId?: number;

  @IsOptional()
  @IsNumber()
  responsibleUserId?: number;

  @IsOptional()
  @IsEnum(WbsStatus)
  status?: WbsStatus;
}

export class ReorderWbsDto {
  @IsOptional()
  @IsNumber()
  parentId?: number; // Can move to new parent

  @IsNumber()
  newSequence: number;
}
