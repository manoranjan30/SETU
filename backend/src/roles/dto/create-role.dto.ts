import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsNumber,
  IsInt,
} from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsOptional()
  permissionIds?: number[];
}
