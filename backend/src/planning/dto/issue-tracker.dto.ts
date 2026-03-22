import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// ─── Global Department (Admin) ────────────────────────────────────────────────

export class UpsertGlobalDepartmentDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sequenceOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultSlaDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReorderDepartmentsDto {
  @IsArray()
  orderedIds: number[];
}

// ─── Project Dept Config ──────────────────────────────────────────────────────

export class SetDeptProjectConfigDto {
  @IsInt()
  departmentId: number;

  @IsOptional()
  @IsArray()
  memberUserIds?: number[];

  @IsOptional()
  @IsInt()
  coordinatorUserId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  coordinatorName?: string;

  @IsOptional()
  @IsBoolean()
  isIncludedInDefaultFlow?: boolean;
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export class CreateIssueTrackerTagDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  departmentId: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── Issues ───────────────────────────────────────────────────────────────────

export class CreateIssueTrackerIssueDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  description: string;

  @IsArray()
  tagIds: number[];

  @IsOptional()
  @IsString()
  requiredDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
  priority?: string;

  @IsOptional()
  @IsArray()
  customFlowDepartmentIds?: number[];
}

export class UpdateIssueDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  requiredDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
  priority?: string;
}

export class UpdateIssuePriorityDto {
  @IsString()
  @IsIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
  priority: string;
}

// ─── Step / Response ─────────────────────────────────────────────────────────

export class RespondIssueTrackerStepDto {
  @IsString()
  responseText: string;

  @IsOptional()
  @IsString()
  committedCompletionDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CoordinatorCloseStepDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdateCommitmentDateDto {
  @IsString()
  newDate: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

// ─── Close Issue ──────────────────────────────────────────────────────────────

export class CloseIssueTrackerIssueDto {
  @IsOptional()
  @IsString()
  closedRemarks?: string;
}

// ─── Flow Editing ─────────────────────────────────────────────────────────────

export class AddDeptToFlowDto {
  @IsInt()
  departmentId: number;

  @IsOptional()
  @IsInt()
  insertAfterStepId?: number;
}

export class ReorderFlowDto {
  @IsArray()
  stepIds: number[];
}
