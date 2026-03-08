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

@Injectable()
export class PushNotificationService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationService.name);

  private messagingInstance: any = null;

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(UserProjectAssignment)
    private readonly assignmentRepo: Repository<UserProjectAssignment>,
  ) {}

  async onModuleInit() {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!serviceAccountPath) {
      this.logger.debug(
        'FIREBASE_SERVICE_ACCOUNT_PATH not set — push notifications disabled.',
      );
      return;
    }

    // Resolve the path relative to the current working directory if it's relative
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
    if (!this.messagingInstance || userIds.length === 0) return;

    const users = await this.usersRepo.findBy({ id: In(userIds) });
    const tokens = users.map((u) => u.fcmToken).filter((t): t is string => !!t);
    if (tokens.length === 0) return;

    await this._send(tokens, title, body, data);
  }

  /**
   * Send a notification to all active users who have a given permissionCode
   * via any of their roles. WARNING: This is GLOBAL (not project-scoped).
   * Prefer sendToProjectRole() for project-specific notifications.
   */
  async sendToPermission(
    permissionCode: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.messagingInstance) return;

    const users = await this.usersRepo
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role')
      .innerJoin('role.permissions', 'perm')
      .where('perm.permissionCode = :permissionCode', { permissionCode })
      .andWhere('user.isActive = true')
      .getMany();

    const tokens = users.map((u) => u.fcmToken).filter((t): t is string => !!t);
    if (tokens.length === 0) return;

    await this._send(tokens, title, body, data);
  }

  /**
   * Project-Scoped: Send notification to all ACTIVE users assigned
   * to a specific project with a specific role.
   * This ensures notifications never leak across projects.
   */
  async sendToProjectRole(
    projectId: number,
    roleId: number,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.messagingInstance) return;

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
    const tokens = users.map((u) => u.fcmToken).filter((t): t is string => !!t);
    if (tokens.length === 0) return;

    this.logger.log(
      `[sendToProjectRole] Sending to ${tokens.length} token(s) for project=${projectId}, role=${roleId}`,
    );
    await this._send(tokens, title, body, data);
  }

  /**
   * Project-Scoped: Resolve ALL users matching a workflow node's
   * assigned role within that project and return their user IDs.
   * Used by InspectionWorkflowService for multi-user approval resolution.
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

  private async _send(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    try {
      const message = {
        tokens,
        notification: { title, body },
        ...(data ? { data } : {}),
        android: {
          notification: {
            channelId: 'setu_quality',
            priority: 'high' as const,
          },
        },
        apns: {
          payload: { aps: { sound: 'default' } },
        },
      };

      const response =
        await this.messagingInstance.sendEachForMulticast(message);
      this.logger.log(
        `FCM: ${response.successCount} sent, ${response.failureCount} failed (${tokens.length} tokens)`,
      );
    } catch (err) {
      this.logger.error('Push notification send error', err);
    }
  }
}

