import { IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExecutionContextDto {
  @ApiProperty({ description: 'ID of the Project' })
  @IsNotEmpty()
  @IsNumber()
  projectId: number;

  @ApiProperty({ description: 'ID of the EPS Node (Specific Location)' })
  @IsNotEmpty()
  @IsNumber()
  epsNodeId: number;

  @ApiProperty({ description: 'ID of the BOQ Element (Scope)' })
  @IsNotEmpty()
  @IsNumber()
  boqElementId: number;

  @ApiProperty({ description: 'ID of the Activity (Schedule)' })
  @IsOptional()
  @IsNumber()
  activityId?: number;

  @ApiProperty({ description: 'Quantity allocated for this context' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  plannedQuantity: number;
}
