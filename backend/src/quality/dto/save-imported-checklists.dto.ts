import { IsArray, IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateChecklistTemplateDto } from './create-checklist-template.dto';

export class SaveImportedChecklistsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChecklistTemplateDto)
  templates: CreateChecklistTemplateDto[];

  @IsOptional()
  @IsBoolean()
  overwriteExisting?: boolean;
}
