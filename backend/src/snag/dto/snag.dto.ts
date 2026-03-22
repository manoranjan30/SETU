import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  SNAG_COMMON_CHECKLIST_STATUSES,
  type SnagCommonChecklistStatus,
} from '../entities/snag-list.entity';

export class CreateSnagListDto {
  @IsInt()
  qualityUnitId: number;

  @IsOptional()
  @IsInt()
  epsNodeId?: number;
}

export class CreateSnagItemDto {
  @IsOptional()
  @IsInt()
  qualityRoomId?: number;

  @IsOptional()
  @IsString()
  roomLabel?: string;

  @IsString()
  @MaxLength(255)
  defectTitle: string;

  @IsOptional()
  @IsString()
  defectDescription?: string;

  @IsOptional()
  @IsString()
  trade?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  linkedChecklistItemId?: string;

  @IsArray()
  beforePhotoUrls: string[];
}

export class RectifySnagItemDto {
  @IsArray()
  afterPhotoUrls: string[];

  @IsOptional()
  @IsString()
  rectificationNotes?: string;
}

export class CloseSnagItemDto {
  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsArray()
  closurePhotoUrls?: string[];
}

export class HoldSnagItemDto {
  @IsString()
  holdReason: string;
}

export class SubmitSnagPhaseDto {
  @IsOptional()
  @IsString()
  comments?: string;
}

export class SubmitDesnagApprovalDto {
  @IsOptional()
  @IsString()
  comments?: string;
}

export class SkipSnagRoundDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ResetSnagRoundDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class AdvanceApprovalDto {
  @IsString()
  action: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  comments?: string;
}

export class BulkRectifySnagItemsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  itemIds: number[];

  @IsArray()
  @ArrayNotEmpty()
  afterPhotoUrls: string[];

  @IsOptional()
  @IsString()
  rectificationNotes?: string;
}

export class BulkCloseSnagItemsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  itemIds: number[];

  @IsOptional()
  @IsArray()
  closurePhotoUrls?: string[];

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdateSnagCommonChecklistDto {
  @IsArray()
  items: Array<{
    id?: string;
    title: string;
    qualityRoomId?: number | null;
    roomLabel?: string | null;
    trade?: string | null;
    sequence?: number;
    status?: SnagCommonChecklistStatus;
    remarks?: string | null;
    linkedSnagItemId?: number | null;
  }>;
}

export class UpdateSnagCommonChecklistStatusDto {
  @IsString()
  checklistItemId: string;

  @IsString()
  @IsIn(SNAG_COMMON_CHECKLIST_STATUSES)
  status: SnagCommonChecklistStatus;
}
