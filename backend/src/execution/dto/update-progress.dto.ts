import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ExecutionStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export class UpdateProgressDto {
  @ApiProperty({ description: 'Cumulative Actual Quantity achieved so far' })
  @IsNumber()
  @Min(0)
  actualQuantity: number;

  @ApiPropertyOptional({ description: 'Date of this progress update' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Status of the work',
    enum: ExecutionStatus,
  })
  @IsOptional()
  @IsEnum(ExecutionStatus)
  status?: ExecutionStatus;
}
