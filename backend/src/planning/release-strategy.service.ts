import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AssignmentStatus,
  UserProjectAssignment,
} from '../projects/entities/user-project-assignment.entity';
import { TempUser } from '../temp-user/entities/temp-user.entity';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import {
  ApprovalContextDto,
  ReleaseStrategyConditionDto,
  ReleaseStrategyDto,
  ReleaseStrategyStepDto,
} from './dto/release-strategy.dto';
import {
  ReleaseStrategyCondition,
  ReleaseStrategyOperator,
} from './entities/release-strategy-condition.entity';
import {
  RestartPolicy,
  ReleaseStrategy,
  ReleaseStrategyStatus,
} from './entities/release-strategy.entity';
import {
  ReleaseStrategyApproverMode,
  ReleaseStrategyStep,
} from './entities/release-strategy-step.entity';
import { ReleaseStrategyVersionAudit } from './entities/release-strategy-version-audit.entity';
import { PushNotificationService } from '../notifications/push-notification.service';

type EligibleApproverDto = {
  userId: number;
  displayName: string;
  sourceType: 'PERMANENT' | 'TEMP_VENDOR';
  projectRoleIds: number[];
  projectRoleNames: string[];
  companyLabel: string;
  primaryRoleLabel: string | null;
  vendorId?: number | null;
  workOrderId?: number | null;
  activeStatus: string;
  expiryDate?: string | null;
};

@Injectable()
export class ReleaseStrategyService {
  private readonly logger = new Logger(ReleaseStrategyService.name);

  constructor(
    @InjectRepository(ReleaseStrategy)
    private readonly strategyRepo: Repository<ReleaseStrategy>,
    @InjectRepository(ReleaseStrategyCondition)
    private readonly conditionRepo: Repository<ReleaseStrategyCondition>,
    @InjectRepository(ReleaseStrategyStep)
    private readonly stepRepo: Repository<ReleaseStrategyStep>,
    @InjectRepository(ReleaseStrategyVersionAudit)
    private readonly auditRepo: Repository<ReleaseStrategyVersionAudit>,
    @InjectRepository(UserProjectAssignment)
    private readonly assignmentRepo: Repository<UserProjectAssignment>,
    @InjectRepository(TempUser)
    private readonly tempUserRepo: Repository<TempUser>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly pushService: PushNotificationService,
  ) {}

