import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { QualityActivityList } from './entities/quality-activity-list.entity';
import { QualityActivity } from './entities/quality-activity.entity';

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
  previousActivityId?: number;
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

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class QualityActivityService {
  constructor(
    @InjectRepository(QualityActivityList)
    private readonly listRepo: Repository<QualityActivityList>,
    @InjectRepository(QualityActivity)
    private readonly activityRepo: Repository<QualityActivity>,
    private readonly dataSource: DataSource,
  ) { }

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
      qb.andWhere('list.epsNodeId = :epsNodeId', { epsNodeId });
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
      .getRawOne<{ max: number | null }>();

    const nextSeq = (maxSeq?.max ?? 0) + 1;

    const activity = this.activityRepo.create({
      ...dto,
      listId,
      sequence: nextSeq,
    });
    return this.activityRepo.save(activity);
  }

  async updateActivity(
    id: number,
    dto: UpdateActivityDto,
  ): Promise<QualityActivity> {
    const activity = await this.activityRepo.findOne({ where: { id } });
    if (!activity) throw new NotFoundException(`Activity #${id} not found`);
    Object.assign(activity, dto);
    return this.activityRepo.save(activity);
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
          previousActivityId: i === 0 ? undefined : orderedIds[i - 1],
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
