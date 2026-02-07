import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsEnum,
} from 'class-validator';

export class UpdateProjectProfileDto {
  @IsString() @IsOptional() projectCode?: string;
  @IsString() @IsOptional() projectName?: string;
  @IsString() @IsOptional() projectType?: string;
  @IsString() @IsOptional() projectCategory?: string;
  @IsString() @IsOptional() projectStatus?: string;
  @IsString() @IsOptional() projectVersion?: string;
  @IsString() @IsOptional() description?: string;

  @IsString() @IsOptional() owningCompany?: string;
  @IsString() @IsOptional() businessUnit?: string;
  @IsString() @IsOptional() projectSponsorId?: string;
  @IsString() @IsOptional() projectManagerId?: string;
  @IsString() @IsOptional() planningManagerId?: string;
  @IsString() @IsOptional() costControllerId?: string;
  @IsString() @IsOptional() approvalAuthorityId?: string;

  @IsString() @IsOptional() country?: string;
  @IsString() @IsOptional() state?: string;
  @IsString() @IsOptional() city?: string;
  @IsString() @IsOptional() siteAddress?: string;
  @IsNumber() @IsOptional() latitude?: number;
  @IsNumber() @IsOptional() longitude?: number;
  @IsNumber() @IsOptional() landArea?: number;
  @IsString() @IsOptional() landOwnershipType?: string;
  @IsString() @IsOptional() zoningClassification?: string;

  @IsDateString() @IsOptional() plannedStartDate?: Date;
  @IsDateString() @IsOptional() plannedEndDate?: Date;
  @IsDateString() @IsOptional() actualStartDate?: Date;
  @IsDateString() @IsOptional() actualEndDate?: Date;
  @IsString() @IsOptional() projectCalendar?: string;
  @IsString() @IsOptional() shiftPattern?: string;
  @IsString() @IsOptional() milestoneStrategy?: string;

  @IsString() @IsOptional() currency?: string;
  @IsNumber() @IsOptional() estimatedProjectCost?: number;
  @IsNumber() @IsOptional() approvedBudget?: number;
  @IsString() @IsOptional() fundingType?: string;
  @IsString() @IsOptional() revenueModel?: string;
  @IsString() @IsOptional() taxStructure?: string;
  @IsBoolean() @IsOptional() escalationClause?: boolean;

  @IsString() @IsOptional() constructionTechnology?: string;
  @IsString() @IsOptional() structuralSystem?: string;
  @IsNumber() @IsOptional() numberOfBuildings?: number;
  @IsNumber() @IsOptional() typicalFloorCount?: number;
  @IsNumber() @IsOptional() totalBuiltupArea?: number;
  @IsString() @IsOptional() unitMix?: string;
  @IsNumber() @IsOptional() heightRestriction?: number;
  @IsString() @IsOptional() seismicZone?: string;

  @IsString() @IsOptional() lifecycleStage?: string;
  @IsString() @IsOptional() changeReason?: string;
}
