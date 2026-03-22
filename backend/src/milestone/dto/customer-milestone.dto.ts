import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  CustomerMilestoneApplicability,
  CustomerMilestoneTriggerType,
} from '../entities/customer-milestone-template.entity';
import { MilestonePaymentMode } from '../entities/milestone-collection-tranche.entity';
import { CustomerMilestoneAchievementStatus } from '../entities/customer-milestone-achievement.entity';

export class UpsertCustomerMilestoneTemplateDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  sequence: number;

  @IsNumberString()
  collectionPct: string;

  @IsEnum(CustomerMilestoneTriggerType)
  triggerType: CustomerMilestoneTriggerType;

  @IsOptional()
  @IsInt()
  triggerActivityId?: number;

  @IsOptional()
  @IsInt()
  triggerQualityActivityId?: number;

  @IsOptional()
  @IsInt()
  triggerSnagRound?: number;

  @IsOptional()
  @IsNumberString()
  triggerProgressPct?: string;

  @IsOptional()
  @IsEnum(CustomerMilestoneApplicability)
  applicableTo?: CustomerMilestoneApplicability;

  @IsOptional()
  @IsArray()
  applicableEpsIds?: number[];

  @IsOptional()
  @IsArray()
  linkedActivityIds?: number[];

  @IsOptional()
  @IsBoolean()
  allowManualCompletion?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertFlatSaleInfoDto {
  @IsOptional()
  @IsInt()
  epsNodeId?: number;

  @IsOptional()
  @IsInt()
  qualityUnitId?: number;

  @IsString()
  @MaxLength(100)
  unitLabel: string;

  @IsNumberString()
  totalSaleValue: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  agreementDate?: string;

  @IsOptional()
  @IsString()
  loanBank?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ManualTriggerMilestoneDto {
  @IsOptional()
  @IsString()
  completionDate?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CloneTowerMilestoneTemplatesDto {
  @IsInt()
  sourceTowerId: number;

  @IsArray()
  targetTowerIds: number[];
}

export class RaiseMilestoneInvoiceDto {
  @IsString()
  invoiceNumber: string;

  @IsString()
  invoiceDate: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class AddMilestoneTrancheDto {
  @IsNumberString()
  amount: string;

  @IsString()
  receivedDate: string;

  @IsEnum(MilestonePaymentMode)
  paymentMode: MilestonePaymentMode;

  @IsString()
  referenceNumber: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdateMilestoneAchievementStatusDto {
  @IsEnum(CustomerMilestoneAchievementStatus)
  status: CustomerMilestoneAchievementStatus;

  @IsOptional()
  @IsString()
  remarks?: string;
}
