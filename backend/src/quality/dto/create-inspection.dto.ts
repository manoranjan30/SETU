import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateInspectionDto {
  @IsInt()
  projectId: number;

  @IsInt()
  epsNodeId: number;

  @IsInt()
  listId: number;

  @IsInt()
  activityId: number;

  @IsOptional()
  @IsInt()
  qualityUnitId?: number;

  @IsOptional()
  @IsInt()
  qualityRoomId?: number;

  @IsOptional()
  @IsInt()
  partNo?: number;

  @IsOptional()
  @IsInt()
  totalParts?: number;

  @IsOptional()
  @IsString()
  partLabel?: string;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  processCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  documentType?: string;

  @IsOptional()
  @IsString()
  requestDate?: string;

  @IsOptional()
  signature?: { data: string; role: string; signedBy: string };

  @IsOptional()
  @IsInt()
  vendorId?: number;

  @IsOptional()
  @IsString()
  vendorName?: string;

  @IsString()
  @MaxLength(100)
  drawingNo: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  elementName?: string;

  @IsOptional()
  @IsInt()
  goNo?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  goLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contractorName?: string;
}
