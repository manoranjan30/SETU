import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { PermissionAction, PermissionScope } from '../permission.entity';

export class CreatePermissionDto {
  @IsString()
  @IsNotEmpty()
  permissionCode: string;

  @IsString()
  @IsNotEmpty()
  permissionName: string;

  @IsString()
  @IsNotEmpty()
  moduleName: string;

  @IsString()
  @IsOptional()
  entityName?: string;

  @IsEnum(PermissionAction)
  actionType: PermissionAction;

  @IsEnum(PermissionScope)
  scopeLevel: PermissionScope;

  @IsString()
  @IsOptional()
  description?: string;
}
