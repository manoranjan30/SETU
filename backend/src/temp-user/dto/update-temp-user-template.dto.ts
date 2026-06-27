import { IsNumber } from 'class-validator';

export class UpdateTempUserTemplateDto {
  @IsNumber()
  tempRoleTemplateId: number;
}
