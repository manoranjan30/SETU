import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { Activity } from '../wbs/entities/activity.entity';

export type NotificationScopeInput = {
  projectId?: number | null;
  epsNodeId?: number | null;
  activityId?: number | null;
  activityLabel?: string | null;
  subjectLabel?: string | null;
};

export type ResolvedNotificationScope = {
  projectId: number | null;
  projectName: string | null;
  locationPath: string | null;
  floorName: string | null;
  activityLabel: string | null;
  subjectLabel: string | null;
};

@Injectable()
export class NotificationContextService {
  constructor(
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
  ) {}

  async resolve(
    input: NotificationScopeInput,
  ): Promise<ResolvedNotificationScope> {
    const resolvedProjectId = this.normalizeNumber(input.projectId);
    const resolvedEpsNodeId = this.normalizeNumber(input.epsNodeId);
    const resolvedActivityId = this.normalizeNumber(input.activityId);

    const chain = resolvedEpsNodeId
      ? await this.loadEpsChain(resolvedEpsNodeId)
      : [];

    const projectNodeFromChain =
      chain.find((node) => node.type === EpsNodeType.PROJECT) || null;
    const projectNode =
      projectNodeFromChain ||
      (resolvedProjectId
        ? await this.epsRepo.findOne({
            where: { id: resolvedProjectId },
            select: ['id', 'name', 'type', 'parentId'],
          })
        : null);

    const activityLabel =
      this.normalizeText(input.activityLabel) ||
      (resolvedActivityId
        ? await this.loadActivityLabel(resolvedActivityId)
        : null);

    const subjectLabel = this.normalizeText(input.subjectLabel);
    const locationNodes = chain.filter(
      (node) =>
        node.type !== EpsNodeType.COMPANY && node.type !== EpsNodeType.PROJECT,
    );
    const floorName =
      chain.find((node) => node.type === EpsNodeType.FLOOR)?.name || null;

    return {
      projectId: projectNode?.id ?? resolvedProjectId,
      projectName: projectNode?.name ?? null,
      locationPath:
        locationNodes.length > 0
          ? locationNodes.map((node) => node.name).join(' > ')
          : null,
      floorName,
      activityLabel,
      subjectLabel,
    };
  }

  formatInline(scope: ResolvedNotificationScope): string {
    const parts = [
      scope.projectName ? `Project: ${scope.projectName}` : null,
      scope.locationPath ? `Location: ${scope.locationPath}` : null,
      scope.activityLabel ? `Activity: ${scope.activityLabel}` : null,
      scope.subjectLabel ? `Item: ${scope.subjectLabel}` : null,
    ].filter((part): part is string => Boolean(part));

    return parts.join(' | ');
  }

  toData(scope: ResolvedNotificationScope): Record<string, string> {
    const data: Record<string, string> = {};

    if (scope.projectId != null) {
      data.projectId = String(scope.projectId);
    }
    if (scope.projectName) {
      data.projectName = scope.projectName;
    }
    if (scope.locationPath) {
      data.locationPath = scope.locationPath;
    }
    if (scope.floorName) {
      data.floorName = scope.floorName;
    }
    if (scope.activityLabel) {
      data.activityLabel = scope.activityLabel;
    }
    if (scope.subjectLabel) {
      data.subjectLabel = scope.subjectLabel;
    }

    return data;
  }

  private async loadActivityLabel(activityId: number): Promise<string | null> {
    const activity = await this.activityRepo.findOne({
      where: { id: activityId },
      select: ['id', 'activityCode', 'activityName'],
    });
    if (!activity) {
      return null;
    }

    const code = this.normalizeText(activity.activityCode);
    const name = this.normalizeText(activity.activityName);
    if (code && name) {
      return `${code} ${name}`;
    }
    return code || name || null;
  }

  private async loadEpsChain(nodeId: number): Promise<EpsNode[]> {
    const chain: EpsNode[] = [];
    let currentId: number | null = nodeId;

    while (currentId != null) {
      const node = await this.epsRepo.findOne({
        where: { id: currentId },
        select: ['id', 'name', 'type', 'parentId'],
      });
      if (!node) {
        break;
      }
      chain.unshift(node);
      currentId = this.normalizeNumber(node.parentId);
    }

    return chain;
  }

  private normalizeNumber(value: unknown): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  private normalizeText(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : null;
  }
}
