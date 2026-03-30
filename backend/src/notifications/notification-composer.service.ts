import { Injectable } from '@nestjs/common';
import {
  NotificationContextService,
  NotificationScopeInput,
} from './notification-context.service';

type NotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

type ProgressSubmissionInput = NotificationScopeInput & {
  qty?: number | null;
  lineCount?: number | null;
};

type ProgressDecisionInput = ProgressSubmissionInput & {
  decisionLabel: string;
};

type StrategyActivationInput = NotificationScopeInput & {
  strategyName: string;
  processCode: string;
};

type ObservationInput = NotificationScopeInput & {
  moduleLabel: 'Quality' | 'EHS';
  severity: string;
  category?: string | null;
  statusLabel?: string | null;
};

type InspectionInput = NotificationScopeInput & {
  inspectionId: number;
  stageName?: string | null;
  levelLabel?: string | null;
};

type InspectionDecisionInput = InspectionInput & {
  decisionLabel: string;
  comments?: string | null;
};

type DelegationInput = InspectionInput & {
  delegateName?: string | null;
};

@Injectable()
export class NotificationComposerService {
  constructor(
    private readonly contextService: NotificationContextService,
  ) {}

  async composeProgressEntrySubmitted(
    input: ProgressSubmissionInput,
  ): Promise<NotificationPayload> {
    const scope = await this.contextService.resolve(input);
    const qtyLabel =
      input.qty != null && Number.isFinite(Number(input.qty))
        ? `Qty: ${this.formatQty(input.qty)}`
        : null;
    const lineCountLabel =
      input.lineCount != null && Number(input.lineCount) > 1
        ? `${Number(input.lineCount)} line items`
        : null;

    return this.buildPayload(
      'Progress Entry Submitted',
      'New progress entry is awaiting approval.',
      scope,
      [qtyLabel, lineCountLabel],
      { type: 'PROGRESS_SUBMITTED' },
    );
  }

  async composeProgressEntryDecision(
    input: ProgressDecisionInput,
  ): Promise<NotificationPayload> {
    const scope = await this.contextService.resolve(input);
    const qtyLabel =
      input.qty != null && Number.isFinite(Number(input.qty))
        ? `Qty: ${this.formatQty(input.qty)}`
        : null;
    const lineCountLabel =
      input.lineCount != null && Number(input.lineCount) > 1
        ? `${Number(input.lineCount)} line items`
        : null;

    return this.buildPayload(
      input.decisionLabel,
      'Progress entry status updated.',
      scope,
      [qtyLabel, lineCountLabel],
      {
        type: input.decisionLabel.toUpperCase().replace(/\s+/g, '_'),
      },
    );
  }

  async composeStrategyActivated(
    input: StrategyActivationInput,
  ): Promise<NotificationPayload> {
    const scope = await this.contextService.resolve(input);
    return this.buildPayload(
      'Approval Strategy Activated',
      `Release strategy "${input.strategyName}" is now active for ${input.processCode} approvals.`,
      scope,
      [],
      { type: 'STRATEGY_ACTIVATED', strategyName: input.strategyName },
    );
  }

  async composeObservationRaised(
    input: ObservationInput,
  ): Promise<NotificationPayload> {
    const scope = await this.contextService.resolve(input);
    const title = `${input.severity} ${input.moduleLabel} Observation Raised`;
    return this.buildPayload(
      title,
      `${input.moduleLabel} observation raised${input.category ? ` under ${input.category}` : ''}.`,
      scope,
      [],
      {
        type: `${input.moduleLabel.toUpperCase()}_OBS_RAISED`,
        severity: input.severity,
      },
    );
  }

  async composeObservationUpdate(
    input: ObservationInput,
  ): Promise<NotificationPayload> {
    const scope = await this.contextService.resolve(input);
    const statusLabel = input.statusLabel || `${input.moduleLabel} Observation Updated`;
    return this.buildPayload(
      statusLabel,
      `${input.moduleLabel} observation status changed${input.category ? ` for ${input.category}` : ''}.`,
      scope,
      [],
      { type: `${input.moduleLabel.toUpperCase()}_OBS_UPDATED` },
    );
  }

  async composeInspectionApprovalRequired(
    input: InspectionInput,
  ): Promise<NotificationPayload> {
    const scope = await this.contextService.resolve(input);
    return this.buildPayload(
      input.stageName ? 'Stage Approval Required' : 'Approval Required',
      input.stageName
        ? `Stage "${input.stageName}" is awaiting approval${input.levelLabel ? ` at ${input.levelLabel}` : ''}.`
        : `RFI #${input.inspectionId} is awaiting approval${input.levelLabel ? ` at ${input.levelLabel}` : ''}.`,
      scope,
      [input.stageName ? `RFI #${input.inspectionId}` : null],
      {
        type: input.stageName ? 'STAGE_LEVEL_PENDING' : 'PENDING_APPROVAL',
        inspectionId: String(input.inspectionId),
      },
    );
  }

  async composeInspectionDecision(
    input: InspectionDecisionInput,
  ): Promise<NotificationPayload> {
    const scope = await this.contextService.resolve(input);
    return this.buildPayload(
      input.decisionLabel,
      `RFI #${input.inspectionId} status changed.`,
      scope,
      [input.comments ? `Remarks: ${input.comments}` : null],
      {
        type: input.decisionLabel.toUpperCase().replace(/\s+/g, '_'),
        inspectionId: String(input.inspectionId),
      },
    );
  }

  async composeInspectionDelegated(
    input: DelegationInput,
  ): Promise<NotificationPayload> {
    const scope = await this.contextService.resolve(input);
    return this.buildPayload(
      'RFI Approval Delegated',
      `RFI #${input.inspectionId} has been delegated for approval.`,
      scope,
      [input.delegateName ? `Assigned to: ${input.delegateName}` : null],
      {
        type: 'WORKFLOW_DELEGATED',
        inspectionId: String(input.inspectionId),
      },
    );
  }

  private async buildPayload(
    title: string,
    summary: string,
    scope: Awaited<ReturnType<NotificationContextService['resolve']>>,
    extras: Array<string | null | undefined> = [],
    data: Record<string, string> = {},
  ): Promise<NotificationPayload> {
    const contextLabel = this.contextService.formatInline(scope);
    const body = [summary, contextLabel, ...extras]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(' | ');

    return {
      title,
      body,
      data: {
        ...this.contextService.toData(scope),
        ...data,
      },
    };
  }

  private formatQty(value: number | string): string {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return String(value);
    }

    return numeric.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
}
