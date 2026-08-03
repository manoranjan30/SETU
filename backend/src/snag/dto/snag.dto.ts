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
  @IsInt()
  vendorId?: number;

  @IsOptional()
  @IsString()
  vendorName?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  linkedChecklistItemId?: string;

  @IsOptional()
  @IsArray()
  beforePhotoUrls?: string[];
}

export class RectifySnagItemDto {
  @IsOptional()
  @IsArray()
  afterPhotoUrls?: string[];

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

export class RejectSnagRectificationDto {
  @IsOptional()
  @IsString()
  remarks?: string;
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

export class FinalClosureSnagRoundDto {
  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  signatureData?: string;
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

  @IsOptional()
  @IsArray()
  afterPhotoUrls?: string[];

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

export class UpsertSnagProcessStepDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsInt()
  workflowSerialNo: number;

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  raisePhotoRequired?: boolean;

  @IsOptional()
  rectificationPhotoRequired?: boolean;

  @IsOptional()
  desnagCompletionPhotoRequired?: boolean;
}

export class ReorderSnagProcessStepsDto {
  @IsArray()
  steps: Array<{ id: number; workflowSerialNo: number }>;
}

export class CreateSnagProcessActivityDto {
  @IsInt()
  processStepId: number;

  @IsInt()
  activityId: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class MoveSnagProcessActivityDto {
  @IsInt()
  processStepId: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class ReorderSnagProcessActivitiesDto {
  @IsArray()
  activities: Array<{ id: number; sortOrder: number }>;
}

export class UpsertSnagCommonPointDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  requiresEvidence?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  isActive?: boolean;
}