  async listStrategies(
    projectId: number,
    filters?: {
      status?: string;
      moduleCode?: string;
      processCode?: string;
      search?: string;
    },
  ) {
    const items = await this.strategyRepo.find({
      where: { projectId },
      relations: ['conditions', 'steps'],
      order: { priority: 'DESC', updatedAt: 'DESC' },
    });

    return items.filter((item) => {
      if (filters?.status && item.status !== filters.status) return false;
      if (
        filters?.moduleCode &&
        item.moduleCode.toLowerCase() !== filters.moduleCode.toLowerCase()
      ) {
        return false;
      }
      if (
        filters?.processCode &&
        item.processCode.toLowerCase() !== filters.processCode.toLowerCase()
      ) {
        return false;
      }
      if (filters?.search) {
        const needle = filters.search.toLowerCase();
        const hay = [
          item.name,
          item.moduleCode,
          item.processCode,
          item.documentType || '',
          item.description || '',
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(needle);
      }
      return true;
    });
  }

  async getStrategy(projectId: number, id: number) {
    const item = await this.strategyRepo.findOne({
      where: { id, projectId },
      relations: ['conditions', 'steps', 'audits'],
      order: {
        conditions: { sequence: 'ASC' },
        steps: { sequence: 'ASC' },
        audits: { createdAt: 'DESC' },
      },
    });
    if (!item) {
      throw new NotFoundException('Release strategy not found');
    }
    return item;
  }

  async createStrategy(projectId: number, dto: ReleaseStrategyDto, userId: number) {
    this.validateDto(dto);

    const strategy = this.strategyRepo.create({
      projectId,
      name: dto.name.trim(),
      moduleCode: dto.moduleCode.trim().toUpperCase(),
      processCode: dto.processCode.trim().toUpperCase(),
      documentType: dto.documentType?.trim() || null,
      priority: dto.priority ?? 100,
      status: dto.status ?? ReleaseStrategyStatus.DRAFT,
      version: 1,
      isDefault: dto.isDefault ?? false,
      restartPolicy: dto.restartPolicy ?? RestartPolicy.RESTART_FROM_LEVEL_1,
      description: dto.description?.trim() || null,
      createdBy: userId,
      conditions: this.buildConditions(dto.conditions || []),
      steps: this.buildSteps(dto.steps || []),
    });

    const saved = await this.strategyRepo.save(strategy);
    await this.createAuditSnapshot(saved.id, saved.version, userId, saved, null);

    if (saved.status === ReleaseStrategyStatus.ACTIVE) {
      await this.assertActivationAllowed(projectId, saved.id, saved);
    }

    return this.getStrategy(projectId, saved.id);
  }

  async updateStrategy(
    projectId: number,
    id: number,
    dto: ReleaseStrategyDto,
    userId: number,
  ) {
    this.validateDto(dto);
    const strategy = await this.getStrategy(projectId, id);

    await this.conditionRepo.delete({ strategyId: strategy.id });
    await this.stepRepo.delete({ strategyId: strategy.id });

    strategy.name = dto.name.trim();
    strategy.moduleCode = dto.moduleCode.trim().toUpperCase();
    strategy.processCode = dto.processCode.trim().toUpperCase();
    strategy.documentType = dto.documentType?.trim() || null;
    strategy.priority = dto.priority ?? strategy.priority;
    strategy.isDefault = dto.isDefault ?? false;
    strategy.restartPolicy =
      dto.restartPolicy ?? RestartPolicy.RESTART_FROM_LEVEL_1;
    strategy.description = dto.description?.trim() || null;
    strategy.status = dto.status ?? strategy.status;
    strategy.version += 1;
    strategy.conditions = this.buildConditions(dto.conditions || []);
    strategy.steps = this.buildSteps(dto.steps || []);

    const saved = await this.strategyRepo.save(strategy);
    await this.createAuditSnapshot(saved.id, saved.version, userId, saved, null);

    if (saved.status === ReleaseStrategyStatus.ACTIVE) {
      await this.assertActivationAllowed(projectId, saved.id, saved);
    }

    return this.getStrategy(projectId, saved.id);
  }

  async deleteStrategy(projectId: number, id: number) {
    const strategy = await this.getStrategy(projectId, id);
    await this.strategyRepo.remove(strategy);
    return { success: true };
  }

  async cloneStrategy(projectId: number, id: number, userId: number) {
    const strategy = await this.getStrategy(projectId, id);
    const dto: ReleaseStrategyDto = {
      name: `${strategy.name} Copy`,
      moduleCode: strategy.moduleCode,
      processCode: strategy.processCode,
      documentType: strategy.documentType,
      priority: strategy.priority,
      status: ReleaseStrategyStatus.DRAFT,
      isDefault: false,
      restartPolicy: strategy.restartPolicy,
      description: strategy.description,
      conditions: (strategy.conditions || []).map((condition) => ({
        fieldKey: condition.fieldKey,
        operator: condition.operator,
        valueFrom: condition.valueFrom,
        valueTo: condition.valueTo,
        valueJson: condition.valueJson,
        sequence: condition.sequence,
      })),
      steps: (strategy.steps || []).map((step) => ({
        levelNo: step.levelNo,
        stepName: step.stepName,
        approverMode: step.approverMode,
        userId: step.userId,
        userIds: step.userIds || (step.userId ? [step.userId] : []),
        roleId: step.roleId,
        minApprovalsRequired: step.minApprovalsRequired,
        canDelegate: step.canDelegate,
        escalationDays: step.escalationDays,
        sequence: step.sequence,
      })),
    };

    return this.createStrategy(projectId, dto, userId);
  }

  async activateStrategy(projectId: number, id: number, userId: number) {
    const strategy = await this.getStrategy(projectId, id);
    strategy.status = ReleaseStrategyStatus.ACTIVE;
    await this.assertActivationAllowed(projectId, strategy.id, strategy);
    const saved = await this.strategyRepo.save(strategy);
    await this.createAuditSnapshot(saved.id, saved.version, userId, saved, new Date());

    // Notify project members who manage approvals that a new strategy is live
    this.pushService
      .sendToProjectPermission(
        projectId,
        'RELEASE_STRATEGY.READ',
        'Approval Strategy Activated',
        `Release strategy "${saved.name}" is now active for ${saved.processCode} approvals.`,
        {
          type: 'STRATEGY_ACTIVATED',
          projectId: String(projectId),
          strategyId: String(saved.id),
          strategyName: saved.name,
        },
      )
      .catch(() => {
        /* non-fatal */
      });

    return this.getStrategy(projectId, id);
  }

  async deactivateStrategy(projectId: number, id: number) {
    const strategy = await this.getStrategy(projectId, id);
    strategy.status = ReleaseStrategyStatus.INACTIVE;
    await this.strategyRepo.save(strategy);
    return this.getStrategy(projectId, id);
  }

  async getEligibleActors(projectId: number): Promise<EligibleApproverDto[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const assignments = await this.assignmentRepo.find({
      where: {
        project: { id: projectId },
        status: AssignmentStatus.ACTIVE,
      },
      relations: ['user', 'roles'],
    });

    const permanentMap = new Map<number, EligibleApproverDto>();
    for (const assignment of assignments) {
      if (!assignment.user?.isActive) continue;
      const existing = permanentMap.get(assignment.user.id);
      const roleIds = assignment.roles?.map((role) => role.id) || [];
      const roleNames =
        assignment.roles?.map((role) => role.name).filter(Boolean) || [];
      if (existing) {
        existing.projectRoleIds = Array.from(
          new Set([...existing.projectRoleIds, ...roleIds]),
        );
        existing.projectRoleNames = Array.from(
          new Set([...existing.projectRoleNames, ...roleNames]),
        );
        existing.primaryRoleLabel =
          existing.primaryRoleLabel || roleNames[0] || null;
        continue;
      }
      permanentMap.set(assignment.user.id, {
        userId: assignment.user.id,
        displayName:
          assignment.user.displayName || assignment.user.username || 'User',
        sourceType: assignment.user.isTempUser ? 'TEMP_VENDOR' : 'PERMANENT',
        projectRoleIds: roleIds,
        projectRoleNames: roleNames,
        companyLabel: 'Internal Team',
        primaryRoleLabel: roleNames[0] || null,
        activeStatus: 'ACTIVE',
      });
    }

    const tempUsers = await this.tempUserRepo.find({
      where: {
        project: { id: projectId } as any,
      },
      relations: ['user', 'vendor', 'workOrder', 'tempRoleTemplate'],
    });

    for (const temp of tempUsers) {
      if (!temp.user?.isActive) continue;
      if (temp.status !== 'ACTIVE') continue;
      const expiry = new Date(temp.expiryDate);
      expiry.setHours(0, 0, 0, 0);
      if (expiry < today) continue;

      const assigned = permanentMap.get(temp.userId);
      const roleIds = assigned?.projectRoleIds || [];
      const roleNames = assigned?.projectRoleNames || [];
      const tempRoleName = temp.tempRoleTemplate?.name || null;
      permanentMap.set(temp.userId, {
        userId: temp.userId,
        displayName: temp.user.displayName || temp.user.username || 'Temp User',
        sourceType: 'TEMP_VENDOR',
        projectRoleIds: roleIds,
        projectRoleNames: roleNames,
        companyLabel: temp.vendor?.name || 'Vendor',
        primaryRoleLabel: roleNames[0] || tempRoleName,
        vendorId: temp.vendorId ?? null,
        workOrderId: temp.workOrderId ?? null,
        activeStatus: temp.status,
        expiryDate: temp.expiryDate?.toString?.() || null,
      });
    }

    return Array.from(permanentMap.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }

  async getConflicts(projectId: number) {
    const strategies = await this.strategyRepo.find({
      where: {
        projectId,
        status: ReleaseStrategyStatus.ACTIVE,
      },
      relations: ['conditions', 'steps'],
      order: { priority: 'DESC', updatedAt: 'DESC' },
    });

    const conflicts: any[] = [];
    for (let i = 0; i < strategies.length; i += 1) {
      for (let j = i + 1; j < strategies.length; j += 1) {
        const a = strategies[i];
        const b = strategies[j];
        if (
          a.moduleCode !== b.moduleCode ||
          a.processCode !== b.processCode ||
          a.priority !== b.priority
        ) {
          continue;
        }

        if ((a.documentType || null) !== (b.documentType || null)) {
          continue;
        }

        const sameSignature =
          this.normalizeConditions(a.conditions) ===
          this.normalizeConditions(b.conditions);

        if (sameSignature || (a.isDefault && b.isDefault)) {
          conflicts.push({
            moduleCode: a.moduleCode,
            processCode: a.processCode,
            priority: a.priority,
            strategyIds: [a.id, b.id],
            strategyNames: [a.name, b.name],
            reason: a.isDefault && b.isDefault
              ? 'Multiple default active strategies share the same scope.'
              : 'Active strategies share the same scope, priority, and condition signature.',
          });
        }
      }
    }

    return conflicts;
  }

  async simulateStrategy(
    projectId: number,
    id: number,
    context: ApprovalContextDto,
  ) {
    const strategy = await this.getStrategy(projectId, id);
    const eligibleActors = await this.getEligibleActors(projectId);
    const matched = this.matchesStrategy(strategy, context);

    return {
      strategyId: strategy.id,
      strategyName: strategy.name,
      matched,
      resolvedSteps: (strategy.steps || [])
        .sort((a, b) => a.sequence - b.sequence)
        .map((step) => ({
          id: step.id,
          levelNo: step.levelNo,
          stepName: step.stepName,
          approverMode: step.approverMode,
          userId: step.userId ?? null,
          userIds: step.userIds || (step.userId ? [step.userId] : []),
          roleId: step.roleId ?? null,
          approvers: this.resolveStepApprovers(step, eligibleActors),
        })),
      restartPolicy: strategy.restartPolicy,
      unmatchedConditions: matched
        ? []
        : this.getUnmatchedConditions(strategy.conditions || [], context),
    };
  }

  async resolveStrategy(projectId: number, context: ApprovalContextDto) {
    const strategies = await this.strategyRepo.find({
      where: {
        projectId,
        status: ReleaseStrategyStatus.ACTIVE,
      },
      relations: ['conditions', 'steps'],
      order: { priority: 'DESC', updatedAt: 'DESC' },
    });

    const matches = strategies.filter((strategy) =>
      this.matchesStrategy(strategy, context),
    );

    const winner = matches[0] || null;
    const eligibleActors = winner
      ? await this.getEligibleActors(projectId)
      : [];

    return {
      matchedStrategy: winner
        ? {
            id: winner.id,
            name: winner.name,
            version: winner.version,
            moduleCode: winner.moduleCode,
            processCode: winner.processCode,
            documentType: winner.documentType,
            priority: winner.priority,
            restartPolicy: winner.restartPolicy,
            resolvedSteps: (winner.steps || [])
              .sort((a, b) => a.sequence - b.sequence)
              .map((step) => ({
                levelNo: step.levelNo,
                stepName: step.stepName,
                approverMode: step.approverMode,
                userId: step.userId ?? null,
                userIds: step.userIds || (step.userId ? [step.userId] : []),
                roleId: step.roleId ?? null,
                canDelegate: step.canDelegate,
                minApprovalsRequired: step.minApprovalsRequired,
                approvers: this.resolveStepApprovers(step, eligibleActors),
              })),
          }
        : null,
      status: winner ? 'MATCHED' : 'NO_STRATEGY_ASSIGNED',
    };
  }

  private validateDto(dto: ReleaseStrategyDto) {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Strategy name is required');
    }
    if (!dto.moduleCode?.trim()) {
      throw new BadRequestException('moduleCode is required');
    }
    if (!dto.processCode?.trim()) {
      throw new BadRequestException('processCode is required');
    }
    if (!dto.steps?.length) {
      throw new BadRequestException('At least one approval level is required');
    }
    dto.steps.forEach((step, index) => {
      if (!step.stepName?.trim()) {
        throw new BadRequestException(`Step ${index + 1} requires a step name`);
      }
      if (
        step.approverMode === ReleaseStrategyApproverMode.USER &&
        !step.userId &&
        !(step.userIds || []).length
      ) {
        throw new BadRequestException(
          `Step ${index + 1} requires at least one user`,
        );
      }
      if (
        step.approverMode === ReleaseStrategyApproverMode.PROJECT_ROLE &&
        !step.roleId
      ) {
        throw new BadRequestException(`Step ${index + 1} requires a project role`);
      }
      const configuredApproverCount =
        step.approverMode === ReleaseStrategyApproverMode.USER
          ? Array.from(
              new Set(
                (step.userIds || [])
                  .map((userId) => Number(userId))
                  .filter((userId) => Number.isFinite(userId) && userId > 0),
              ),
            ).length || (step.userId ? 1 : 0)
          : step.roleId
            ? 1
            : 0;
      if ((step.minApprovalsRequired ?? 1) > configuredApproverCount) {
        throw new BadRequestException(
          `Step ${index + 1} requires ${step.minApprovalsRequired} approvals but only ${configuredApproverCount} approver(s) are configured.`,
        );
      }
    });
  }

  private buildConditions(conditions: ReleaseStrategyConditionDto[]) {
    return (conditions || []).map((condition, index) =>
      this.conditionRepo.create({
        fieldKey: condition.fieldKey.trim(),
        operator: condition.operator,
        valueFrom:
          condition.valueFrom !== undefined ? String(condition.valueFrom) : null,
        valueTo: condition.valueTo !== undefined ? String(condition.valueTo) : null,
        valueJson: condition.valueJson ?? null,
        sequence: condition.sequence ?? index + 1,
      }),
    );
  }

  private buildSteps(steps: ReleaseStrategyStepDto[]) {
    return (steps || []).map((step, index) =>
      {
        const userIds = Array.from(
          new Set(
            ((step.userIds && step.userIds.length > 0
              ? step.userIds
              : step.userId
                ? [step.userId]
                : []) || [])
              .map((userId) => Number(userId))
              .filter((userId) => Number.isFinite(userId) && userId > 0),
          ),
        );

        return this.stepRepo.create({
          levelNo: step.levelNo ?? index + 1,
          stepName: step.stepName.trim(),
          approverMode: step.approverMode,
          userId:
            step.approverMode === ReleaseStrategyApproverMode.USER
              ? userIds[0] ?? step.userId ?? null
              : null,
          userIds:
            step.approverMode === ReleaseStrategyApproverMode.USER
              ? userIds
              : null,
          roleId:
            step.approverMode === ReleaseStrategyApproverMode.PROJECT_ROLE
              ? step.roleId ?? null
              : null,
          minApprovalsRequired: step.minApprovalsRequired ?? 1,
          canDelegate: step.canDelegate ?? false,
          escalationDays: step.escalationDays ?? null,
          sequence: step.sequence ?? index + 1,
        });
      },
    );
  }

  private async createAuditSnapshot(
    strategyId: number,
    version: number,
    userId: number,
    strategy: ReleaseStrategy,
    activatedAt: Date | null,
  ) {
    const snapshot = await this.strategyRepo.findOne({
      where: { id: strategyId },
      relations: ['conditions', 'steps'],
      order: {
        conditions: { sequence: 'ASC' },
        steps: { sequence: 'ASC' },
      },
    });

    await this.auditRepo.save(
      this.auditRepo.create({
        strategyId,
        version,
        changedBy: userId,
        snapshotJson: snapshot || strategy,
        activatedAt,
      }),
    );
  }

  private async assertActivationAllowed(
    projectId: number,
    strategyId: number,
    strategy?: ReleaseStrategy,
  ) {
    const current = strategy || (await this.getStrategy(projectId, strategyId));
    const conflicts = await this.getConflicts(projectId);
    const ownConflict = conflicts.find((conflict) =>
      conflict.strategyIds.includes(strategyId),
    );
    if (ownConflict) {
      throw new BadRequestException(ownConflict.reason);
    }

    const eligibleActors = await this.getEligibleActors(projectId);
    for (const step of current.steps || []) {
      const approvers = this.resolveStepApprovers(step, eligibleActors);
      if (approvers.length === 0) {
        throw new BadRequestException(
          `Cannot activate strategy. Step "${step.stepName}" has no eligible approvers.`,
        );
      }
      if ((step.minApprovalsRequired ?? 1) > approvers.length) {
        throw new BadRequestException(
          `Cannot activate strategy. Step "${step.stepName}" requires ${step.minApprovalsRequired} approvals but only ${approvers.length} eligible approver(s) are available.`,
        );
      }
    }
  }

  private normalizeConditions(conditions: ReleaseStrategyCondition[]) {
    return JSON.stringify(
      [...conditions]
        .sort((a, b) => a.sequence - b.sequence)
        .map((condition) => ({
          fieldKey: condition.fieldKey,
          operator: condition.operator,
          valueFrom: condition.valueFrom,
          valueTo: condition.valueTo,
          valueJson: condition.valueJson,
        })),
    );
  }

  private matchesStrategy(strategy: ReleaseStrategy, context: ApprovalContextDto) {
    if (strategy.projectId !== context.projectId) return false;
    if (strategy.status !== ReleaseStrategyStatus.ACTIVE) return false;
    if (strategy.moduleCode !== String(context.moduleCode).toUpperCase()) return false;
    if (strategy.processCode !== String(context.processCode).toUpperCase()) {
      return false;
    }
    if (
      strategy.documentType &&
      !this.matchesDocumentType(strategy.documentType, context.documentType)
    ) {
      return false;
    }

    const conditions = [...(strategy.conditions || [])].sort(
      (a, b) => a.sequence - b.sequence,
    );
    if (conditions.length === 0) {
      return strategy.isDefault || true;
    }

    return conditions.every((condition) =>
      this.evaluateCondition(condition, context),
    );
  }

  private matchesDocumentType(
    strategyDocumentType: string | null | undefined,
    contextDocumentType: string | null | undefined,
  ) {
    const strategyValue = String(strategyDocumentType || '')
      .trim()
      .toUpperCase();
    const contextValue = String(contextDocumentType || '')
      .trim()
      .toUpperCase();

    if (!strategyValue) return true;
    if (!contextValue) return false;
    if (strategyValue === contextValue) return true;

    // Allow generic quality document types like RFI to match specific variants
    // such as FLOOR_RFI, UNIT_RFI, or ROOM_RFI.
    if (contextValue.endsWith(`_${strategyValue}`)) return true;
    if (strategyValue.endsWith(`_${contextValue}`)) return true;

    return false;
  }

  private getUnmatchedConditions(
    conditions: ReleaseStrategyCondition[],
    context: ApprovalContextDto,
  ) {
    return [...conditions]
      .sort((a, b) => a.sequence - b.sequence)
      .filter((condition) => !this.evaluateCondition(condition, context))
      .map((condition) => ({
        fieldKey: condition.fieldKey,
        operator: condition.operator,
      }));
  }

  private evaluateCondition(
    condition: ReleaseStrategyCondition,
    context: ApprovalContextDto,
  ) {
    const currentValue = this.getContextValue(context, condition.fieldKey);
    const fromValue = condition.valueFrom;
    const toValue = condition.valueTo;
    const jsonValue = condition.valueJson;

    switch (condition.operator) {
      case ReleaseStrategyOperator.EQ:
        return this.normalizeComparable(currentValue) === this.normalizeComparable(fromValue ?? jsonValue);
      case ReleaseStrategyOperator.NE:
        return this.normalizeComparable(currentValue) !== this.normalizeComparable(fromValue ?? jsonValue);
      case ReleaseStrategyOperator.IN:
        return this.toArray(jsonValue ?? fromValue).includes(
          this.normalizeComparable(currentValue),
        );
      case ReleaseStrategyOperator.NOT_IN:
        return !this.toArray(jsonValue ?? fromValue).includes(
          this.normalizeComparable(currentValue),
        );
      case ReleaseStrategyOperator.GT:
        return Number(currentValue) > Number(fromValue);
      case ReleaseStrategyOperator.GTE:
        return Number(currentValue) >= Number(fromValue);
      case ReleaseStrategyOperator.LT:
        return Number(currentValue) < Number(fromValue);
      case ReleaseStrategyOperator.LTE:
        return Number(currentValue) <= Number(fromValue);
      case ReleaseStrategyOperator.BETWEEN:
        return (
          Number(currentValue) >= Number(fromValue) &&
          Number(currentValue) <= Number(toValue)
        );
      case ReleaseStrategyOperator.EXISTS:
        return !this.isEmptyValue(currentValue);
      case ReleaseStrategyOperator.NOT_EXISTS:
        return this.isEmptyValue(currentValue);
      default:
        return false;
    }
  }

  private getContextValue(context: ApprovalContextDto, fieldKey: string) {
    const direct = (context as any)[fieldKey];
    if (direct !== undefined) return direct;
    return context.extraAttributes?.[fieldKey];
  }

  private resolveStepApprovers(
    step: ReleaseStrategyStep,
    actors: EligibleApproverDto[],
  ) {
    if (step.approverMode === ReleaseStrategyApproverMode.USER) {
      const selectedUserIds = new Set(
        step.userIds?.length
          ? step.userIds
          : step.userId
            ? [step.userId]
            : [],
      );
      return actors.filter((actor) => selectedUserIds.has(actor.userId));
    }
    if (step.approverMode === ReleaseStrategyApproverMode.PROJECT_ROLE) {
      return actors.filter((actor) => actor.projectRoleIds.includes(step.roleId || 0));
    }
    return [];
  }

  private normalizeComparable(value: any) {
    if (value === undefined || value === null) return null;
    return String(value).trim().toUpperCase();
  }

  private toArray(value: any) {
    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeComparable(item));
    }
    if (value === undefined || value === null) return [];
    return String(value)
      .split(',')
      .map((item) => this.normalizeComparable(item))
      .filter(Boolean);
  }

  private isEmptyValue(value: any) {
    return (
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    );
  }
}
