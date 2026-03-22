import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { IssueTrackerDepartment } from './entities/issue-tracker-department.entity';
import { IssueTrackerDeptProjectConfig } from './entities/issue-tracker-dept-project-config.entity';
import { IssueTrackerIssue, IssuePriority, IssueTrackerStatus } from './entities/issue-tracker-issue.entity';
import { CommittedDateRecord, IssueTrackerStep, IssueTrackerStepStatus } from './entities/issue-tracker-step.entity';
import { IssueTrackerTag } from './entities/issue-tracker-tag.entity';
import { IssueTrackerActivityLog } from './entities/issue-tracker-activity-log.entity';
import { IssueTrackerAttachment } from './entities/issue-tracker-attachment.entity';
import { IssueTrackerNotification, IssueNotificationType } from './entities/issue-tracker-notification.entity';
import {
  AddDeptToFlowDto,
  CloseIssueTrackerIssueDto,
  CoordinatorCloseStepDto,
  CreateIssueTrackerIssueDto,
  CreateIssueTrackerTagDto,
  ReorderFlowDto,
  RespondIssueTrackerStepDto,
  SetDeptProjectConfigDto,
  UpdateCommitmentDateDto,
  UpdateIssuePriorityDto,
  UpsertGlobalDepartmentDto,
  ReorderDepartmentsDto,
  UpdateIssueDto,
} from './dto/issue-tracker.dto';

