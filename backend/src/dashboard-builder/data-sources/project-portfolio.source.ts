import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IDataSource,
  DataSourceField,
  DataSourceFilter,
  QueryConfig,
} from './base.data-source';
import { EpsNode } from '../../eps/eps.entity';

@Injectable()
export class ProjectPortfolioSource implements IDataSource {
  key = 'project.portfolio';
  label = 'Project Portfolio';
  module = 'EPS';
  scope = 'GLOBAL' as const;

  fields: DataSourceField[] = [
    {
      key: 'projectName',
      label: 'Project Name',
      type: 'string',
      filterable: true,
    },
    {
      key: 'projectCode',
      label: 'Project Code',
      type: 'string',
      filterable: true,
    },
    {
      key: 'projectType',
      label: 'Type',
      type: 'string',
      groupable: true,
      filterable: true,
    },
    {
      key: 'projectStatus',
      label: 'Status',
      type: 'string',
      groupable: true,
      filterable: true,
    },
    { key: 'city', label: 'City', type: 'string', groupable: true },
    { key: 'state', label: 'State', type: 'string', groupable: true },
    { key: 'plannedStartDate', label: 'Planned Start', type: 'date' },
    { key: 'plannedEndDate', label: 'Planned End', type: 'date' },
    { key: 'actualStartDate', label: 'Actual Start', type: 'date' },
    {
      key: 'estimatedProjectCost',
      label: 'Estimated Cost',
      type: 'number',
      aggregatable: true,
    },
    {
      key: 'approvedBudget',
      label: 'Approved Budget',
      type: 'number',
      aggregatable: true,
    },
    {
      key: 'totalBuiltupArea',
      label: 'Total Built-up Area',
      type: 'number',
      aggregatable: true,
    },
  ];

  filters: DataSourceFilter[] = [
    {
      key: 'projectStatus',
      label: 'Status',
      type: 'multi_select',
      options: [
        { value: 'Planned', label: 'Planned' },
        { value: 'Active', label: 'Active' },
        { value: 'On Hold', label: 'On Hold' },
        { value: 'Completed', label: 'Completed' },
      ],
    },
    {
      key: 'projectType',
      label: 'Type',
      type: 'multi_select',
      options: [
        { value: 'Residential', label: 'Residential' },
        { value: 'Commercial', label: 'Commercial' },
        { value: 'Infrastructure', label: 'Infrastructure' },
        { value: 'Mixed Use', label: 'Mixed Use' },
      ],
    },
    { key: 'city', label: 'City', type: 'text' },
  ];

  constructor(
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
  ) {}

  async execute(config: QueryConfig): Promise<any[]> {
    const qb = this.epsRepo
      .createQueryBuilder('e')
      .innerJoin('e.projectProfile', 'pp')
      .where("e.type = 'PROJECT'")
      .select([
        'e.id AS "id"',
        'e.name AS "projectName"',
        'pp.projectCode AS "projectCode"',
        'pp.projectType AS "projectType"',
        'pp.projectStatus AS "projectStatus"',
        'pp.city AS "city"',
        'pp.state AS "state"',
        'pp.plannedStartDate AS "plannedStartDate"',
        'pp.plannedEndDate AS "plannedEndDate"',
        'pp.actualStartDate AS "actualStartDate"',
        'pp.estimatedProjectCost AS "estimatedProjectCost"',
        'pp.approvedBudget AS "approvedBudget"',
        'pp.totalBuiltupArea AS "totalBuiltupArea"',
      ]);

    if (config.filters?.projectStatus?.length) {
      qb.andWhere('pp.projectStatus IN (:...statuses)', {
        statuses: config.filters.projectStatus,
      });
    }

    if (config.filters?.projectType?.length) {
      qb.andWhere('pp.projectType IN (:...types)', {
        types: config.filters.projectType,
      });
    }

    if (config.filters?.city) {
      qb.andWhere('pp.city ILIKE :city', { city: `%${config.filters.city}%` });
    }

    if (config.orderBy?.length) {
      config.orderBy.forEach((o) => qb.addOrderBy(`e.${o.field}`, o.direction));
    } else {
      qb.addOrderBy('e.name', 'ASC');
    }

    if (config.limit) {
      qb.limit(config.limit);
    }

    return qb.getRawMany();
  }

  async count(config: QueryConfig): Promise<number> {
    const qb = this.epsRepo
      .createQueryBuilder('e')
      .innerJoin('e.projectProfile', 'pp')
      .where("e.type = 'PROJECT'");

    if (config.filters?.projectStatus?.length) {
      qb.andWhere('pp.projectStatus IN (:...statuses)', {
        statuses: config.filters.projectStatus,
      });
    }

    return qb.getCount();
  }
}
