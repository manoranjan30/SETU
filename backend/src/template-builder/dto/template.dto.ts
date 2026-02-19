import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  templateJson?: object;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  templateJson?: object;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ImportTemplateDto {
  @IsObject()
  templateData: object;
}
