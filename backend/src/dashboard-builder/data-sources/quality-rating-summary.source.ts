import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IDataSource,
  DataSourceField,
  DataSourceFilter,
  QueryConfig,
} from './base.data-source';
import { ProjectRating } from '../../quality/entities/quality-project-rating.entity';

@Injectable()
export class QualityRatingSummarySource implements IDataSource {
  key = 'quality.rating.summary';
  label = 'Quality Rating Summary';
  module = 'Quality';
  scope = 'GLOBAL' as const;

  fields: DataSourceField[] = [
    { key: 'projectName', label: 'Project Name', type: 'string', groupable: true },
    { key: 'projectCode', label: 'Project Code', type: 'string', groupable: true },
    { key: 'period', label: 'Rating Period', type: 'string', groupable: true },
    { key: 'overallScore', label: 'Overall Score', type: 'percent', aggregatable: true },
    {
      key: 'qualityProgressPercent',
      label: 'Quality Progress %',
      type: 'percent',
      aggregatable: true,
    },
    {
      key: 'observationScore',
      label: 'Observation Score',
      type: 'percent',
      aggregatable: true,
    },
    {
      key: 'documentationScore',
      label: 'Documentation Score',
      type: 'percent',
      aggregatable: true,
    },
    {
      key: 'customerInspectionScore',
      label: 'Customer Inspection Score',
      type: 'percent',
      aggregatable: true,
    },
    {
      key: 'totalObservations',
      label: 'Total Observations',
      type: 'number',
      aggregatable: true,
    },
    {
      key: 'openObservations',
      label: 'Open Observations',
      type: 'number',
      aggregatable: true,
    },
    {
      key: 'pendingRatioPercentage',
      label: 'Pending Ratio %',
      type: 'percent',
      aggregatable: true,
    },
  ];

  filters: DataSourceFilter[] = [
    { key: 'period', label: 'Period (YYYY-MM)', type: 'text' },
  ];

  constructor(
    @InjectRepository(ProjectRating)
    private readonly ratingRepo: Repository<ProjectRating>,
  ) {}

  async execute(config: QueryConfig): Promise<any[]> {
    const qb = this.ratingRepo
      .createQueryBuilder('r')
      .innerJoin('r.projectNode', 'p')
      .leftJoin('p.projectProfile', 'pp')
      .select([
        'p.id AS "projectId"',
        'p.name AS "projectName"',
        'pp.projectCode AS "projectCode"',
        'r.period AS "period"',
        'ROUND(COALESCE(r.overallScore, 0)::numeric, 2) AS "overallScore"',
        'ROUND((100 - COALESCE(r.pendingRatioPercentage, 0))::numeric, 2) AS "qualityProgressPercent"',
        'ROUND(COALESCE(r.observationScore, 0)::numeric, 2) AS "observationScore"',
        'ROUND(COALESCE(r.documentationScore, 0)::numeric, 2) AS "documentationScore"',
        'ROUND(COALESCE(r.customerInspectionScore, 0)::numeric, 2) AS "customerInspectionScore"',
        'COALESCE(r.totalObservations, 0) AS "totalObservations"',
        'COALESCE(r.openObservations, 0) AS "openObservations"',
        'ROUND(COALESCE(r.pendingRatioPercentage, 0)::numeric, 2) AS "pendingRatioPercentage"',
      ])
      .where((innerQb) => {
        const sub = innerQb
          .subQuery()
          .select('MAX(r2.period)')
          .from(ProjectRating, 'r2')
          .where('r2.projectNodeId = r.projectNodeId')
          .getQuery();
        return `r.period = ${sub}`;
      });

    if (config.filters?.period) {
      qb.andWhere('r.period = :period', { period: config.filters.period });
    }

    if (config.orderBy?.length) {
      for (const o of config.orderBy) {
        qb.addOrderBy(`"${o.field}"`, o.direction);
      }
    } else {
      qb.addOrderBy('"overallScore"', 'DESC');
      qb.addOrderBy('p.name', 'ASC');
    }

    if (config.limit) {
      qb.limit(config.limit);
    }

    return qb.getRawMany();
  }

  async count(config: QueryConfig): Promise<number> {
    const qb = this.ratingRepo
      .createQueryBuilder('r')
      .select('COUNT(DISTINCT r.projectNodeId)', 'cnt');

    if (config.filters?.period) {
      qb.andWhere('r.period = :period', { period: config.filters.period });
    }

    const raw = await qb.getRawOne<{ cnt: string }>();
    return Number(raw?.cnt || 0);
  }
}
