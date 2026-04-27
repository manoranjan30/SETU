import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { User } from '../users/user.entity';
import {
  UserProjectAssignment,
  AssignmentStatus,
} from '../projects/entities/user-project-assignment.entity';
import { NotificationLog } from './notification-log.entity';

@Injectable()
export class PushNotificationService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationService.name);

  private messagingInstance: any = null;
  private pushDisabledReason: string | null = null;

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(UserProjectAssignment)
    private readonly assignmentRepo: Repository<UserProjectAssignment>,
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
  ) {}

  async onModuleInit() {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!serviceAccountPath) {
      this.logger.debug(
        'FIREBASE_SERVICE_ACCOUNT_PATH not set — push notifications disabled.',
      );
      return;
    }

    const resolvedPath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.resolve(process.cwd(), serviceAccountPath);

    if (!fs.existsSync(resolvedPath)) {
      this.logger.error(
        `Firebase service account file NOT found at: ${resolvedPath}. Push notifications will be disabled.`,
      );
      return;
    }

    try {
      const admin = require('firebase-admin');
      if (!admin.apps.length) {
        const serviceAccount = require(resolvedPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }
      this.messagingInstance = admin.messaging();
      this.logger.log('Firebase Admin SDK initialized for push notifications.');
    } catch (err) {
      this.logger.error(
        'Failed to initialize Firebase Admin SDK. Make sure "firebase-admin" is installed.',
        err,
      );
    }
  }

  /**
   * Send a notification to specific user IDs.
   */
  async sendToUsers(
    userIds: number[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.isPushAvailable() || userIds.length === 0) return;

    try {
      const users = await this.usersRepo.findBy({ id: In(userIds) });
      const tokens = users
        .map((u) => u.fcmToken)
        .filter((t): t is string => !!t);
      if (tokens.length === 0) return;

      await this._sendWithLog(tokens, title, body, data, {
        type: data?.type ?? 'DIRECT',
        recipientCount: tokens.length,
      });
    } catch (err) {
      this.handleSendFailure(err, 'sendToUsers');
    }
  }

  /**
   * Send a notification to all active users who have a given permissionCode
   * via any of their roles.
   *
   * @deprecated This is a GLOBAL broadcast — it sends to ALL projects.
   * Use sendToProjectPermission() for project-scoped notifications.
   * Only call this for truly system-wide events (e.g. server maintenance alerts).
   */
  async sendToPermission(
    permissionCode: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.isPushAvailable()) return;

    this.logger.warn(
      `[sendToPermission] GLOBAL broadcast for permissionCode="${permissionCode}" — ` +
        `consider sendToProjectPermission() for project-scoped sends.`,
    );

    try {
      const users = await this.usersRepo
        .createQueryBuilder('user')
        .innerJoin('user.roles', 'role')
        .innerJoin('role.permissions', 'perm')
        .where('perm.permissionCode = :permissionCode', { permissionCode })
        .andWhere('user.isActive = true')
        .getMany();

      const tokens = users
        .map((u) => u.fcmToken)
        .filter((t): t is string => !!t);
      if (tokens.length === 0) return;

      await this._sendWithLog(tokens, title, body, data, {
        type: data?.type ?? 'GLOBAL_PERM',
        permissionCode,
        recipientCount: tokens.length,
      });
    } catch (err) {
      this.handleSendFailure(err, 'sendToPermission');
    }
  }

  /**
   * Project-Scoped: Send notification to all ACTIVE users assigned
   * to a specific project with a specific role.
   */
  async sendToProjectRole(
    projectId: number,
    roleId: number,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.isPushAvailable()) return;

    try {
      const assignments = await this.assignmentRepo.find({
        where: {
          project: { id: projectId },
          status: AssignmentStatus.ACTIVE,
        },
        relations: ['user', 'roles'],
      });

      const matchingUserIds = assignments
        .filter((a) => a.roles?.some((r) => r.id === roleId))
        .map((a) => a.user?.id)
        .filter((id): id is number => !!id);

      if (matchingUserIds.length === 0) {
        this.logger.debug(
          `[sendToProjectRole] No users found for project=${projectId}, role=${roleId}`,
        );
        return;
      }

      const users = await this.usersRepo.findBy({ id: In(matchingUserIds) });
      const tokens = users
        .map((u) => u.fcmToken)
        .filter((t): t is string => !!t);
      if (tokens.length === 0) return;

      this.logger.log(
        `[sendToProjectRole] Sending to ${tokens.length} token(s) for project=${projectId}, role=${roleId}`,
      );
      await this._sendWithLog(tokens, title, body, data, {
        type: data?.type ?? 'PROJECT_ROLE',
        projectId,
        roleId,
        recipientCount: tokens.length,
      });
    } catch (err) {
      this.handleSendFailure(err, 'sendToProjectRole');
    }
  }

  /**
   * Project-Scoped: Send notification to all ACTIVE users in a project
   * whose roles carry a specific permissionCode.
   */
  async sendToProjectPermission(
    projectId: number,
    permissionCode: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.isPushAvailable()) return;

    try {
      const assignments = await this.assignmentRepo.find({
        where: { project: { id: projectId }, status: AssignmentStatus.ACTIVE },
        relations: ['user', 'roles', 'roles.permissions'],
      });

      const userIds = assignments
        .filter((a) =>
          a.roles?.some((r) =>
            r.permissions?.some((p) => p.permissionCode === permissionCode),
          ),
        )
        .map((a) => a.user?.id)
        .filter((id): id is number => !!id);

      if (userIds.length === 0) {
        this.logger.debug(
          `[sendToProjectPermission] No users for project=${projectId}, perm=${permissionCode}`,
        );
        return;
      }

      const users = await this.usersRepo.findBy({ id: In(userIds) });
      const tokens = users
        .map((u) => u.fcmToken)
        .filter((t): t is string => !!t);
      if (tokens.length === 0) return;

      this.logger.log(
        `[sendToProjectPermission] Sending to ${tokens.length} token(s) for project=${projectId}, perm=${permissionCode}`,
      );
      await this._sendWithLog(tokens, title, body, data, {
        type: data?.type ?? 'PROJECT_PERM',
        projectId,
        permissionCode,
        recipientCount: tokens.length,
      });
    } catch (err) {
      this.handleSendFailure(err, 'sendToProjectPermission');
    }
  }

  /**
   * Project-Scoped: Resolve ALL users matching a workflow node's
   * assigned role within that project and return their user IDs.
   */
  async resolveProjectRoleUsers(
    projectId: number,
    roleId: number,
  ): Promise<number[]> {
    const assignments = await this.assignmentRepo.find({
      where: {
        project: { id: projectId },
        status: AssignmentStatus.ACTIVE,
      },
      relations: ['user', 'roles'],
    });

    return assignments
      .filter((a) => a.roles?.some((r) => r.id === roleId))
      .map((a) => a.user?.id)
      .filter((id): id is number => !!id);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Send to tokens and write an audit log row.
   * Retries once on transient failure before giving up.
   */
  private async _sendWithLog(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, string> | undefined,
    logMeta: {
      type: string;
      projectId?: number;
      permissionCode?: string;
      roleId?: number;
      recipientCount: number;
    },
  ): Promise<void> {
    if (!this.isPushAvailable()) return;

    const message = {
      tokens,
      notification: { title, body },
      ...(data ? { data } : {}),
      android: {
        notification: { channelId: 'setu_quality', priority: 'high' as const },
      },
      apns: { payload: { aps: { sound: 'default' } } },
    };

    let successCount = 0;
    let failureCount = 0;
    const failedTokens: string[] = [];

    // One retry for transient Firebase failures
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        const response =
          await this.messagingInstance.sendEachForMulticast(message);

        successCount = response.successCount;
        failureCount = response.failureCount;

        // Collect tokens that failed so we can log them
        response.responses?.forEach((r: any, i: number) => {
          if (!r.success) failedTokens.push(tokens[i]);
        });

        this.logger.log(
          `FCM: ${successCount} sent, ${failureCount} failed (${tokens.length} tokens)`,
        );
        break;
      } catch (err) {
        if (attempt === 0 && this.isTransientFirebaseNetworkError(err)) {
          this.logger.warn(`[_sendWithLog] Transient error, retrying once…`);
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        failureCount = tokens.length;
        this.handleSendFailure(err, '_sendWithLog');
        break;
      }
    }

    // Persist audit log (non-blocking)
    this.logRepo
      .save(
        this.logRepo.create({
          type: logMeta.type,
          projectId: logMeta.projectId ?? null,
          permissionCode: logMeta.permissionCode ?? null,
          roleId: logMeta.roleId ?? null,
          recipientCount: logMeta.recipientCount,
          successCount,
          failureCount,
          failedTokens: failedTokens.length > 0 ? failedTokens : null,
        }),
      )
      .catch((e) =>
        this.logger.warn('[_sendWithLog] Failed to save notification log', e),
      );
  }

  private isPushAvailable(): boolean {
    return !!this.messagingInstance && !this.pushDisabledReason;
  }

  private handleSendFailure(err: unknown, source: string): void {
    if (this.isTransientFirebaseNetworkError(err)) {
      const message =
        err instanceof Error ? err.message : 'Unknown Firebase network error';
      this.pushDisabledReason = `${source}: ${message}`;
      this.messagingInstance = null;
      this.logger.warn(
        `Disabling push notifications after transient Firebase network failure in ${source}: ${message}`,
      );
      return;
    }

    this.logger.error(`Push notification send error in ${source}`, err as any);
  }

  private isTransientFirebaseNetworkError(err: unknown): boolean {
    const error = err as any;
    const message = String(
      error?.message || error?.errorInfo?.message || '',
    ).toLowerCase();
    const code = String(
      error?.code || error?.errorInfo?.code || '',
    ).toLowerCase();

    return (
      code.includes('network-error') ||
      message.includes('eai_again') ||
      message.includes('getaddrinfo') ||
      message.includes('fcm.googleapis.com') ||
      message.includes('network error')
    );
  }
}
