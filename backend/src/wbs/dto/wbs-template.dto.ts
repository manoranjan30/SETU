import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateWbsTemplateDto {
  @IsString()
  @IsNotEmpty()
  templateName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  projectType?: string;
}

export class ApplyTemplateDto {
  @IsNotEmpty()
  templateId: number;
}

export class CreateWbsTemplateNodeDto {
  @IsNotEmpty()
  templateId: number;

  @IsOptional()
  parentId?: number;

  @IsString()
  @IsNotEmpty()
  wbsName: string;

  @IsString()
  @IsNotEmpty()
  wbsCode: string; // The relative code e.g. "1.1"

  @IsOptional()
  @IsBoolean()
  isControlAccount?: boolean;
}

export class UpdateWbsTemplateNodeDto {
  @IsOptional()
  @IsString()
  wbsName?: string;

  @IsOptional()
  @IsString()
  wbsCode?: string;

  @IsOptional()
  @IsBoolean()
  isControlAccount?: boolean;
}
