import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IDataSource,
  DataSourceField,
  DataSourceFilter,
  QueryConfig,
} from './base.data-source';
import { Activity } from '../../wbs/entities/activity.entity';
import { EpsNode } from '../../eps/eps.entity';

@Injectable()
export class ProjectProgressSummarySource implements IDataSource {
  key = 'project.progress.summary';
  label = 'Project Site Progress Summary';
  module = 'Execution';
  scope = 'GLOBAL' as const;

  fields: DataSourceField[] = [
    { key: 'projectName', label: 'Project Name', type: 'string', groupable: true },
    { key: 'projectCode', label: 'Project Code', type: 'string', groupable: true },
    { key: 'projectStatus', label: 'Project Status', type: 'string', groupable: true },
    {
      key: 'siteProgressPercent',
      label: 'Site Progress %',
      type: 'percent',
      aggregatable: true,
    },
    { key: 'totalActivities', label: 'Total Activities', type: 'number', aggregatable: true },
    {
      key: 'completedActivities',
      label: 'Completed Activities',
      type: 'number',
      aggregatable: true,
    },
    {
      key: 'inProgressActivities',
      label: 'In Progress Activities',
      type: 'number',
      aggregatable: true,
    },
    {
      key: 'notStartedActivities',
      label: 'Not Started Activities',
      type: 'number',
      aggregatable: true,
    },
    {
      key: 'budgetedValue',
      label: 'Budgeted Value',
      type: 'number',
      aggregatable: true,
    },
    {
      key: 'actualValue',
      label: 'Actual Value',
      type: 'number',
      aggregatable: true,
    },
    {
      key: 'cashFlowVariance',
      label: 'Cash Flow Variance',
      type: 'number',
      aggregatable: true,
    },
  ];

  filters: DataSourceFilter[] = [
    {
      key: 'projectStatus',
      label: 'Project Status',
      type: 'multi_select',
      options: [
        { value: 'Planned', label: 'Planned' },
        { value: 'Active', label: 'Active' },
        { value: 'On Hold', label: 'On Hold' },
        { value: 'Completed', label: 'Completed' },
      ],
    },
  ];

  constructor(
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
  ) {}

  async execute(config: QueryConfig): Promise<any[]> {
    const qb = this.epsRepo
      .createQueryBuilder('p')
      .leftJoin('p.projectProfile', 'pp')
      .leftJoin(Activity, 'a', 'a.projectId = p.id')
      .where("p.type = 'PROJECT'")
      .select([
        'p.id AS "projectId"',
        'p.name AS "projectName"',
        'pp.projectCode AS "projectCode"',
        'COALESCE(pp.projectStatus, \'Unknown\') AS "projectStatus"',
        'ROUND(COALESCE(AVG(a.percentComplete), 0), 2) AS "siteProgressPercent"',
        'COUNT(a.id) AS "totalActivities"',
        "SUM(CASE WHEN a.status = 'COMPLETED' THEN 1 ELSE 0 END) AS \"completedActivities\"",
        "SUM(CASE WHEN a.status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS \"inProgressActivities\"",
        "SUM(CASE WHEN a.status = 'NOT_STARTED' THEN 1 ELSE 0 END) AS \"notStartedActivities\"",
        'ROUND(COALESCE(SUM(a.budgetedValue), 0), 2) AS "budgetedValue"',
        'ROUND(COALESCE(SUM(a.actualValue), 0), 2) AS "actualValue"',
        'ROUND(COALESCE(SUM(a.budgetedValue), 0) - COALESCE(SUM(a.actualValue), 0), 2) AS "cashFlowVariance"',
      ])
      .groupBy('p.id')
      .addGroupBy('p.name')
      .addGroupBy('pp.projectCode')
      .addGroupBy('pp.projectStatus');

    if (config.filters?.projectStatus?.length) {
      qb.andWhere('pp.projectStatus IN (:...statuses)', {
        statuses: config.filters.projectStatus,
      });
    }

    if (config.orderBy?.length) {
      for (const o of config.orderBy) {
        qb.addOrderBy(`"${o.field}"`, o.direction);
      }
    } else {
      qb.addOrderBy('"siteProgressPercent"', 'DESC');
      qb.addOrderBy('p.name', 'ASC');
    }

    if (config.limit) {
      qb.limit(config.limit);
    }

    return qb.getRawMany();
  }

  async count(config: QueryConfig): Promise<number> {
    const qb = this.epsRepo
      .createQueryBuilder('p')
      .leftJoin('p.projectProfile', 'pp')
      .where("p.type = 'PROJECT'");

    if (config.filters?.projectStatus?.length) {
      qb.andWhere('pp.projectStatus IN (:...statuses)', {
        statuses: config.filters.projectStatus,
      });
    }

    return qb.getCount();
  }
}
