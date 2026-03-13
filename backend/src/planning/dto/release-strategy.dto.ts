import {
  RestartPolicy,
  ReleaseStrategyStatus,
} from '../entities/release-strategy.entity';
import {
  ReleaseStrategyApproverMode,
} from '../entities/release-strategy-step.entity';
import {
  ReleaseStrategyOperator,
} from '../entities/release-strategy-condition.entity';

export class ReleaseStrategyConditionDto {
  fieldKey: string;
  operator: ReleaseStrategyOperator;
  valueFrom?: string | null;
  valueTo?: string | null;
  valueJson?: any;
  sequence?: number;
}

export class ReleaseStrategyStepDto {
  levelNo: number;
  stepName: string;
  approverMode: ReleaseStrategyApproverMode;
  userId?: number | null;
  roleId?: number | null;
  minApprovalsRequired?: number;
  canDelegate?: boolean;
  escalationDays?: number | null;
  sequence?: number;
}

export class ReleaseStrategyDto {
  name: string;
  moduleCode: string;
  processCode: string;
  documentType?: string | null;
  priority?: number;
  status?: ReleaseStrategyStatus;
  isDefault?: boolean;
  restartPolicy?: RestartPolicy;
  description?: string | null;
  conditions?: ReleaseStrategyConditionDto[];
  steps?: ReleaseStrategyStepDto[];
}

export class ApprovalContextDto {
  projectId: number;
  moduleCode: string;
  processCode: string;
  documentType?: string | null;
  documentId?: number | string | null;
  initiatorUserId?: number | null;
  amount?: number | null;
  epsNodeId?: number | null;
  vendorId?: number | null;
  workOrderId?: number | null;
  initiatorRoleId?: number | null;
  extraAttributes?: Record<string, any> | null;
}
