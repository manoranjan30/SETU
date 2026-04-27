import { IsArray, IsOptional, IsString } from 'class-validator';

export class ResolvePresetPermissionsDto {
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  presetCodes?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  templateCodes?: string[];
}
