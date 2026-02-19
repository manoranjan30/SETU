import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MicroScheduleStatus } from '../entities/micro-schedule.entity';

export class CreateMicroScheduleDto {
  @ApiProperty({ description: 'Project ID' })
  @IsNotEmpty()
  @IsNumber()
  projectId: number;

  @ApiProperty({ description: 'Parent Activity ID (Optional)' })
  @IsOptional()
  @IsNumber()
  parentActivityId?: number;

  @ApiProperty({
    description: 'List of Master Activity IDs included in this Micro Schedule',
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { each: true })
  linkedActivityIds?: number[];

  @ApiProperty({ description: 'Micro Schedule Name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Baseline Start Date (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  baselineStart: string;

  @ApiProperty({ description: 'Baseline Finish Date (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  baselineFinish: string;

  @ApiProperty({ description: 'Planned Start Date (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  plannedStart: string;

  @ApiProperty({ description: 'Planned Finish Date (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  plannedFinish: string;

  @ApiProperty({
    description: 'Status',
    enum: MicroScheduleStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(MicroScheduleStatus)
  status?: MicroScheduleStatus;
}
