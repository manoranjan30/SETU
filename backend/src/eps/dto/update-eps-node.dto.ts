import { IsString, IsOptional, IsNumber } from 'class-validator';

export class UpdateEpsNodeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  order?: number;
}
