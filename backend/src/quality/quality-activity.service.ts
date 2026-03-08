import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Not } from 'typeorm';
import { QualityActivityList } from './entities/quality-activity-list.entity';
import {
  QualityActivity,
  QualityActivityStatus,
} from './entities/quality-activity.entity';
import { QualitySequenceEdge } from './entities/quality-sequence-edge.entity';
import {
  ActivityObservation,
  ActivityObservationStatus,
} from './entities/activity-observation.entity';
import { InspectionApproval } from './entities/inspection-approval.entity';
import { QualityInspection } from './entities/quality-inspection.entity';
import { PushNotificationService } from '../notifications/push-notification.service';
import * as crypto from 'crypto';

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface CreateListDto {
  name: string;
  description?: string;
  projectId: number;
  epsNodeId?: number;
  createdBy?: number;
}

export interface UpdateListDto {
  name?: string;
  description?: string;
  epsNodeId?: number;
}

export interface CreateActivityDto {
  activityName: string;
  description?: string;
  previousActivityId?: number; // Legacy single predecessor
  predecessorIds?: number[]; // Multi-predecessor support
  holdPoint?: boolean;
  witnessPoint?: boolean;
  responsibleParty?: string;
  allowBreak?: boolean;
}

export interface UpdateActivityDto extends Partial<CreateActivityDto> {
  sequence?: number;
}

export interface ReorderDto {
  orderedIds: number[]; // activity IDs in new order
}

export interface CsvActivityRow {
  sequence: number;
  activityName: string;
  description?: string;
  previousActivityCode?: string;
  holdPoint?: boolean;
  witnessPoint?: boolean;
  responsibleParty?: string;
  allowBreak?: boolean;
}

export interface CreateObservationDto {
  observationText: string;
  type?: string;
  remarks?: string;
  photos?: string[];
  checklistId?: number;
}

export interface ResolveObservationDto {
  closureText: string;
  closureEvidence?: string[];
}