@Injectable()
export class IssueTrackerService {
  constructor(
    @InjectRepository(IssueTrackerDepartment)
    private readonly departmentRepo: Repository<IssueTrackerDepartment>,
    @InjectRepository(IssueTrackerDeptProjectConfig)
    private readonly deptConfigRepo: Repository<IssueTrackerDeptProjectConfig>,
    @InjectRepository(IssueTrackerTag)
    private readonly tagRepo: Repository<IssueTrackerTag>,
    @InjectRepository(IssueTrackerIssue)
    private readonly issueRepo: Repository<IssueTrackerIssue>,
    @InjectRepository(IssueTrackerStep)
    private readonly stepRepo: Repository<IssueTrackerStep>,
    @InjectRepository(IssueTrackerActivityLog)
    private readonly activityLogRepo: Repository<IssueTrackerActivityLog>,
    @InjectRepository(IssueTrackerAttachment)
    private readonly attachmentRepo: Repository<IssueTrackerAttachment>,
    @InjectRepository(IssueTrackerNotification)
    private readonly notificationRepo: Repository<IssueTrackerNotification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private getUserId(user: any): number | null {
    return Number(user?.id || user?.userId || user?.sub || 0) || null;
  }

  private getUserName(user: any): string {
    return user?.fullName || user?.username || user?.email || 'System';
  }

  private isAdmin(user: any): boolean {
    const roles = user?.roles || [];
    return (
      user?.role === 'Admin' ||
      roles.includes?.('Admin') ||
      roles.some?.((r: any) => r === 'Admin' || r?.name === 'Admin')
    );
  }

  private formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private addDays(d: Date, days: number): Date {
    const result = new Date(d);
    result.setDate(result.getDate() + days);
    return result;
  }

  private async logActivity(
    issueId: number,
    projectId: number,
    action: string,
    detail: string,
    user: any,
    metadata?: Record<string, any>,
  ) {
    const log = this.activityLogRepo.create({
      issueId,
      projectId,
      action,
      detail,
      metadata: metadata || null,
      actorUserId: this.getUserId(user),
      actorName: this.getUserName(user),
    });
    await this.activityLogRepo.save(log);
  }

  private async createNotification(
    recipientUserId: number,
    issueId: number,
    projectId: number,
    type: IssueNotificationType,
    message: string,
    issueTitle?: string,
  ) {
    const notif = this.notificationRepo.create({
      recipientUserId,
      issueId,
      projectId,
      type,
      message,
      issueTitle: issueTitle || null,
    });
    await this.notificationRepo.save(notif);
  }

  private async notifyDeptMembers(
    deptConfig: IssueTrackerDeptProjectConfig,
    issueId: number,
    projectId: number,
    type: IssueNotificationType,
    message: string,
    issueTitle?: string,
  ) {
    const memberIds = deptConfig.memberUserIds || [];
    const recipientIds = new Set<number>(memberIds);
    if (deptConfig.coordinatorUserId) recipientIds.add(deptConfig.coordinatorUserId);
    for (const uid of recipientIds) {
      await this.createNotification(uid, issueId, projectId, type, message, issueTitle);
    }
  }

  private async generateIssueNumber(projectId: number): Promise<string> {
    const count = await this.issueRepo.count({ where: { projectId } });
    return `ISS-${String(count + 1).padStart(4, '0')}`;
  }

  // ─── Users ────────────────────────────────────────────────────────────────

  async listUsers() {
    const users = await this.userRepo.find({ order: { username: 'ASC' } });
    return users.map((user) => ({
      id: user.id,
      username: user.username,
      fullName: (user as any).fullName || null,
    }));
  }

  // ─── Global Departments (Admin) ───────────────────────────────────────────

  async listGlobalDepartments() {
    return this.departmentRepo.find({
      order: { sequenceOrder: 'ASC', name: 'ASC' },
    });
  }

  async createGlobalDepartment(dto: UpsertGlobalDepartmentDto) {
    const maxOrder = await this.departmentRepo
      .createQueryBuilder('d')
      .select('MAX(d.sequenceOrder)', 'max')
      .getRawOne();
    const nextOrder = (maxOrder?.max ?? 0) + 1;
    const entity = this.departmentRepo.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      color: dto.color?.trim() || null,
      icon: dto.icon?.trim() || null,
      sequenceOrder: dto.sequenceOrder ?? nextOrder,
      defaultSlaDays: dto.defaultSlaDays || null,
      isActive: dto.isActive ?? true,
    });
    return this.departmentRepo.save(entity);
  }

  async updateGlobalDepartment(id: number, dto: UpsertGlobalDepartmentDto) {
    const entity = await this.departmentRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Department not found');
    entity.name = dto.name.trim();
    entity.description = dto.description?.trim() || null;
    entity.color = dto.color?.trim() || null;
    entity.icon = dto.icon?.trim() || null;
    if (dto.sequenceOrder != null) entity.sequenceOrder = dto.sequenceOrder;
    if (dto.defaultSlaDays != null) entity.defaultSlaDays = dto.defaultSlaDays;
    entity.isActive = dto.isActive ?? entity.isActive;
    return this.departmentRepo.save(entity);
  }

  async deleteGlobalDepartment(id: number) {
    const entity = await this.departmentRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Department not found');
    entity.isActive = false;
    await this.departmentRepo.save(entity);
    return { success: true };
  }

  async reorderGlobalDepartments(dto: ReorderDepartmentsDto) {
    for (let i = 0; i < dto.orderedIds.length; i++) {
      await this.departmentRepo.update({ id: dto.orderedIds[i] }, { sequenceOrder: i + 1 });
    }
    return this.listGlobalDepartments();
  }

  // ─── Project Dept Config ──────────────────────────────────────────────────

  async listDeptConfig(projectId: number) {
    const configs = await this.deptConfigRepo.find({
      where: { projectId },
      order: { id: 'ASC' },
    });
    const globalDepts = await this.departmentRepo.find({
      where: { isActive: true },
      order: { sequenceOrder: 'ASC' },
    });
    return { configs, globalDepts };
  }

  async setDeptConfig(projectId: number, dto: SetDeptProjectConfigDto) {
    const dept = await this.departmentRepo.findOne({ where: { id: dto.departmentId, isActive: true } });
    if (!dept) throw new BadRequestException('Department not found or inactive');

    let config = await this.deptConfigRepo.findOne({
      where: { projectId, departmentId: dto.departmentId },
    });
    if (!config) {
      config = this.deptConfigRepo.create({ projectId, departmentId: dto.departmentId });
    }
    config.departmentName = dept.name;
    config.memberUserIds = dto.memberUserIds || [];
    config.coordinatorUserId = dto.coordinatorUserId || null;
    config.coordinatorName = dto.coordinatorName || null;
    config.isIncludedInDefaultFlow = dto.isIncludedInDefaultFlow ?? true;
    return this.deptConfigRepo.save(config);
  }

  async removeDeptConfig(projectId: number, configId: number) {
    const config = await this.deptConfigRepo.findOne({ where: { id: configId, projectId } });
    if (!config) throw new NotFoundException('Config not found');
    await this.deptConfigRepo.remove(config);
    return { success: true };
  }

  // ─── Tags ─────────────────────────────────────────────────────────────────

  async listTags(projectId: number) {
    return this.tagRepo.find({
      where: { projectId },
      order: { isActive: 'DESC', name: 'ASC' },
    });
  }

  async createTag(projectId: number, dto: CreateIssueTrackerTagDto) {
    const dept = await this.departmentRepo.findOne({
      where: { id: dto.departmentId, isActive: true },
    });
    if (!dept) throw new BadRequestException('Selected department is invalid');
    const entity = this.tagRepo.create({
      projectId,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      departmentId: dept.id,
      departmentName: dept.name,
      isActive: dto.isActive ?? true,
    });
    return this.tagRepo.save(entity);
  }

  async updateTag(projectId: number, id: number, dto: CreateIssueTrackerTagDto) {
    const entity = await this.tagRepo.findOne({ where: { id, projectId } });
    if (!entity) throw new NotFoundException('Tag not found');
    const dept = await this.departmentRepo.findOne({
      where: { id: dto.departmentId, isActive: true },
    });
    if (!dept) throw new BadRequestException('Selected department is invalid');
    entity.name = dto.name.trim();
    entity.description = dto.description?.trim() || null;
    entity.departmentId = dept.id;
    entity.departmentName = dept.name;
    entity.isActive = dto.isActive ?? entity.isActive;
    return this.tagRepo.save(entity);
  }

  // ─── Issues ───────────────────────────────────────────────────────────────

  async createIssue(projectId: number, dto: CreateIssueTrackerIssueDto, user: any) {
    if (!dto.tagIds?.length) {
      throw new BadRequestException('At least one tag is required');
    }
    const tags = await this.tagRepo.find({
      where: { projectId, id: In(dto.tagIds), isActive: true },
      order: { id: 'ASC' },
    });
    if (tags.length !== dto.tagIds.length) {
      throw new BadRequestException('One or more selected tags are invalid');
    }

    const orderedTags = dto.tagIds
      .map((id) => tags.find((tag) => tag.id === id))
      .filter(Boolean) as IssueTrackerTag[];

    // Determine department flow
    let departments: { id: number; name: string; slaDays: number | null }[];

    if (dto.customFlowDepartmentIds?.length) {
      // Custom flow specified at creation
      const depts = await this.departmentRepo.find({
        where: { id: In(dto.customFlowDepartmentIds), isActive: true },
      });
      departments = dto.customFlowDepartmentIds
        .map((did) => {
          const d = depts.find((x) => x.id === did);
          return d ? { id: d.id, name: d.name, slaDays: d.defaultSlaDays } : null;
        })
        .filter(Boolean) as { id: number; name: string; slaDays: number | null }[];
    } else {
      // Default flow from project dept config (in global sequence order)
      const configs = await this.deptConfigRepo.find({
        where: { projectId, isIncludedInDefaultFlow: true },
        order: { id: 'ASC' },
      });
      const globalDepts = await this.departmentRepo.find({
        where: { isActive: true },
        order: { sequenceOrder: 'ASC' },
      });

      // Filter to depts that match the selected tags' departments, in global sequence order
      const tagDeptIds = new Set(orderedTags.map((t) => t.departmentId));
      const configuredDeptIds = new Set(configs.map((c) => c.departmentId));
      departments = globalDepts
        .filter((d) => tagDeptIds.has(d.id) && configuredDeptIds.has(d.id))
        .map((d) => ({ id: d.id, name: d.name, slaDays: d.defaultSlaDays }));
    }

    if (!departments.length) {
      throw new BadRequestException('No department flow could be derived from the selected tags');
    }

    const issueNumber = await this.generateIssueNumber(projectId);

    const issue = this.issueRepo.create({
      projectId,
      issueNumber,
      title: dto.title.trim(),
      description: dto.description.trim(),
      tagIds: dto.tagIds,
      tagNames: orderedTags.map((tag) => tag.name),
      raisedByUserId: this.getUserId(user),
      raisedByName: this.getUserName(user),
      raisedDate: new Date(),
      requiredDate: dto.requiredDate || null,
      priority: (dto.priority as IssuePriority) || IssuePriority.MEDIUM,
      customFlowDepartmentIds: dto.customFlowDepartmentIds || null,
      status: IssueTrackerStatus.OPEN,
      currentDepartmentId: departments[0].id,
      currentDepartmentName: departments[0].name,
      currentStepIndex: 0,
    });
    const savedIssue = await this.issueRepo.save(issue);

    const steps = departments.map((department, index) =>
      this.stepRepo.create({
        issueId: savedIssue.id,
        projectId,
        sequenceNo: index + 1,
        departmentId: department.id,
        departmentName: department.name,
        slaDays: department.slaDays,
        status: index === 0 ? IssueTrackerStepStatus.ACTIVE : IssueTrackerStepStatus.PENDING,
      }),
    );
    await this.stepRepo.save(steps);

    // Log creation
    await this.logActivity(savedIssue.id, projectId, 'CREATED',
      `Issue ${issueNumber} created by ${this.getUserName(user)}`, user);

    // Notify first dept
    const firstDeptConfig = await this.deptConfigRepo.findOne({
      where: { projectId, departmentId: departments[0].id },
    });
    if (firstDeptConfig) {
      await this.notifyDeptMembers(
        firstDeptConfig, savedIssue.id, projectId,
        IssueNotificationType.ISSUE_ASSIGNED,
        `New issue ${issueNumber}: ${savedIssue.title}`,
        savedIssue.title,
      );
    }

    return this.getIssueDetail(projectId, savedIssue.id, user);
  }

  async listIssues(
    projectId: number,
    user: any,
    scope = 'all',
    status?: string,
    priority?: string,
    departmentId?: number,
  ) {
    const userId = this.getUserId(user);
    const userDeptIds = await this.getDeptIdsForUser(projectId, userId);

    const issues = await this.issueRepo.find({
      where: { projectId },
      order: { updatedAt: 'DESC', id: 'DESC' },
    });
    const steps = await this.stepRepo.find({
      where: { projectId },
      order: { issueId: 'ASC', sequenceNo: 'ASC' },
    });
    const stepsByIssue = new Map<number, IssueTrackerStep[]>();
    for (const step of steps) {
      const bucket = stepsByIssue.get(step.issueId) || [];
      bucket.push(step);
      stepsByIssue.set(step.issueId, bucket);
    }

    const filtered = issues.filter((issue) => {
      if (status && issue.status !== status) return false;
      if (priority && issue.priority !== priority) return false;
      if (departmentId && issue.currentDepartmentId !== departmentId) return false;
      if (scope === 'department') {
        return (
          issue.currentDepartmentId != null &&
          userDeptIds.includes(issue.currentDepartmentId) &&
          issue.status !== IssueTrackerStatus.CLOSED
        );
      }
      if (scope === 'my') return issue.raisedByUserId === userId;
      if (scope === 'overdue') {
        return (
          issue.requiredDate != null &&
          issue.requiredDate < this.formatDate(new Date()) &&
          ![IssueTrackerStatus.CLOSED, IssueTrackerStatus.COMPLETED].includes(issue.status)
        );
      }
      return true;
    });

    return filtered.map((issue) => {
      const issueSteps = stepsByIssue.get(issue.id) || [];
      const isRelevantToCurrentUser =
        issue.currentDepartmentId != null && userDeptIds.includes(issue.currentDepartmentId);
      return {
        ...issue,
        steps: issueSteps,
        isRelevantToCurrentUser,
        canRespond:
          isRelevantToCurrentUser &&
          issue.status !== IssueTrackerStatus.CLOSED &&
          issueSteps.some((s) => s.status === IssueTrackerStepStatus.ACTIVE && !s.memberRespondedAt),
        canCoordinatorClose:
          isRelevantToCurrentUser &&
          issue.status !== IssueTrackerStatus.CLOSED &&
          issueSteps.some(
            (s) =>
              s.status === IssueTrackerStepStatus.ACTIVE &&
              s.memberRespondedAt != null &&
              s.coordinatorClosedAt == null,
          ),
        canClose:
          (this.isAdmin(user) || user?.permissions?.includes?.('PLANNING.MATRIX.UPDATE')) &&
          issue.status === IssueTrackerStatus.COMPLETED,
      };
    });
  }

  async getIssueDetail(projectId: number, issueId: number, user: any) {
    const all = await this.listIssues(projectId, user);
    const match = all.find((row) => row.id === issueId);
    if (!match) throw new NotFoundException('Issue not found');
    return match;
  }

  async updateIssue(projectId: number, issueId: number, dto: UpdateIssueDto, user: any) {
    const issue = await this.issueRepo.findOne({ where: { id: issueId, projectId } });
    if (!issue) throw new NotFoundException('Issue not found');
    if (issue.status === IssueTrackerStatus.CLOSED) {
      throw new BadRequestException('Cannot edit a closed issue');
    }
    if (dto.title) issue.title = dto.title.trim();
    if (dto.description) issue.description = dto.description.trim();
    if (dto.requiredDate !== undefined) issue.requiredDate = dto.requiredDate || null;
    if (dto.priority) {
      const oldPriority = issue.priority;
      issue.priority = dto.priority as IssuePriority;
      await this.logActivity(issueId, projectId, 'PRIORITY_CHANGED',
        `Priority changed from ${oldPriority} to ${dto.priority}`, user);
    }
    await this.issueRepo.save(issue);
    return this.getIssueDetail(projectId, issueId, user);
  }

  // ─── Member Response ──────────────────────────────────────────────────────

  async respondToIssue(
    projectId: number,
    issueId: number,
    dto: RespondIssueTrackerStepDto,
    user: any,
  ) {
    const issue = await this.issueRepo.findOne({ where: { id: issueId, projectId } });
    if (!issue) throw new NotFoundException('Issue not found');
    if (issue.status === IssueTrackerStatus.CLOSED) {
      throw new BadRequestException('Closed issue cannot be updated');
    }

    const activeStep = await this.stepRepo.findOne({
      where: { issueId, projectId, status: IssueTrackerStepStatus.ACTIVE },
      order: { sequenceNo: 'ASC' },
    });
    if (!activeStep) throw new BadRequestException('No active department step is pending');

    const userId = this.getUserId(user);
    const deptConfig = await this.deptConfigRepo.findOne({
      where: { projectId, departmentId: activeStep.departmentId },
    });

    const isMember = (deptConfig?.memberUserIds || []).includes(userId as number);
    if (!this.isAdmin(user) && !isMember) {
      throw new ForbiddenException('You are not assigned to the active department for this issue');
    }

    // Handle commitment date history
    if (dto.committedCompletionDate && activeStep.committedCompletionDate &&
        activeStep.committedCompletionDate !== dto.committedCompletionDate) {
      if (!dto.reason) {
        throw new BadRequestException('A reason is required when changing a committed date');
      }
      const record: CommittedDateRecord = {
        previousDate: activeStep.committedCompletionDate,
        newDate: dto.committedCompletionDate,
        changedAt: new Date().toISOString(),
        changedByName: this.getUserName(user),
        reason: dto.reason,
      };
      activeStep.committedDateHistory = [...(activeStep.committedDateHistory || []), record];
    }

    activeStep.responseText = dto.responseText.trim();
    activeStep.committedCompletionDate = dto.committedCompletionDate || activeStep.committedCompletionDate;
    activeStep.respondedDate = new Date();
    activeStep.respondedByUserId = userId;
    activeStep.respondedByName = this.getUserName(user);
    activeStep.memberRespondedAt = new Date();
    // Do NOT mark as COMPLETED yet — coordinator must close
    await this.stepRepo.save(activeStep);

    issue.respondedDate = issue.respondedDate || new Date();
    issue.committedCompletionDate = dto.committedCompletionDate || issue.committedCompletionDate;
    issue.status = IssueTrackerStatus.IN_PROGRESS;
    await this.issueRepo.save(issue);

    await this.logActivity(issueId, projectId, 'RESPONDED',
      `${this.getUserName(user)} responded: "${dto.responseText.slice(0, 80)}"`, user);

    // Notify coordinator
    if (deptConfig?.coordinatorUserId) {
      await this.createNotification(
        deptConfig.coordinatorUserId, issueId, projectId,
        IssueNotificationType.ISSUE_ASSIGNED,
        `${this.getUserName(user)} responded to ${issue.issueNumber}. Please review and close.`,
        issue.title,
      );
    }

    return this.getIssueDetail(projectId, issueId, user);
  }

  // ─── Coordinator Close Step ───────────────────────────────────────────────

  async coordinatorCloseStep(
    projectId: number,
    issueId: number,
    dto: CoordinatorCloseStepDto,
    user: any,
  ) {
    const issue = await this.issueRepo.findOne({ where: { id: issueId, projectId } });
    if (!issue) throw new NotFoundException('Issue not found');
    if (issue.status === IssueTrackerStatus.CLOSED) {
      throw new BadRequestException('Issue is already closed');
    }

    const activeStep = await this.stepRepo.findOne({
      where: { issueId, projectId, status: IssueTrackerStepStatus.ACTIVE },
      order: { sequenceNo: 'ASC' },
    });
    if (!activeStep) throw new BadRequestException('No active step to close');
    if (!activeStep.memberRespondedAt) {
      throw new BadRequestException('Member has not responded yet. Coordinator can only close after member responds.');
    }
    if (activeStep.coordinatorClosedAt) {
      throw new BadRequestException('This step has already been coordinator-closed');
    }

    const userId = this.getUserId(user);
    const deptConfig = await this.deptConfigRepo.findOne({
      where: { projectId, departmentId: activeStep.departmentId },
    });

    const isCoordinator = deptConfig?.coordinatorUserId === userId;
    if (!this.isAdmin(user) && !isCoordinator) {
      throw new ForbiddenException('Only the department coordinator can close this step');
    }

    const closedDeptName = activeStep.departmentName;

    // Close the active step
    activeStep.coordinatorClosedAt = new Date();
    activeStep.coordinatorClosedById = userId;
    activeStep.coordinatorRemarks = dto.remarks?.trim() || null;
    activeStep.status = IssueTrackerStepStatus.COMPLETED;
    await this.stepRepo.save(activeStep);

    // Advance to next step
    const nextStep = await this.stepRepo.findOne({
      where: { issueId, projectId, status: IssueTrackerStepStatus.PENDING },
      order: { sequenceNo: 'ASC' },
    });

    if (nextStep) {
      nextStep.status = IssueTrackerStepStatus.ACTIVE;
      await this.stepRepo.save(nextStep);
      issue.status = IssueTrackerStatus.IN_PROGRESS;
      issue.currentStepIndex = nextStep.sequenceNo - 1;
      issue.currentDepartmentId = nextStep.departmentId;
      issue.currentDepartmentName = nextStep.departmentName;
      await this.issueRepo.save(issue);

      // Log and notify
      await this.logActivity(issueId, projectId, 'COORDINATOR_CLOSED',
        `${closedDeptName} step closed by coordinator. Moved to ${nextStep.departmentName}.`, user);

      const nextDeptConfig = await this.deptConfigRepo.findOne({
        where: { projectId, departmentId: nextStep.departmentId },
      });
      if (nextDeptConfig) {
        await this.notifyDeptMembers(
          nextDeptConfig, issueId, projectId,
          IssueNotificationType.ISSUE_ASSIGNED,
          `Issue ${issue.issueNumber} has moved to your department: ${issue.title}`,
          issue.title,
        );
      }
      // Notify raiser
      if (issue.raisedByUserId) {
        await this.createNotification(
          issue.raisedByUserId, issueId, projectId,
          IssueNotificationType.DEPT_CLOSED_MOVED,
          `${closedDeptName} completed. Issue ${issue.issueNumber} moved to ${nextStep.departmentName}.`,
          issue.title,
        );
      }
    } else {
      // All steps done
      issue.status = IssueTrackerStatus.COMPLETED;
      issue.currentDepartmentId = null;
      issue.currentDepartmentName = null;
      issue.currentStepIndex = activeStep.sequenceNo;
      await this.issueRepo.save(issue);

      await this.logActivity(issueId, projectId, 'COORDINATOR_CLOSED',
        `All departments completed. Issue ${issue.issueNumber} is ready to close.`, user);

      if (issue.raisedByUserId) {
        await this.createNotification(
          issue.raisedByUserId, issueId, projectId,
          IssueNotificationType.DEPT_CLOSED_MOVED,
          `All departments have completed. Issue ${issue.issueNumber} is ready for final close.`,
          issue.title,
        );
      }
    }

    return this.getIssueDetail(projectId, issueId, user);
  }

  // ─── Update Commitment Date ───────────────────────────────────────────────

  async updateCommitmentDate(
    projectId: number,
    issueId: number,
    dto: UpdateCommitmentDateDto,
    user: any,
  ) {
    const issue = await this.issueRepo.findOne({ where: { id: issueId, projectId } });
    if (!issue) throw new NotFoundException('Issue not found');

    const activeStep = await this.stepRepo.findOne({
      where: { issueId, projectId, status: IssueTrackerStepStatus.ACTIVE },
      order: { sequenceNo: 'ASC' },
    });
    if (!activeStep) throw new BadRequestException('No active step found');

    if (activeStep.committedCompletionDate && !dto.reason) {
      throw new BadRequestException('A reason is required when changing an existing commitment date');
    }

    if (activeStep.committedCompletionDate) {
      const record: CommittedDateRecord = {
        previousDate: activeStep.committedCompletionDate,
        newDate: dto.newDate,
        changedAt: new Date().toISOString(),
        changedByName: this.getUserName(user),
        reason: dto.reason || 'Updated',
      };
      activeStep.committedDateHistory = [...(activeStep.committedDateHistory || []), record];
    }

    activeStep.committedCompletionDate = dto.newDate;
    await this.stepRepo.save(activeStep);

    issue.committedCompletionDate = dto.newDate;
    await this.issueRepo.save(issue);

    await this.logActivity(issueId, projectId, 'COMMITMENT_DATE_CHANGED',
      `Commitment date changed to ${dto.newDate}. Reason: ${dto.reason || 'None'}`, user,
      { previousDate: activeStep.committedDateHistory?.slice(-2, -1)?.[0]?.previousDate, newDate: dto.newDate });

    if (issue.raisedByUserId) {
      await this.createNotification(
        issue.raisedByUserId, issueId, projectId,
        IssueNotificationType.COMMITMENT_DUE_SOON,
        `Commitment date for ${issue.issueNumber} updated to ${dto.newDate} by ${this.getUserName(user)}.`,
        issue.title,
      );
    }

    return this.getIssueDetail(projectId, issueId, user);
  }

  // ─── Close Issue (Final) ──────────────────────────────────────────────────

  async closeIssue(
    projectId: number,
    issueId: number,
    dto: CloseIssueTrackerIssueDto,
    user: any,
  ) {
    const issue = await this.issueRepo.findOne({ where: { id: issueId, projectId } });
    if (!issue) throw new NotFoundException('Issue not found');
    if (!this.isAdmin(user) && !user?.permissions?.includes?.('PLANNING.MATRIX.UPDATE')) {
      throw new ForbiddenException('You do not have permission to close issues');
    }
    issue.status = IssueTrackerStatus.CLOSED;
    issue.closedDate = new Date();
    issue.closedRemarks = dto.closedRemarks?.trim() || null;
    issue.closedByUserId = this.getUserId(user);
    issue.closedByName = this.getUserName(user);
    issue.currentDepartmentId = null;
    issue.currentDepartmentName = null;
    await this.issueRepo.save(issue);

    await this.logActivity(issueId, projectId, 'ISSUE_CLOSED',
      `Issue closed by ${this.getUserName(user)}`, user,
      { remarks: dto.closedRemarks });

    // Notify raiser
    if (issue.raisedByUserId) {
      await this.createNotification(
        issue.raisedByUserId, issueId, projectId,
        IssueNotificationType.ISSUE_CLOSED,
        `Issue ${issue.issueNumber} has been officially closed.`,
        issue.title,
      );
    }

    return this.getIssueDetail(projectId, issueId, user);
  }

  // ─── Priority Change ──────────────────────────────────────────────────────

  async updatePriority(projectId: number, issueId: number, dto: UpdateIssuePriorityDto, user: any) {
    const issue = await this.issueRepo.findOne({ where: { id: issueId, projectId } });
    if (!issue) throw new NotFoundException('Issue not found');
    const oldPriority = issue.priority;
    issue.priority = dto.priority as IssuePriority;
    await this.issueRepo.save(issue);
    await this.logActivity(issueId, projectId, 'PRIORITY_CHANGED',
      `Priority changed from ${oldPriority} to ${dto.priority}`, user);
    return this.getIssueDetail(projectId, issueId, user);
  }

  // ─── Flow Editing ─────────────────────────────────────────────────────────

  async addDeptToFlow(projectId: number, issueId: number, dto: AddDeptToFlowDto, user: any) {
    const issue = await this.issueRepo.findOne({ where: { id: issueId, projectId } });
    if (!issue) throw new NotFoundException('Issue not found');
    if (issue.status === IssueTrackerStatus.CLOSED) {
      throw new BadRequestException('Cannot edit flow of a closed issue');
    }

    const dept = await this.departmentRepo.findOne({ where: { id: dto.departmentId, isActive: true } });
    if (!dept) throw new BadRequestException('Department not found');

    // Find current max sequenceNo
    const pendingSteps = await this.stepRepo.find({
      where: { issueId, projectId, status: IssueTrackerStepStatus.PENDING },
      order: { sequenceNo: 'ASC' },
    });

    let insertAfterSeqNo: number;
    if (dto.insertAfterStepId) {
      const afterStep = await this.stepRepo.findOne({ where: { id: dto.insertAfterStepId, issueId } });
      if (!afterStep) throw new BadRequestException('Reference step not found');
      insertAfterSeqNo = afterStep.sequenceNo;
    } else {
      const maxStep = await this.stepRepo
        .createQueryBuilder('s')
        .where('s.issueId = :issueId', { issueId })
        .select('MAX(s.sequenceNo)', 'max')
        .getRawOne();
      insertAfterSeqNo = maxStep?.max ?? 0;
    }

    // Shift all PENDING steps after the insertion point
    for (const step of pendingSteps) {
      if (step.sequenceNo > insertAfterSeqNo) {
        step.sequenceNo += 1;
        await this.stepRepo.save(step);
      }
    }

    const newStep = this.stepRepo.create({
      issueId,
      projectId,
      sequenceNo: insertAfterSeqNo + 1,
      departmentId: dept.id,
      departmentName: dept.name,
      slaDays: dept.defaultSlaDays,
      status: IssueTrackerStepStatus.PENDING,
    });
    await this.stepRepo.save(newStep);

    await this.logActivity(issueId, projectId, 'DEPARTMENT_ADDED',
      `${dept.name} added to issue flow by ${this.getUserName(user)}`, user);

    return this.getIssueDetail(projectId, issueId, user);
  }

  async removeDeptFromFlow(projectId: number, issueId: number, stepId: number, user: any) {
    const step = await this.stepRepo.findOne({ where: { id: stepId, issueId, projectId } });
    if (!step) throw new NotFoundException('Step not found');
    if (step.status !== IssueTrackerStepStatus.PENDING) {
      throw new BadRequestException('Only PENDING steps can be removed from the flow');
    }
    const deptName = step.departmentName;
    const removedSeqNo = step.sequenceNo;
    await this.stepRepo.remove(step);

    // Re-sequence remaining steps
    const remaining = await this.stepRepo.find({
      where: { issueId, projectId },
      order: { sequenceNo: 'ASC' },
    });
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].sequenceNo !== i + 1) {
        remaining[i].sequenceNo = i + 1;
        await this.stepRepo.save(remaining[i]);
      }
    }

    await this.logActivity(issueId, projectId, 'DEPARTMENT_REMOVED',
      `${deptName} removed from issue flow by ${this.getUserName(user)}`, user);

    return this.getIssueDetail(projectId, issueId, user);
  }

  async reorderFlow(projectId: number, issueId: number, dto: ReorderFlowDto, user: any) {
    const pendingSteps = await this.stepRepo.find({
      where: { issueId, projectId, status: IssueTrackerStepStatus.PENDING },
    });

    // Only reorder PENDING steps — completed/active stay as is
    const pendingIds = new Set(pendingSteps.map((s) => s.id));
    for (const stepId of dto.stepIds) {
      if (!pendingIds.has(stepId)) {
        throw new BadRequestException(`Step ${stepId} is not a pending step and cannot be reordered`);
      }
    }

    // Get active step's sequenceNo to offset PENDING after it
    const activeStep = await this.stepRepo.findOne({
      where: { issueId, projectId, status: IssueTrackerStepStatus.ACTIVE },
    });
    const offset = activeStep ? activeStep.sequenceNo : 0;

    for (let i = 0; i < dto.stepIds.length; i++) {
      await this.stepRepo.update({ id: dto.stepIds[i] }, { sequenceNo: offset + i + 1 });
    }

    await this.logActivity(issueId, projectId, 'FLOW_EDITED',
      `Issue flow reordered by ${this.getUserName(user)}`, user);

    return this.getIssueDetail(projectId, issueId, user);
  }

  // ─── Kanban ───────────────────────────────────────────────────────────────

  async getKanban(projectId: number, user: any) {
    const allIssues = await this.listIssues(projectId, user);

    const deptConfigs = await this.deptConfigRepo.find({
      where: { projectId },
      order: { id: 'ASC' },
    });
    const globalDepts = await this.departmentRepo.find({
      where: { isActive: true },
      order: { sequenceOrder: 'ASC' },
    });

    // Build columns: one per active dept in project + COMPLETED + CLOSED
    const columns: Record<string, { label: string; color: string | null; issues: any[] }> = {};

    for (const gDept of globalDepts) {
      const config = deptConfigs.find((c) => c.departmentId === gDept.id);
      if (config) {
        columns[`dept_${gDept.id}`] = {
          label: gDept.name,
          color: gDept.color,
          issues: [],
        };
      }
    }
    columns['COMPLETED'] = { label: 'Completed', color: '#059669', issues: [] };
    columns['CLOSED'] = { label: 'Closed', color: '#6B7280', issues: [] };

    for (const issue of allIssues) {
      if (issue.status === IssueTrackerStatus.CLOSED) {
        columns['CLOSED'].issues.push(issue);
      } else if (issue.status === IssueTrackerStatus.COMPLETED) {
        columns['COMPLETED'].issues.push(issue);
      } else if (issue.currentDepartmentId) {
        const key = `dept_${issue.currentDepartmentId}`;
        if (columns[key]) {
          columns[key].issues.push(issue);
        }
      }
    }

    return { columns: Object.entries(columns).map(([key, val]) => ({ key, ...val })) };
  }

  // ─── Activity Log ─────────────────────────────────────────────────────────

  async getActivityLog(projectId: number, issueId: number) {
    const issue = await this.issueRepo.findOne({ where: { id: issueId, projectId } });
    if (!issue) throw new NotFoundException('Issue not found');
    return this.activityLogRepo.find({
      where: { issueId, projectId },
      order: { createdAt: 'ASC' },
    });
  }

  // ─── Attachments ──────────────────────────────────────────────────────────

  async addAttachment(
    projectId: number,
    issueId: number,
    fileUrl: string,
    originalName: string,
    mimeType: string | null,
    fileSizeBytes: number | null,
    stepId: number | null,
    user: any,
  ) {
    const issue = await this.issueRepo.findOne({ where: { id: issueId, projectId } });
    if (!issue) throw new NotFoundException('Issue not found');

    const attachment = this.attachmentRepo.create({
      issueId,
      projectId,
      stepId,
      fileUrl,
      originalName,
      mimeType,
      fileSizeBytes,
      uploadedByUserId: this.getUserId(user) as number,
      uploadedByName: this.getUserName(user),
    });
    await this.attachmentRepo.save(attachment);

    issue.attachmentCount = (issue.attachmentCount || 0) + 1;
    await this.issueRepo.save(issue);

    await this.logActivity(issueId, projectId, 'ATTACHMENT_ADDED',
      `${this.getUserName(user)} uploaded attachment: ${originalName}`, user);

    return attachment;
  }

  async removeAttachment(projectId: number, issueId: number, attachmentId: number, user: any) {
    const attachment = await this.attachmentRepo.findOne({
      where: { id: attachmentId, issueId, projectId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    await this.attachmentRepo.remove(attachment);

    const issue = await this.issueRepo.findOne({ where: { id: issueId, projectId } });
    if (issue) {
      issue.attachmentCount = Math.max(0, (issue.attachmentCount || 0) - 1);
      await this.issueRepo.save(issue);
    }
    return { success: true };
  }

  async listAttachments(projectId: number, issueId: number) {
    const issue = await this.issueRepo.findOne({ where: { id: issueId, projectId } });
    if (!issue) throw new NotFoundException('Issue not found');
    return this.attachmentRepo.find({ where: { issueId, projectId }, order: { uploadedAt: 'ASC' } });
  }

  // ─── Notifications ────────────────────────────────────────────────────────

  async getMyNotifications(projectId: number, user: any) {
    const userId = this.getUserId(user);
    if (!userId) return [];
    return this.notificationRepo.find({
      where: { projectId, recipientUserId: userId, isRead: false },
      order: { createdAt: 'DESC' },
    });
  }

  async markNotificationRead(projectId: number, notifId: number, user: any) {
    const userId = this.getUserId(user);
    const notif = await this.notificationRepo.findOne({
      where: { id: notifId, projectId, recipientUserId: userId as number },
    });
    if (!notif) throw new NotFoundException('Notification not found');
    notif.isRead = true;
    notif.readAt = new Date();
    return this.notificationRepo.save(notif);
  }

  async markAllNotificationsRead(projectId: number, user: any) {
    const userId = this.getUserId(user);
    if (!userId) return { updated: 0 };
    const result = await this.notificationRepo.update(
      { projectId, recipientUserId: userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return { updated: result.affected || 0 };
  }

  // ─── Daily Cron: Notifications ────────────────────────────────────────────

  @Cron('0 8 * * *')
  async runDailyNotifications() {
    const today = new Date();
    const in3Days = this.formatDate(this.addDays(today, 3));
    const todayStr = this.formatDate(today);

    // 1. Commitment date due in 3 days
    const soonCommitted = await this.stepRepo.find({
      where: { committedCompletionDate: in3Days, status: IssueTrackerStepStatus.ACTIVE },
    });
    for (const step of soonCommitted) {
      const issue = await this.issueRepo.findOne({ where: { id: step.issueId } });
      if (!issue) continue;
      const deptConfig = await this.deptConfigRepo.findOne({
        where: { projectId: step.projectId, departmentId: step.departmentId },
      });
      if (deptConfig) {
        await this.notifyDeptMembers(
          deptConfig, issue.id, issue.projectId,
          IssueNotificationType.COMMITMENT_DUE_SOON,
          `Commitment date for ${issue.issueNumber} is due in 3 days (${in3Days}).`,
          issue.title,
        );
      }
    }

    // 2. Target date due in 3 days
    const soonRequired = await this.issueRepo.find({
      where: { requiredDate: in3Days },
    });
    for (const issue of soonRequired) {
      if ([IssueTrackerStatus.CLOSED, IssueTrackerStatus.COMPLETED].includes(issue.status)) continue;
      if (issue.raisedByUserId) {
        await this.createNotification(
          issue.raisedByUserId, issue.id, issue.projectId,
          IssueNotificationType.TARGET_DATE_DUE_SOON,
          `Issue ${issue.issueNumber} target date is in 3 days (${in3Days}).`,
          issue.title,
        );
      }
    }

    // 3. Overdue issues
    const overdueIssues = await this.issueRepo
      .createQueryBuilder('issue')
      .where('issue.requiredDate < :today', { today: todayStr })
      .andWhere('issue.status NOT IN (:...statuses)', {
        statuses: [IssueTrackerStatus.CLOSED, IssueTrackerStatus.COMPLETED],
      })
      .getMany();
    for (const issue of overdueIssues) {
      if (issue.raisedByUserId) {
        await this.createNotification(
          issue.raisedByUserId, issue.id, issue.projectId,
          IssueNotificationType.OVERDUE,
          `Issue ${issue.issueNumber} is overdue! Required by ${issue.requiredDate}.`,
          issue.title,
        );
      }
      // Also notify current dept
      if (issue.currentDepartmentId) {
        const deptConfig = await this.deptConfigRepo.findOne({
          where: { projectId: issue.projectId, departmentId: issue.currentDepartmentId },
        });
        if (deptConfig) {
          await this.notifyDeptMembers(
            deptConfig, issue.id, issue.projectId,
            IssueNotificationType.OVERDUE,
            `Issue ${issue.issueNumber} is overdue! Pending with your department.`,
            issue.title,
          );
        }
      }
    }

    // 4. Missed commitment dates
    const missedCommitments = await this.stepRepo
      .createQueryBuilder('step')
      .where('step.committedCompletionDate < :today', { today: todayStr })
      .andWhere('step.status = :status', { status: IssueTrackerStepStatus.ACTIVE })
      .getMany();
    for (const step of missedCommitments) {
      const deptConfig = await this.deptConfigRepo.findOne({
        where: { projectId: step.projectId, departmentId: step.departmentId },
      });
      const issue = await this.issueRepo.findOne({ where: { id: step.issueId } });
      if (!issue || !deptConfig) continue;
      await this.notifyDeptMembers(
        deptConfig, issue.id, issue.projectId,
        IssueNotificationType.COMMITMENT_MISSED,
        `Commitment date for ${issue.issueNumber} has passed without resolution.`,
        issue.title,
      );
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async getDeptIdsForUser(projectId: number, userId: number | null): Promise<number[]> {
    if (!userId) return [];
    const configs = await this.deptConfigRepo.find({ where: { projectId } });
    return configs
      .filter((c) => (c.memberUserIds || []).includes(userId) || c.coordinatorUserId === userId)
      .map((c) => c.departmentId);
  }
}
