import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThan, Not, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { PushNotificationService } from '../notifications/push-notification.service';
import {
  AssignmentStatus,
  UserProjectAssignment,
} from '../projects/entities/user-project-assignment.entity';
import { TempUser } from '../temp-user/entities/temp-user.entity';
import {
  FollowUpAction,
  PlanningAssigneeType,
  ProjectTask,
  ProjectTaskComment,
  SiteJournalEntry,
} from './entities/planning-extension.entity';

@Injectable()
export class PlanningExtensionService {
  constructor(
    @InjectRepository(ProjectTask)
    private readonly taskRepo: Repository<ProjectTask>,
    @InjectRepository(ProjectTaskComment)
    private readonly taskCommentRepo: Repository<ProjectTaskComment>,
    @InjectRepository(FollowUpAction)
    private readonly followupRepo: Repository<FollowUpAction>,
    @InjectRepository(SiteJournalEntry)
    private readonly journalRepo: Repository<SiteJournalEntry>,
    @InjectRepository(UserProjectAssignment)
    private readonly assignmentRepo: Repository<UserProjectAssignment>,
    @InjectRepository(TempUser)
    private readonly tempUserRepo: Repository<TempUser>,
    private readonly pushService: PushNotificationService,
  ) {}

  async assigneeOptions(projectId: number) {
    const [assignments, tempUsers] = await Promise.all([
      this.assignmentRepo.find({
        where: { project: { id: projectId }, status: AssignmentStatus.ACTIVE },
        relations: ['user', 'roles'],
        order: { updatedAt: 'DESC' },
      }),
      this.tempUserRepo.find({
        where: { projectId, status: 'ACTIVE' },
        relations: ['user', 'vendor', 'tempRoleTemplate'],
        order: { createdAt: 'DESC' },
      }),
    ]);

    const internal = assignments
      .filter((item) => item.user?.isActive)
      .map((item) => ({
        type: 'INTERNAL_USER' as const,
        id: item.user.id,
        userId: item.user.id,
        tempUserId: null,
        label: this.userLabel(item.user),
        displayName: item.user.displayName,
        username: item.user.username,
        designation: item.user.designation,
        company: 'Internal Team',
        roleNames: (item.roles || []).map((role) => role.name),
      }));

    const vendor = tempUsers
      .filter((item) => item.user?.isActive)
      .map((item) => ({
        type: 'VENDOR_USER' as const,
        id: item.userId,
        userId: item.userId,
        tempUserId: item.id,
        label: `${this.userLabel(item.user)} - ${item.vendor?.name || 'Vendor'}`,
        displayName: item.user.displayName,
        username: item.user.username,
        designation: item.user.designation,
        company: item.vendor?.name || 'Vendor',
        roleNames: item.tempRoleTemplate?.name
          ? [item.tempRoleTemplate.name]
          : [],
      }));

    const seen = new Set<string>();
    return [...internal, ...vendor].filter((item) => {
      const key = `${item.type}:${item.tempUserId || item.userId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async actionSummary(projectId: number) {
    const [activeTasks, completedTasks, overdueFollowups, dueTodayFollowups, todayJournal] =
      await Promise.all([
        this.taskRepo.count({ where: { projectId, status: Not('DONE') } }),
        this.taskRepo.count({ where: { projectId, status: 'DONE' } }),
        this.followupRepo.count({
          where: { projectId, dueDate: LessThan(this.today()), status: Not('CLOSED') },
        }),
        this.followupRepo.count({
          where: { projectId, dueDate: this.today(), status: Not('CLOSED') },
        }),
        this.todayJournal(projectId),
      ]);

    return {
      activeTasks,
      completedTasks,
      overdueFollowups,
      dueTodayFollowups,
      todayJournalStatus: todayJournal?.status || 'NOT_STARTED',
      todayJournalId: todayJournal?.id || null,
    };
  }

  async listTasks(projectId: number, query: any) {
    const where: any = { projectId };
    if (query.assignedToUserId) where.assignedToUserId = Number(query.assignedToUserId);
    if (query.status) where.status = String(query.status).toUpperCase();
    if (query.priority) where.priority = String(query.priority).toUpperCase();
    if (query.taskType) where.taskType = String(query.taskType).toUpperCase();
    if (query.linkedActivityId) where.linkedActivityId = Number(query.linkedActivityId);
    if (query.dueDate) where.dueDate = this.toDate(query.dueDate);
    return this.taskRepo.find({
      where,
      order: { dueDate: 'ASC', id: 'DESC' },
      ...this.page(query),
    });
  }

  async activeTasks(projectId: number, query: any = {}) {
    return this.taskRepo.find({
      where: { projectId, status: Not('DONE') },
      order: { dueDate: 'ASC', id: 'DESC' },
      ...this.page(query),
    });
  }

  async completedTasks(projectId: number, query: any = {}) {
    return this.taskRepo.find({
      where: { projectId, status: 'DONE' },
      order: { completedAt: 'DESC', id: 'DESC' },
      ...this.page(query),
    });
  }

  async taskHistory(projectId: number, query: any = {}) {
    return this.taskRepo.find({
      where: { projectId },
      order: { updatedAt: 'DESC', id: 'DESC' },
      ...this.page(query),
    });
  }

  async myTasks(projectId: number, userId: number, query: any = {}) {
    return this.taskRepo.find({
      where: { projectId, assignedToUserId: userId },
      order: { dueDate: 'ASC', id: 'DESC' },
      ...this.page(query),
    });
  }

  async getTask(projectId: number, id: number) {
    const task = await this.taskRepo.findOne({ where: { id, projectId } });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async createTask(projectId: number, body: any, userId: number) {
    const task = this.taskRepo.create({
      projectId,
      title: this.requiredText(body.title, 'Task title is required'),
      description: body.description || null,
      status: this.normalizeTaskStatus(body.status),
      priority: this.normalizePriority(body.priority),
      taskType: this.normalizeCode(body.taskType, 'GENERAL'),
      assignedToType: this.normalizeAssigneeType(body.assignedToType),
      assignedToUserId: this.optionalInt(body.assignedToUserId),
      assignedToTempUserId: this.optionalInt(body.assignedToTempUserId),
      createdByUserId: userId,
      parentTaskId: this.optionalInt(body.parentTaskId),
      dueDate: this.optionalDate(body.dueDate),
      startDate: this.optionalDate(body.startDate),
      reminderAt: this.optionalTimestamp(body.reminderAt),
      linkedActivityId: this.optionalInt(body.linkedActivityId),
      linkedIssueId: this.optionalInt(body.linkedIssueId),
      epsNodeId: this.optionalInt(body.epsNodeId),
      linkedModule: body.linkedModule || null,
      linkedRecordId: this.optionalInt(body.linkedRecordId),
      recurrenceRule: body.recurrenceRule || null,
      progressPercent: this.percent(body.progressPercent),
      watcherUserIds: this.normalizeIntArray(body.watcherUserIds),
      watcherTempUserIds: this.normalizeIntArray(body.watcherTempUserIds),
      checklistItems: this.normalizeChecklistItems(body.checklistItems),
      tags: this.normalizeTextArray(body.tags),
      attachments: this.normalizeTextArray(body.attachments),
      lastActivityAt: new Date(),
    });
    const saved = await this.taskRepo.save(task);
    await this.notifyTaskAssignment(saved);
    return saved;
  }

  async updateTask(projectId: number, id: number, body: any) {
    const task = await this.getTask(projectId, id);
    const oldAssignee = task.assignedToUserId;
    Object.assign(task, {
      title:
        body.title !== undefined
          ? this.requiredText(body.title, 'Task title is required')
          : task.title,
      description: body.description !== undefined ? body.description || null : task.description,
      status: body.status !== undefined ? this.normalizeTaskStatus(body.status) : task.status,
      priority: body.priority !== undefined ? this.normalizePriority(body.priority) : task.priority,
      taskType:
        body.taskType !== undefined ? this.normalizeCode(body.taskType, 'GENERAL') : task.taskType,
      assignedToType:
        body.assignedToType !== undefined
          ? this.normalizeAssigneeType(body.assignedToType)
          : task.assignedToType,
      assignedToUserId:
        body.assignedToUserId !== undefined
          ? this.optionalInt(body.assignedToUserId)
          : task.assignedToUserId,
      assignedToTempUserId:
        body.assignedToTempUserId !== undefined
          ? this.optionalInt(body.assignedToTempUserId)
          : task.assignedToTempUserId,
      parentTaskId:
        body.parentTaskId !== undefined ? this.optionalInt(body.parentTaskId) : task.parentTaskId,
      dueDate: body.dueDate !== undefined ? this.optionalDate(body.dueDate) : task.dueDate,
      startDate: body.startDate !== undefined ? this.optionalDate(body.startDate) : task.startDate,
      reminderAt:
        body.reminderAt !== undefined
          ? this.optionalTimestamp(body.reminderAt)
          : task.reminderAt,
      linkedActivityId:
        body.linkedActivityId !== undefined
          ? this.optionalInt(body.linkedActivityId)
          : task.linkedActivityId,
      linkedIssueId:
        body.linkedIssueId !== undefined
          ? this.optionalInt(body.linkedIssueId)
          : task.linkedIssueId,
      epsNodeId: body.epsNodeId !== undefined ? this.optionalInt(body.epsNodeId) : task.epsNodeId,
      linkedModule:
        body.linkedModule !== undefined ? body.linkedModule || null : task.linkedModule,
      linkedRecordId:
        body.linkedRecordId !== undefined
          ? this.optionalInt(body.linkedRecordId)
          : task.linkedRecordId,
      recurrenceRule:
        body.recurrenceRule !== undefined ? body.recurrenceRule || null : task.recurrenceRule,
      progressPercent:
        body.progressPercent !== undefined ? this.percent(body.progressPercent) : task.progressPercent,
      watcherUserIds:
        body.watcherUserIds !== undefined
          ? this.normalizeIntArray(body.watcherUserIds)
          : task.watcherUserIds,
      watcherTempUserIds:
        body.watcherTempUserIds !== undefined
          ? this.normalizeIntArray(body.watcherTempUserIds)
          : task.watcherTempUserIds,
      checklistItems:
        body.checklistItems !== undefined
          ? this.normalizeChecklistItems(body.checklistItems)
          : task.checklistItems,
      tags: body.tags !== undefined ? this.normalizeTextArray(body.tags) : task.tags,
      attachments:
        body.attachments !== undefined
          ? this.normalizeTextArray(body.attachments)
          : task.attachments,
      lastActivityAt: new Date(),
    });
    task.completedAt = task.status === 'DONE' ? task.completedAt || new Date() : null;
    if (task.status !== 'DONE') task.completedByUserId = null;
    const saved = await this.taskRepo.save(task);
    if (saved.assignedToUserId && saved.assignedToUserId !== oldAssignee) {
      await this.notifyTaskAssignment(saved);
    }
    return saved;
  }

  async updateTaskStatus(projectId: number, id: number, status: string) {
    const task = await this.getTask(projectId, id);
    task.status = this.normalizeTaskStatus(status);
    task.completedAt = task.status === 'DONE' ? new Date() : null;
    if (task.status !== 'DONE') task.completedByUserId = null;
    task.progressPercent = task.status === 'DONE' ? 100 : Math.min(task.progressPercent || 0, 95);
    task.lastActivityAt = new Date();
    return this.taskRepo.save(task);
  }

  async completeTask(projectId: number, id: number, userId: number) {
    const task = await this.getTask(projectId, id);
    task.status = 'DONE';
    task.completedAt = new Date();
    task.completedByUserId = userId;
    task.progressPercent = 100;
    task.lastActivityAt = new Date();
    return this.taskRepo.save(task);
  }

  async reopenTask(projectId: number, id: number) {
    const task = await this.getTask(projectId, id);
    task.status = 'IN_PROGRESS';
    task.completedAt = null;
    task.completedByUserId = null;
    task.progressPercent = Math.min(task.progressPercent || 0, 95);
    task.lastActivityAt = new Date();
    return this.taskRepo.save(task);
  }

  async deleteTask(projectId: number, id: number) {
    const task = await this.getTask(projectId, id);
    await this.taskCommentRepo.delete({ taskId: id, projectId });
    await this.taskRepo.remove(task);
    return { deleted: true };
  }

  async listTaskComments(projectId: number, taskId: number) {
    await this.getTask(projectId, taskId);
    return this.taskCommentRepo.find({
      where: { taskId, projectId },
      order: { createdAt: 'ASC' },
    });
  }

  async addTaskComment(
    projectId: number,
    taskId: number,
    comment: string,
    userId: number,
  ) {
    await this.getTask(projectId, taskId);
    const saved = await this.taskCommentRepo.save(
      this.taskCommentRepo.create({
        projectId,
        taskId,
        authorUserId: userId,
        comment: this.requiredText(comment, 'Comment is required'),
      }),
    );
    await this.taskRepo.increment({ id: taskId, projectId }, 'commentsCount', 1);
    await this.taskRepo.update({ id: taskId, projectId }, { lastActivityAt: new Date() });
    return saved;
  }

  async listFollowups(projectId: number, query: any) {
    const where: any = { projectId };
    if (query.assignedToUserId) where.assignedToUserId = Number(query.assignedToUserId);
    if (query.status) where.status = String(query.status).toUpperCase();
    if (query.priority) where.priority = String(query.priority).toUpperCase();
    if (query.followupType) where.followupType = String(query.followupType).toUpperCase();
    if (query.dueDate) where.dueDate = this.toDate(query.dueDate);
    return this.followupRepo.find({
      where,
      order: { dueDate: 'ASC', id: 'DESC' },
      ...this.page(query),
    });
  }

  async myFollowups(projectId: number, userId: number, query: any = {}) {
    return this.followupRepo.find({
      where: { projectId, assignedToUserId: userId },
      order: { dueDate: 'ASC', id: 'DESC' },
      ...this.page(query),
    });
  }

  async overdueFollowups(projectId: number, query: any = {}) {
    return this.followupRepo.find({
      where: {
        projectId,
        dueDate: LessThan(this.today()),
        status: Not('CLOSED'),
      },
      order: { dueDate: 'ASC' },
      ...this.page(query),
    });
  }

  async dueTodayFollowups(projectId: number, query: any = {}) {
    return this.followupRepo.find({
      where: {
        projectId,
        dueDate: this.today(),
        status: Not('CLOSED'),
      },
      order: { priority: 'DESC', id: 'DESC' },
      ...this.page(query),
    });
  }

  async followupHistory(projectId: number, query: any = {}) {
    return this.followupRepo.find({
      where: { projectId },
      order: { updatedAt: 'DESC', id: 'DESC' },
      ...this.page(query),
    });
  }

  async getFollowup(projectId: number, id: number) {
    const item = await this.followupRepo.findOne({ where: { id, projectId } });
    if (!item) throw new NotFoundException('Follow-up action not found');
    return item;
  }

  async createFollowup(projectId: number, body: any, userId: number) {
    const followup = this.followupRepo.create({
      projectId,
      actionItem: this.requiredText(body.actionItem, 'Action item is required'),
      raisedByUserId: userId,
      assignedToUserId: this.requiredInt(body.assignedToUserId, 'Assignee is required'),
      assignedToType: this.normalizeAssigneeType(body.assignedToType),
      assignedToTempUserId: this.optionalInt(body.assignedToTempUserId),
      raisedDate: this.optionalDate(body.raisedDate) || this.today(),
      dueDate: this.optionalDate(body.dueDate) || this.today(),
      status: this.normalizeFollowupStatus(body.status),
      priority: this.normalizeFollowupPriority(body.priority),
      remarks: body.remarks || null,
      linkedIssueId: this.optionalInt(body.linkedIssueId),
      linkedTaskId: this.optionalInt(body.linkedTaskId),
      meetingReference: body.meetingReference || null,
      meetingDate: this.optionalDate(body.meetingDate),
      followupType: this.normalizeCode(body.followupType, 'GENERAL'),
      sourceModule: body.sourceModule || null,
      sourceRecordId: this.optionalInt(body.sourceRecordId),
      epsNodeId: this.optionalInt(body.epsNodeId),
      locationText: body.locationText || null,
      reminderAt: this.optionalTimestamp(body.reminderAt),
      nextReminderAt: this.optionalTimestamp(body.nextReminderAt || body.reminderAt),
      repeatRule: body.repeatRule || null,
      watcherUserIds: this.normalizeIntArray(body.watcherUserIds),
      watcherTempUserIds: this.normalizeIntArray(body.watcherTempUserIds),
      attachments: this.normalizeTextArray(body.attachments),
      lastActivityAt: new Date(),
    });
    const saved = await this.followupRepo.save(followup);
    await this.notifyFollowupAssignment(saved);
    return saved;
  }

  async updateFollowup(projectId: number, id: number, body: any) {
    const followup = await this.getFollowup(projectId, id);
    const oldAssignee = followup.assignedToUserId;
    Object.assign(followup, {
      actionItem:
        body.actionItem !== undefined
          ? this.requiredText(body.actionItem, 'Action item is required')
          : followup.actionItem,
      assignedToUserId:
        body.assignedToUserId !== undefined
          ? this.requiredInt(body.assignedToUserId, 'Assignee is required')
          : followup.assignedToUserId,
      assignedToType:
        body.assignedToType !== undefined
          ? this.normalizeAssigneeType(body.assignedToType)
          : followup.assignedToType,
      assignedToTempUserId:
        body.assignedToTempUserId !== undefined
          ? this.optionalInt(body.assignedToTempUserId)
          : followup.assignedToTempUserId,
      dueDate:
        body.dueDate !== undefined
          ? this.optionalDate(body.dueDate) || followup.dueDate
          : followup.dueDate,
      status: body.status !== undefined ? this.normalizeFollowupStatus(body.status) : followup.status,
      priority:
        body.priority !== undefined
          ? this.normalizeFollowupPriority(body.priority)
          : followup.priority,
      remarks: body.remarks !== undefined ? body.remarks || null : followup.remarks,
      linkedIssueId:
        body.linkedIssueId !== undefined
          ? this.optionalInt(body.linkedIssueId)
          : followup.linkedIssueId,
      linkedTaskId:
        body.linkedTaskId !== undefined ? this.optionalInt(body.linkedTaskId) : followup.linkedTaskId,
      meetingReference:
        body.meetingReference !== undefined
          ? body.meetingReference || null
          : followup.meetingReference,
      meetingDate:
        body.meetingDate !== undefined
          ? this.optionalDate(body.meetingDate)
          : followup.meetingDate,
      followupType:
        body.followupType !== undefined
          ? this.normalizeCode(body.followupType, 'GENERAL')
          : followup.followupType,
      sourceModule:
        body.sourceModule !== undefined ? body.sourceModule || null : followup.sourceModule,
      sourceRecordId:
        body.sourceRecordId !== undefined
          ? this.optionalInt(body.sourceRecordId)
          : followup.sourceRecordId,
      epsNodeId: body.epsNodeId !== undefined ? this.optionalInt(body.epsNodeId) : followup.epsNodeId,
      locationText:
        body.locationText !== undefined ? body.locationText || null : followup.locationText,
      reminderAt:
        body.reminderAt !== undefined
          ? this.optionalTimestamp(body.reminderAt)
          : followup.reminderAt,
      nextReminderAt:
        body.nextReminderAt !== undefined
          ? this.optionalTimestamp(body.nextReminderAt)
          : followup.nextReminderAt,
      repeatRule:
        body.repeatRule !== undefined ? body.repeatRule || null : followup.repeatRule,
      watcherUserIds:
        body.watcherUserIds !== undefined
          ? this.normalizeIntArray(body.watcherUserIds)
          : followup.watcherUserIds,
      watcherTempUserIds:
        body.watcherTempUserIds !== undefined
          ? this.normalizeIntArray(body.watcherTempUserIds)
          : followup.watcherTempUserIds,
      attachments:
        body.attachments !== undefined
          ? this.normalizeTextArray(body.attachments)
          : followup.attachments,
      lastActivityAt: new Date(),
    });
    const saved = await this.followupRepo.save(followup);
    if (saved.assignedToUserId !== oldAssignee) {
      await this.notifyFollowupAssignment(saved);
    }
    return saved;
  }

  async closeFollowup(projectId: number, id: number, remarks?: string, userId?: number) {
    const followup = await this.getFollowup(projectId, id);
    followup.status = 'CLOSED';
    followup.closedDate = this.today();
    followup.closedByUserId = userId || null;
    followup.closureRemarks = remarks || followup.closureRemarks;
    followup.remarks = remarks || followup.remarks;
    followup.lastActivityAt = new Date();
    return this.followupRepo.save(followup);
  }

  async reopenFollowup(projectId: number, id: number) {
    const followup = await this.getFollowup(projectId, id);
    followup.status = 'OPEN';
    followup.closedDate = null;
    followup.closedByUserId = null;
    followup.lastActivityAt = new Date();
    return this.followupRepo.save(followup);
  }

  async snoozeFollowup(projectId: number, id: number, reminderAt: any, dueDate?: any) {
    const followup = await this.getFollowup(projectId, id);
    followup.reminderAt = this.optionalTimestamp(reminderAt);
    followup.nextReminderAt = this.optionalTimestamp(reminderAt);
    if (dueDate !== undefined) followup.dueDate = this.optionalDate(dueDate) || followup.dueDate;
    followup.lastActivityAt = new Date();
    return this.followupRepo.save(followup);
  }

  async convertFollowupToTask(projectId: number, id: number, userId: number) {
    const followup = await this.getFollowup(projectId, id);
    if (followup.linkedTaskId) return this.getTask(projectId, followup.linkedTaskId);
    const task = await this.createTask(
      projectId,
      {
        title: followup.actionItem,
        description: followup.remarks,
        priority: followup.priority,
        assignedToType: followup.assignedToType,
        assignedToUserId: followup.assignedToUserId,
        assignedToTempUserId: followup.assignedToTempUserId,
        dueDate: followup.dueDate,
        linkedIssueId: followup.linkedIssueId,
        epsNodeId: followup.epsNodeId,
        linkedModule: 'FOLLOWUP',
        linkedRecordId: followup.id,
        tags: ['follow-up'],
      },
      userId,
    );
    followup.linkedTaskId = task.id;
    followup.lastActivityAt = new Date();
    await this.followupRepo.save(followup);
    return task;
  }

  async deleteFollowup(projectId: number, id: number) {
    const followup = await this.getFollowup(projectId, id);
    await this.followupRepo.remove(followup);
    return { deleted: true };
  }

  async listJournal(projectId: number, query: any) {
    const where: any = { projectId };
    if (query.authorUserId) where.authorUserId = Number(query.authorUserId);
    if (query.status) where.status = String(query.status).toUpperCase();
    if (query.dateFrom || query.dateTo) {
      where.date = Between(
        this.optionalDate(query.dateFrom) || '1900-01-01',
        this.optionalDate(query.dateTo) || '2999-12-31',
      );
    }
    return this.journalRepo.find({
      where,
      order: { date: 'DESC', id: 'DESC' },
      ...this.page(query),
    });
  }

  async journalCalendar(projectId: number, query: any) {
    const rows = await this.listJournal(projectId, query);
    return rows.map((entry) => ({
      id: entry.id,
      date: entry.date,
      status: entry.status,
      weather: entry.weather,
      summary: entry.summary,
      photoCount: (entry.photoUrls || []).length,
      tagCount: (entry.tags || []).length,
    }));
  }

  async searchJournal(projectId: number, query: any) {
    const text = String(query.q || '').toLowerCase().trim();
    const rows = await this.listJournal(projectId, query);
    if (!text) return rows;
    return rows.filter((entry) =>
      [
        entry.summary,
        entry.workDoneToday,
        entry.issuesRaised,
        entry.progressNotes,
        entry.tomorrowPlan,
        entry.locationText,
        ...(entry.tags || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(text),
    );
  }

  async todayJournal(projectId: number) {
    return this.journalRepo.findOne({ where: { projectId, date: this.today() } });
  }

  async getJournal(projectId: number, id: number) {
    const entry = await this.journalRepo.findOne({ where: { id, projectId } });
    if (!entry) throw new NotFoundException('Site journal entry not found');
    return entry;
  }

  async upsertJournal(projectId: number, body: any, userId: number) {
    const date = this.optionalDate(body.date) || this.today();
    const existing = await this.journalRepo.findOne({ where: { projectId, date } });
    const payload = {
      projectId,
      date,
      authorUserId: existing?.authorUserId || userId,
      weather: this.normalizeWeather(body.weather),
      status: existing?.status || 'DRAFT',
      journalType: this.normalizeCode(body.journalType, 'DAILY_PROGRESS'),
      summary: this.requiredText(body.summary, 'Daily summary is required'),
      workDoneToday: body.workDoneToday || null,
      issuesRaised: body.issuesRaised || null,
      safetyObservations: body.safetyObservations || null,
      qualityObservations: body.qualityObservations || null,
      progressNotes: body.progressNotes || null,
      decisionsTaken: body.decisionsTaken || null,
      instructionsGiven: body.instructionsGiven || null,
      materialReceived: body.materialReceived || null,
      delaysOrConstraints: body.delaysOrConstraints || null,
      tomorrowPlan: body.tomorrowPlan || null,
      laborCount: this.optionalInt(body.laborCount),
      equipmentOnSite: body.equipmentOnSite || null,
      visitorsOnSite: body.visitorsOnSite || null,
      epsNodeId: this.optionalInt(body.epsNodeId),
      locationText: body.locationText || null,
      linkedActivityIds: this.normalizeIntArray(body.linkedActivityIds),
      linkedTaskIds: this.normalizeIntArray(body.linkedTaskIds),
      linkedFollowupIds: this.normalizeIntArray(body.linkedFollowupIds),
      linkedRfiIds: this.normalizeIntArray(body.linkedRfiIds),
      photoUrls: this.normalizeTextArray(body.photoUrls || existing?.photoUrls),
      attachments: this.normalizeTextArray(body.attachments || existing?.attachments),
      tags: this.normalizeTextArray(body.tags || existing?.tags),
      checkpoints: this.normalizeJournalCheckpoints(body.checkpoints || existing?.checkpoints),
      remarks: body.remarks || null,
    };
    return this.journalRepo.save(
      existing ? { ...existing, ...payload } : this.journalRepo.create(payload),
    );
  }

  async updateJournal(projectId: number, id: number, body: any) {
    const entry = await this.getJournal(projectId, id);
    Object.assign(entry, {
      date: body.date !== undefined ? this.optionalDate(body.date) || entry.date : entry.date,
      weather: body.weather !== undefined ? this.normalizeWeather(body.weather) : entry.weather,
      journalType:
        body.journalType !== undefined
          ? this.normalizeCode(body.journalType, 'DAILY_PROGRESS')
          : entry.journalType,
      summary:
        body.summary !== undefined
          ? this.requiredText(body.summary, 'Daily summary is required')
          : entry.summary,
      workDoneToday: body.workDoneToday !== undefined ? body.workDoneToday || null : entry.workDoneToday,
      issuesRaised: body.issuesRaised !== undefined ? body.issuesRaised || null : entry.issuesRaised,
      safetyObservations:
        body.safetyObservations !== undefined
          ? body.safetyObservations || null
          : entry.safetyObservations,
      qualityObservations:
        body.qualityObservations !== undefined
          ? body.qualityObservations || null
          : entry.qualityObservations,
      progressNotes:
        body.progressNotes !== undefined ? body.progressNotes || null : entry.progressNotes,
      decisionsTaken:
        body.decisionsTaken !== undefined ? body.decisionsTaken || null : entry.decisionsTaken,
      instructionsGiven:
        body.instructionsGiven !== undefined
          ? body.instructionsGiven || null
          : entry.instructionsGiven,
      materialReceived:
        body.materialReceived !== undefined
          ? body.materialReceived || null
          : entry.materialReceived,
      delaysOrConstraints:
        body.delaysOrConstraints !== undefined
          ? body.delaysOrConstraints || null
          : entry.delaysOrConstraints,
      tomorrowPlan:
        body.tomorrowPlan !== undefined ? body.tomorrowPlan || null : entry.tomorrowPlan,
      laborCount:
        body.laborCount !== undefined ? this.optionalInt(body.laborCount) : entry.laborCount,
      equipmentOnSite:
        body.equipmentOnSite !== undefined
          ? body.equipmentOnSite || null
          : entry.equipmentOnSite,
      visitorsOnSite:
        body.visitorsOnSite !== undefined ? body.visitorsOnSite || null : entry.visitorsOnSite,
      epsNodeId: body.epsNodeId !== undefined ? this.optionalInt(body.epsNodeId) : entry.epsNodeId,
      locationText:
        body.locationText !== undefined ? body.locationText || null : entry.locationText,
      linkedActivityIds:
        body.linkedActivityIds !== undefined
          ? this.normalizeIntArray(body.linkedActivityIds)
          : entry.linkedActivityIds,
      linkedTaskIds:
        body.linkedTaskIds !== undefined
          ? this.normalizeIntArray(body.linkedTaskIds)
          : entry.linkedTaskIds,
      linkedFollowupIds:
        body.linkedFollowupIds !== undefined
          ? this.normalizeIntArray(body.linkedFollowupIds)
          : entry.linkedFollowupIds,
      linkedRfiIds:
        body.linkedRfiIds !== undefined ? this.normalizeIntArray(body.linkedRfiIds) : entry.linkedRfiIds,
      photoUrls:
        body.photoUrls !== undefined ? this.normalizeTextArray(body.photoUrls) : entry.photoUrls,
      attachments:
        body.attachments !== undefined ? this.normalizeTextArray(body.attachments) : entry.attachments,
      tags: body.tags !== undefined ? this.normalizeTextArray(body.tags) : entry.tags,
      checkpoints:
        body.checkpoints !== undefined
          ? this.normalizeJournalCheckpoints(body.checkpoints)
          : entry.checkpoints,
      remarks: body.remarks !== undefined ? body.remarks || null : entry.remarks,
    });
    return this.journalRepo.save(entry);
  }

  async submitJournal(projectId: number, id: number) {
    const entry = await this.getJournal(projectId, id);
    entry.status = 'SUBMITTED';
    entry.submittedAt = new Date();
    return this.journalRepo.save(entry);
  }

  async lockJournal(projectId: number, id: number) {
    const entry = await this.getJournal(projectId, id);
    entry.status = 'LOCKED';
    entry.lockedAt = new Date();
    if (!entry.submittedAt) entry.submittedAt = new Date();
    return this.journalRepo.save(entry);
  }

  async reopenJournal(projectId: number, id: number) {
    const entry = await this.getJournal(projectId, id);
    entry.status = 'DRAFT';
    entry.lockedAt = null;
    return this.journalRepo.save(entry);
  }

  async deleteJournal(projectId: number, id: number) {
    const entry = await this.getJournal(projectId, id);
    await this.journalRepo.remove(entry);
    return { deleted: true };
  }

  async addJournalPhotos(
    projectId: number,
    id: number,
    files: Express.Multer.File[] = [],
  ) {
    const entry = await this.getJournal(projectId, id);
    const urls = files.map((file) => this.persistJournalFile(projectId, id, file));
    entry.photoUrls = [...(entry.photoUrls || []), ...urls];
    return this.journalRepo.save(entry);
  }

  private persistJournalFile(
    projectId: number,
    entryId: number,
    file: Express.Multer.File,
  ) {
    const root = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    const folder = join(root, 'planning', 'journal', String(projectId), String(entryId));
    mkdirSync(folder, { recursive: true });
    const extension = extname(file.originalname || '') || '.jpg';
    const fileName = `${randomUUID()}${extension}`;
    writeFileSync(join(folder, fileName), file.buffer);
    return `/uploads/planning/journal/${projectId}/${entryId}/${fileName}`;
  }

  private async notifyTaskAssignment(task: ProjectTask) {
    if (!task.assignedToUserId) return;
    await this.pushService.sendToProjectUsers(
      task.projectId,
      [task.assignedToUserId],
      'Task assigned',
      task.title,
      {
        type: 'TASK_ASSIGNED',
        projectId: String(task.projectId),
        taskId: String(task.id),
      },
    );
  }

  private async notifyFollowupAssignment(followup: FollowUpAction) {
    await this.pushService.sendToProjectUsers(
      followup.projectId,
      [followup.assignedToUserId],
      'Follow-up assigned',
      followup.actionItem,
      {
        type: 'FOLLOWUP_ASSIGNED',
        projectId: String(followup.projectId),
        followupId: String(followup.id),
      },
    );
  }

  private requiredText(value: any, message: string) {
    const text = String(value || '').trim();
    if (!text) throw new BadRequestException(message);
    return text;
  }

  private requiredInt(value: any, message: string) {
    const number = this.optionalInt(value);
    if (!number) throw new BadRequestException(message);
    return number;
  }

  private optionalInt(value: any) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.trunc(number) : null;
  }

  private toDate(value: any) {
    const date = this.optionalDate(value);
    if (!date) throw new BadRequestException('Invalid date');
    return date;
  }

  private optionalDate(value: any) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  private optionalTimestamp(value: any) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private today() {
    return new Date().toISOString().slice(0, 10);
  }

  private normalizeTextArray(value: any) {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private normalizeIntArray(value: any) {
    if (!value) return [];
    const values = Array.isArray(value) ? value : String(value).split(',');
    return values
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0)
      .map((item) => Math.trunc(item));
  }

  private normalizeChecklistItems(value: any) {
    if (!value) return [];
    const values = Array.isArray(value) ? value : [];
    return values
      .map((item) => ({
        text: String(item?.text || item || '').trim(),
        done: Boolean(item?.done),
      }))
      .filter((item) => item.text);
  }

  private normalizeJournalCheckpoints(value: any) {
    if (!value) return [];
    const values = Array.isArray(value) ? value : [];
    return values
      .map((item) => ({
        text: String(item?.text || item || '').trim(),
        done: Boolean(item?.done),
        notes: item?.notes ? String(item.notes).trim() : null,
      }))
      .filter((item) => item.text);
  }

  private normalizePriority(value: any) {
    const priority = String(value || 'MEDIUM').toUpperCase();
    return ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority)
      ? (priority as any)
      : 'MEDIUM';
  }

  private normalizeFollowupPriority(value: any) {
    const priority = String(value || 'MEDIUM').toUpperCase();
    return ['LOW', 'MEDIUM', 'HIGH'].includes(priority)
      ? (priority as any)
      : 'MEDIUM';
  }

  private normalizeTaskStatus(value: any) {
    const status = String(value || 'TODO').toUpperCase();
    return ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'].includes(status)
      ? (status as any)
      : 'TODO';
  }

  private normalizeFollowupStatus(value: any) {
    const status = String(value || 'OPEN').toUpperCase();
    return ['OPEN', 'IN_PROGRESS', 'CLOSED', 'OVERDUE'].includes(status)
      ? (status as any)
      : 'OPEN';
  }

  private normalizeWeather(value: any) {
    if (!value) return null;
    const weather = String(value).toUpperCase();
    return ['SUNNY', 'CLOUDY', 'RAINY', 'FOGGY'].includes(weather)
      ? (weather as any)
      : null;
  }

  private normalizeCode(value: any, fallback: string) {
    const text = String(value || fallback)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_ -]/g, '');
    return text || fallback;
  }

  private normalizeAssigneeType(value: any): PlanningAssigneeType {
    return String(value || 'INTERNAL_USER').toUpperCase() === 'VENDOR_USER'
      ? 'VENDOR_USER'
      : 'INTERNAL_USER';
  }

  private percent(value: any) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(100, Math.trunc(number)));
  }

  private userLabel(user: any) {
    return user?.displayName || user?.username || `User #${user?.id || ''}`;
  }

  private page(query: any, defaultLimit = 200, maxLimit = 500) {
    const rawLimit = Number(query?.limit);
    const rawOffset = Number(query?.offset);
    const take = Math.min(
      maxLimit,
      Math.max(1, Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : defaultLimit),
    );
    const skip = Math.max(
      0,
      Number.isFinite(rawOffset) ? Math.trunc(rawOffset) : 0,
    );
    return { take, skip };
  }
}
