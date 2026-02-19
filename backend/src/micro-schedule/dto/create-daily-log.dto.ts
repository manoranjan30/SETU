import {
  IsNotEmpty,
  IsNumber,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDailyLogDto {
  @ApiProperty({ description: 'Micro Activity ID' })
  @IsNotEmpty()
  @IsNumber()
  microActivityId: number;

  @ApiProperty({ description: 'Log Date (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  logDate: string;

  @ApiProperty({ description: 'Quantity Done' })
  @IsNotEmpty()
  @IsNumber()
  qtyDone: number;

  @ApiProperty({ description: 'Manpower Count', required: false })
  @IsOptional()
  @IsNumber()
  manpowerCount?: number;

  @ApiProperty({ description: 'Equipment Hours', required: false })
  @IsOptional()
  @IsNumber()
  equipmentHours?: number;

  @ApiProperty({ description: 'Delay Reason ID', required: false })
  @IsOptional()
  @IsNumber()
  delayReasonId?: number;

  @ApiProperty({ description: 'Remarks', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}
