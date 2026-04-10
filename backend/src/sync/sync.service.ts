import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ExecutionProgressEntry } from '../execution/entities/execution-progress-entry.entity';
import { QualityActivityList } from '../quality/entities/quality-activity-list.entity';
import { QualityActivity } from '../quality/entities/quality-activity.entity';
import { SiteObservation } from '../quality/entities/site-observation.entity';
import { EhsObservation } from '../ehs/entities/ehs-observation.entity';

@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(ExecutionProgressEntry)
    private readonly progressRepo: Repository<ExecutionProgressEntry>,
    @InjectRepository(QualityActivityList)
    private readonly qualityListRepo: Repository<QualityActivityList>,
    @InjectRepository(QualityActivity)
    private readonly qualityActivityRepo: Repository<QualityActivity>,
    @InjectRepository(SiteObservation)
    private readonly qualitySiteObsRepo: Repository<SiteObservation>,
    @InjectRepository(EhsObservation)
    private readonly ehsObsRepo: Repository<EhsObservation>,
  ) {}

  /** Returns progress entries for a project updated after [since]. */
  async getProgressDelta(projectId: number, since?: string) {
    const where: any = { projectId };
    if (since) {
      where.updatedAt = MoreThan(new Date(since));
    }
    const data = await this.progressRepo.find({
      where,
      order: { updatedAt: 'ASC' },
    });
    return { synced_at: new Date().toISOString(), count: data.length, data };
  }

  /** Returns quality lists + activities + site obs for a project updated after [since]. */
  async getQualityDelta(projectId: number, since?: string) {
    const dateFilter = since ? MoreThan(new Date(since)) : undefined;
    const whereBase: any = { projectId };
    if (dateFilter) whereBase.updatedAt = dateFilter;

    // QualityActivity has no direct projectId — join through list.
    const activityQb = this.qualityActivityRepo
      .createQueryBuilder('a')
      .innerJoin('a.list', 'l', 'l.projectId = :projectId', { projectId })
      .orderBy('a.updatedAt', 'ASC');
    if (since) {
      activityQb.where('a.updatedAt > :since', { since: new Date(since) });
    }

    const [lists, activities, siteObs] = await Promise.all([
      this.qualityListRepo.find({ where: whereBase, order: { updatedAt: 'ASC' } }),
      activityQb.getMany(),
      this.qualitySiteObsRepo.find({ where: whereBase, order: { updatedAt: 'ASC' } }),
    ]);

    return {
      synced_at: new Date().toISOString(),
      count: lists.length + activities.length + siteObs.length,
      data: { lists, activities, siteObs },
    };
  }

  /** Returns EHS observations for a project updated after [since]. */
  async getEhsDelta(projectId: number, since?: string) {
    const where: any = { projectId };
    if (since) {
      where.updatedAt = MoreThan(new Date(since));
    }
    const data = await this.ehsObsRepo.find({
      where,
      order: { updatedAt: 'ASC' },
    });
    return { synced_at: new Date().toISOString(), count: data.length, data };
  }
}
