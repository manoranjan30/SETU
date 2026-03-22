import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class InstallPluginDto {
  @IsObject()
  bundle: Record<string, any>;

  @IsOptional()
  @IsString()
  approvalSource?: string;
}

export class PluginActionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class PluginPageQueryDto {
  @IsOptional()
  @IsObject()
  queryConfig?: Record<string, any>;

  @IsOptional()
  @IsObject()
  context?: Record<string, any>;
}

export class UpdatePluginSettingsDto {
  @IsObject()
  @IsNotEmpty()
  values: Record<string, any>;
}
