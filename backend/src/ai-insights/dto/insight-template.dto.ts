import {
  IsString, IsOptional, IsBoolean, IsArray,
  IsNumber, IsIn, MaxLength, IsNotEmpty, IsObject,
} from 'class-validator';

export class CreateInsightTemplateDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  slug: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  requiredPermission?: string;

  @IsOptional()
  @IsIn(['PROJECT', 'GLOBAL'])
  scope?: string;

  @IsArray()
  dataSources: object[];

  @IsNotEmpty()
  @IsString()
  promptTemplate: string;

  @IsOptional()
  @IsObject()
  outputSchema?: object | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string | null;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateInsightTemplateDto extends CreateInsightTemplateDto {}
