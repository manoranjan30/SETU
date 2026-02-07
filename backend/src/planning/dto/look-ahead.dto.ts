import { IsDateString, IsNumber } from 'class-validator';

export class LookAheadDto {
  @IsNumber()
  projectId: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