export interface ApproveActivityDto {
  inspectorName: string;
  epsNodeId?: number;
  projectId?: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class QualityActivityService {
  constructor(
    @InjectRepository(QualityActivityList)
    private readonly listRepo: Repository<QualityActivityList>,
    @InjectRepository(QualityActivity)
    private readonly activityRepo: Repository<QualityActivity>,
    @InjectRepository(QualitySequenceEdge)
    private readonly edgeRepo: Repository<QualitySequenceEdge>,
    @InjectRepository(ActivityObservation)
    private readonly obsRepo: Repository<ActivityObservation>,
    @InjectRepository(InspectionApproval)
    private readonly approvalRepo: Repository<InspectionApproval>,
    @InjectRepository(QualityInspection)
    private readonly inspectionRepo: Repository<QualityInspection>,
    private readonly pushService: PushNotificationService,
    private readonly dataSource: DataSource,
  ) {}

  // ── Lists ──────────────────────────────────────────────────────────────

  async getLists(
    projectId: number,
    epsNodeId?: number,
  ): Promise<QualityActivityList[]> {
    const qb = this.listRepo
      .createQueryBuilder('list')
      .leftJoinAndSelect('list.epsNode', 'eps')
      .loadRelationCountAndMap('list.activityCount', 'list.activities')
      .where('list.projectId = :projectId', { projectId });

    if (epsNodeId) {
      // Show lists linked to this EXACT node OR global lists (epsNodeId is null)
      qb.andWhere('(list.epsNodeId = :epsNodeId OR list.epsNodeId IS NULL)', {
        epsNodeId,
      });
    }

    return qb.orderBy('list.createdAt', 'DESC').getMany();
  }

  async getListById(id: number): Promise<QualityActivityList> {
    const list = await this.listRepo.findOne({
      where: { id },
      relations: ['epsNode', 'activities'],
    });
    if (!list) throw new NotFoundException(`Activity list #${id} not found`);
    return list;
  }

  async createList(dto: CreateListDto): Promise<QualityActivityList> {
    const list = this.listRepo.create(dto);
    return this.listRepo.save(list);
  }

  async updateList(
    id: number,
    dto: UpdateListDto,
  ): Promise<QualityActivityList> {
    const list = await this.getListById(id);
    Object.assign(list, dto);
    return this.listRepo.save(list);
  }

  async deleteList(id: number): Promise<void> {
    const list = await this.getListById(id);
    await this.listRepo.remove(list);
  }

  // ── Activities ─────────────────────────────────────────────────────────

  async getActivities(listId: number): Promise<QualityActivity[]> {
    return this.activityRepo.find({
      where: { listId },
      relations: ['incomingEdges', 'incomingEdges.source'],
      order: { sequence: 'ASC' },
    });
  }

  async createActivity(
    listId: number,
    dto: CreateActivityDto,
  ): Promise<QualityActivity> {
    // Ensure list exists
    await this.getListById(listId);

    // Assign next sequence number
    const maxSeq = await this.activityRepo
      .createQueryBuilder('a')
      .select('MAX(a.sequence)', 'max')
      .where('a.listId = :listId', { listId })
      .getRawOne<{ max: number | string | null }>();

    const nextSeq = (Number(maxSeq?.max) || 0) + 1;

    const activity = this.activityRepo.create({
      ...dto,
      listId,
      sequence: nextSeq,
    });
    const saved = await this.activityRepo.save(activity);

    if (dto.predecessorIds) {
      await this.syncEdges(saved.id, dto.predecessorIds);
    }

    return saved;
  }

  async updateActivity(
    id: number,
    dto: UpdateActivityDto,
  ): Promise<QualityActivity> {
    const activity = await this.activityRepo.findOne({ where: { id } });
    if (!activity) throw new NotFoundException(`Activity #${id} not found`);

    Object.assign(activity, dto);
    const saved = await this.activityRepo.save(activity);

    if (dto.predecessorIds) {
      await this.syncEdges(id, dto.predecessorIds);
    }

    return saved;
  }

  async assignChecklists(
    id: number,
    checklistIds: number[],
  ): Promise<QualityActivity> {
    const activity = await this.activityRepo.findOne({ where: { id } });
    if (!activity) throw new NotFoundException(`Activity #${id} not found`);

    activity.assignedChecklistIds = checklistIds;
    return this.activityRepo.save(activity);
  }

  // ── Observations ───────────────────────────────────────────────────────

  async getObservations(id: number): Promise<ActivityObservation[]> {
    return this.obsRepo.find({
      where: { activityId: id },
      order: { createdAt: 'DESC' },
    });
  }

  async createObservation(
    id: number,
    userId: string,
    dto: CreateObservationDto,
  ): Promise<ActivityObservation> {
    const activity = await this.activityRepo.findOne({ where: { id } });
    if (!activity) throw new NotFoundException(`Activity #${id} not found`);

    if (activity.status === QualityActivityStatus.APPROVED) {
      throw new BadRequestException(
        'Cannot add observation to an already approved activity.',
      );
    }

    const obs = this.obsRepo.create({
      activityId: id,
      inspectorId: userId,
      checklistId: dto.checklistId,
      type: dto.type,
      observationText: dto.observationText,
      remarks: dto.remarks,
      photos: dto.photos || [],
      status: ActivityObservationStatus.PENDING,
    });

    const saved = await this.obsRepo.save(obs);

    activity.status = QualityActivityStatus.PENDING_OBSERVATION;
    await this.activityRepo.save(activity);

    // Notify the RFI raiser(s) associated with this activity
    this.notifyRfiRaisersOfObservation(id, saved.id).catch(() => {
      // Fire-and-forget; do not fail the request if notification errors
    });

    return saved;
  }

  private async notifyRfiRaisersOfObservation(
    activityId: number,
    observationId: string,
  ): Promise<void> {
    // Find all active inspections linked to this activity
    const inspections = await this.inspectionRepo.find({
      where: { activityId },
      select: ['id', 'requestedById'],
    });

    const raisers = [
      ...new Set(
        inspections
          .map((i) => i.requestedById)
          .filter((id): id is number => !!id),
      ),
    ];

    if (raisers.length === 0) return;

    await this.pushService.sendToUsers(
      raisers,
      'New Observation Raised 📝',
      `A QC observation has been raised against your RFI. Please review and rectify.`,
      { type: 'quality_observation', observationId },
    );
  }

  async resolveObservation(
    id: number,
    obsId: string,
    userId: string,
    dto: ResolveObservationDto,
  ): Promise<ActivityObservation> {
    const obs = await this.obsRepo.findOne({
      where: { id: obsId, activityId: id },
    });
    if (!obs) throw new NotFoundException(`Observation #${obsId} not found`);

    if (
      obs.status === ActivityObservationStatus.RECTIFIED ||
      obs.status === ActivityObservationStatus.CLOSED ||
      obs.status === ActivityObservationStatus.RESOLVED
    ) {
      throw new BadRequestException(
        'This observation is already rectified or closed.',
      );
    }

    obs.status = ActivityObservationStatus.RECTIFIED;
    obs.closureText = dto.closureText;
    obs.closureEvidence = dto.closureEvidence || [];
    obs.resolvedBy = userId;
    obs.resolvedAt = new Date();
    const saved = await this.obsRepo.save(obs);

    // Activity remains in PENDING_OBSERVATION because QC needs to close it
    // Or we could transition it back to UNDER_INSPECTION if ALL pending obs are at least RECTIFIED.
    // For now, let's transition it back if no more purely PENDING obs exist.
    const pendingCount = await this.obsRepo.count({
      where: { activityId: id, status: ActivityObservationStatus.PENDING },
    });

    if (pendingCount === 0) {
      // All observations are at least RECTIFIED, push back to QC
      await this.activityRepo.update(id, {
        status: QualityActivityStatus.UNDER_INSPECTION,
      });
    }

    return saved;
  }

  async closeObservation(
    id: number,
    obsId: string,
    userId: string,
  ): Promise<ActivityObservation> {
    const obs = await this.obsRepo.findOne({
      where: { id: obsId, activityId: id },
    });
    if (!obs) throw new NotFoundException(`Observation #${obsId} not found`);

    if (
      obs.status !== ActivityObservationStatus.RECTIFIED &&
      obs.status !== ActivityObservationStatus.RESOLVED
    ) {
      throw new BadRequestException(
        'Only rectified observations can be closed by QC.',
      );
    }

    obs.status = ActivityObservationStatus.CLOSED;
    const saved = await this.obsRepo.save(obs);

    // Check if any more non-closed observations exist for this activity
    const remainingCount = await this.obsRepo.count({
      where: {
        activityId: id,
        status: Not(ActivityObservationStatus.CLOSED),
      } as any,
    });

    if (remainingCount === 0) {
      await this.activityRepo.update(id, {
        status: QualityActivityStatus.UNDER_INSPECTION,
      });
    }

    return saved;
  }

  async deleteObservation(activityId: number, obsId: string): Promise<void> {
    const obs = await this.obsRepo.findOne({
      where: { id: obsId, activityId },
    });
    if (!obs) throw new NotFoundException(`Observation #${obsId} not found`);

    await this.obsRepo.remove(obs);

    // Re-check status: if no more pending obs, move back to UNDER_INSPECTION
    const pendingCount = await this.obsRepo.count({
      where: { activityId, status: ActivityObservationStatus.PENDING },
    });

    if (pendingCount === 0) {
      const activity = await this.activityRepo.findOne({
        where: { id: activityId },
      });
      if (
        activity &&
        activity.status === QualityActivityStatus.PENDING_OBSERVATION
      ) {
        await this.activityRepo.update(activityId, {
          status: QualityActivityStatus.UNDER_INSPECTION,
        });
      }
    }
  }

  // ── Approval ───────────────────────────────────────────────────────────

  async approveActivity(
    id: number,
    dto: ApproveActivityDto,
  ): Promise<InspectionApproval> {
    const activity = await this.activityRepo.findOne({ where: { id } });
    if (!activity) throw new NotFoundException(`Activity #${id} not found`);

    // Guard: prevent double-approval
    if (activity.status === QualityActivityStatus.APPROVED) {
      throw new BadRequestException(
        'Activity is already approved and digitally locked.',
      );
    }

    // Validation: Check pending observations
    const pendingCount = await this.obsRepo.count({
      where: { activityId: id, status: ActivityObservationStatus.PENDING },
    });

    if (pendingCount > 0) {
      throw new BadRequestException(
        'Cannot approve activity. There are unresolved observations.',
      );
    }

    const hash = crypto
      .createHash('sha256')
      .update(`${id}-${new Date().toISOString()}-${dto.inspectorName}`)
      .digest('hex');

    const approval = this.approvalRepo.create({
      activityId: id,
      inspectorName: dto.inspectorName,
      epsNodeId: dto.epsNodeId,
      projectId: dto.projectId,
      digitalSignatureHash: hash,
    });
    const savedApproval = await this.approvalRepo.save(approval);

    activity.status = QualityActivityStatus.APPROVED;
    await this.activityRepo.save(activity);

    return savedApproval;
  }

  private async syncEdges(targetId: number, predecessorIds: number[]) {
    // Delete existing edges for this target
    await this.edgeRepo.delete({ targetId });

    // Create new edges
    if (predecessorIds.length > 0) {
      const edges = predecessorIds.map((sourceId) =>
        this.edgeRepo.create({
          sourceId: Number(sourceId),
          targetId,
          constraintType: 'HARD',
        }),
      );
      await this.edgeRepo.save(edges);

      // Legacy sync: set previousActivityId to the first predecessor
      await this.activityRepo.update(targetId, {
        previousActivityId: Number(predecessorIds[0]),
      });
    } else {
      await this.activityRepo.update(targetId, {
        previousActivityId: null as any,
      });
    }
  }

  async deleteActivity(id: number): Promise<void> {
    const activity = await this.activityRepo.findOne({ where: { id } });
    if (!activity) throw new NotFoundException(`Activity #${id} not found`);

    const { listId, previousActivityId } = activity;

    await this.dataSource.transaction(async (manager) => {
      // Re-link any activities that pointed to this one → point to its predecessor
      await manager
        .createQueryBuilder()
        .update(QualityActivity)
        .set({ previousActivityId: previousActivityId ?? null })
        .where('previousActivityId = :id', { id })
        .execute();

      // Remove the activity
      await manager.remove(QualityActivity, activity);

      // Compact sequence numbers
      await this.compactSequence(listId, manager);
    });
  }

  /** Reorder activities by providing an ordered array of IDs */
  async reorderActivities(
    listId: number,
    dto: ReorderDto,
  ): Promise<QualityActivity[]> {
    const { orderedIds } = dto;

    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await manager.update(QualityActivity, orderedIds[i], {
          sequence: i + 1,
        });
      }
    });

    return this.getActivities(listId);
  }

  /** Import activities from parsed CSV rows */
  async importFromCsv(
    listId: number,
    rows: CsvActivityRow[],
  ): Promise<QualityActivity[]> {
    await this.getListById(listId); // validate list exists

    // Clear existing activities in this list before import
    await this.activityRepo.delete({ listId });

    const activities: Partial<QualityActivity>[] = rows.map((row, idx) => ({
      listId,
      sequence: row.sequence || idx + 1,
      activityName: row.activityName,
      description: row.description || undefined,
      holdPoint: row.holdPoint ?? false,
      witnessPoint: row.witnessPoint ?? false,
      responsibleParty: row.responsibleParty || 'Contractor',
      allowBreak: row.allowBreak ?? false,
      // previousActivityId resolved in a second pass after insert
    }));

    const saved = await this.activityRepo.save(activities as QualityActivity[]);

    // Second pass: resolve previousActivityCode → previousActivityId
    // We use sequence number as the reference (previousActivityCode = sequence number of predecessor)
    for (const row of rows) {
      if (row.previousActivityCode) {
        const prevSeq = Number(row.previousActivityCode);
        const prevActivity = saved.find((a) => a.sequence === prevSeq);
        const thisActivity = saved.find(
          (a) => a.sequence === (row.sequence || 0),
        );
        if (prevActivity && thisActivity) {
          await this.activityRepo.update(thisActivity.id, {
            previousActivityId: prevActivity.id,
          });
        }
      }
    }

    return this.getActivities(listId);
  }

  /** Clone an existing list to a target project */
  async cloneList(
    sourceListId: number,
    targetProjectId: number,
  ): Promise<QualityActivityList> {
    const sourceList = await this.listRepo.findOne({
      where: { id: sourceListId },
      relations: ['activities'],
    });
    if (!sourceList)
      throw new NotFoundException(`Source list #${sourceListId} not found`);

    // 1. Create newList object
    const newList = this.listRepo.create({
      name: `${sourceList.name} (Copy)`,
      description: sourceList.description,
      projectId: targetProjectId,
    });
    const savedList = await this.listRepo.save(newList);

    // 2. Clone Activities
    const oldToNewMap = new Map<number, number>();
    for (const act of sourceList.activities) {
      const newAct = this.activityRepo.create({
        listId: savedList.id,
        sequence: act.sequence,
        activityName: act.activityName,
        description: act.description,
        holdPoint: act.holdPoint,
        witnessPoint: act.witnessPoint,
        responsibleParty: act.responsibleParty,
        allowBreak: act.allowBreak,
        position: act.position,
        status: QualityActivityStatus.NOT_STARTED,
        assignedChecklistIds: act.assignedChecklistIds,
      });
      const savedAct = await this.activityRepo.save(newAct);
      oldToNewMap.set(act.id, savedAct.id);
    }

    // 3. Clone Sequence Edges
    const oldIds = Array.from(oldToNewMap.keys());
    if (oldIds.length > 0) {
      const sourceEdges = await this.edgeRepo.find({
        where: { sourceId: In(oldIds) },
      });

      const newEdges = sourceEdges
        .map((edge) => {
          const newSourceId = oldToNewMap.get(edge.sourceId);
          const newTargetId = oldToNewMap.get(edge.targetId);
          if (newSourceId && newTargetId) {
            return this.edgeRepo.create({
              sourceId: newSourceId,
              targetId: newTargetId,
              constraintType: edge.constraintType,
              lagMinutes: edge.lagMinutes,
            });
          }
          return null;
        })
        .filter(Boolean);

      if (newEdges.length > 0) {
        await this.edgeRepo.save(newEdges as QualitySequenceEdge[]);
      }
    }

    // 4. Update legacy previousActivityId
    for (const act of sourceList.activities) {
      if (act.previousActivityId) {
        const newId = oldToNewMap.get(act.id);
        const newPrevId = oldToNewMap.get(act.previousActivityId);
        if (newId && newPrevId) {
          await this.activityRepo.update(newId, {
            previousActivityId: newPrevId,
          });
        }
      }
    }

    return savedList;
  }

  // ── Private Helpers ────────────────────────────────────────────────────

  private async compactSequence(
    listId: number,
    manager: import('typeorm').EntityManager,
  ): Promise<void> {
    const activities = await manager.find(QualityActivity, {
      where: { listId },
      order: { sequence: 'ASC' },
    });
    for (let i = 0; i < activities.length; i++) {
      if (activities[i].sequence !== i + 1) {
        await manager.update(QualityActivity, activities[i].id, {
          sequence: i + 1,
        });
      }
    }
  }
}
