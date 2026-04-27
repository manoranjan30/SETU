import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpsertActionPresetDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  group: string;

  @IsIn([1, 2, 3])
  tier: 1 | 2 | 3;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsArray()
  @IsOptional()
  permissionCodes?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
