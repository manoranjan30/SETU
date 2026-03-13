import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ChecklistItemType } from '../entities/quality-checklist-item-template.entity';
import { SignatureSlotConfig } from './checklist-template.types';

export class CreateChecklistItemTemplateDto {
  @IsString()
  itemText: string;

  @IsEnum(ChecklistItemType)
  type: ChecklistItemType;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsBoolean()
  photoRequired?: boolean;

  @IsOptional()
  options?: unknown;

  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;
}

export class CreateStageTemplateDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;

  @IsOptional()
  @IsBoolean()
  isHoldPoint?: boolean;

  @IsOptional()
  @IsBoolean()
  isWitnessPoint?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  responsibleParty?: string;

  @IsOptional()
  @IsArray()
  signatureSlots?: SignatureSlotConfig[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChecklistItemTemplateDto)
  items?: CreateChecklistItemTemplateDto[];
}

export class CreateChecklistTemplateDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  checklistNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  revNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  activityTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  activityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  discipline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  applicableTrade?: string;

  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateStageTemplateDto)
  stages?: CreateStageTemplateDto[];
}
