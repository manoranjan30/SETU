import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBoqElementDto {
  @ApiProperty({ description: 'ID of the Project' })
  @IsNotEmpty()
  @IsNumber()
  projectId: number;

  @ApiProperty({ description: 'ID of the EPS Node (Location)' })
  @IsNotEmpty()
  @IsNumber()
  epsNodeId: number;

  @ApiProperty({ description: 'Unique BOQ Code' })
  @IsNotEmpty()
  @IsString()
  boqCode: string;

  @ApiProperty({ description: 'Descriptive Name of the BOQ Item' })
  @IsNotEmpty()
  @IsString()
  boqName: string;

  @ApiProperty({ description: 'Unit of Measure (e.g., m3, sqft)' })
  @IsNotEmpty()
  @IsString()
  unitOfMeasure: string;

  @ApiProperty({ description: 'Total Budgeted Quantity' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  totalQuantity: number;

  @ApiPropertyOptional({ description: 'Reference ID for BIM/Geometry' })
  @IsOptional()
  @IsString()
  geometryRefId?: string;
}
