import { IsNotEmpty, IsString, IsOptional, IsDateString, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MicroActivityStatus } from '../entities/micro-schedule-activity.entity';

export class CreateMicroActivityDto {
    @ApiProperty({ description: 'Micro Schedule ID' })
    @IsNotEmpty()
    @IsNumber()
    microScheduleId: number;

    @ApiProperty({ description: 'Parent Activity ID' })
    @IsNotEmpty()
    @IsNumber()
    parentActivityId: number;

    @ApiProperty({ description: 'BOQ Item ID', required: false })
    @IsOptional()
    @IsNumber()
    boqItemId?: number;

    @ApiProperty({ description: 'Work Order ID', required: false })
    @IsOptional()
    @IsNumber()
    workOrderId?: number;

    @ApiProperty({ description: 'EPS Node ID (Location)' })
    @IsNotEmpty()
    @IsNumber()
    epsNodeId: number;

    @ApiProperty({ description: 'Activity Name' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({ description: 'Description', required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ description: 'Allocated Quantity' })
    @IsNotEmpty()
    @IsNumber()
    allocatedQty: number;

    @ApiProperty({ description: 'Unit of Measure' })
    @IsNotEmpty()
    @IsString()
    uom: string;

    @ApiProperty({ description: 'Planned Start Date (YYYY-MM-DD)' })
    @IsNotEmpty()
    @IsDateString()
    plannedStart: string;

    @ApiProperty({ description: 'Planned Finish Date (YYYY-MM-DD)' })
    @IsNotEmpty()
    @IsDateString()
    plannedFinish: string;

    @ApiProperty({ description: 'Status', enum: MicroActivityStatus, required: false })
    @IsOptional()
    @IsEnum(MicroActivityStatus)
    status?: MicroActivityStatus;
}
