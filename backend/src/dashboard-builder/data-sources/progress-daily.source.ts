import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IDataSource,
  DataSourceField,
  DataSourceFilter,
  QueryConfig,
} from './base.data-source';
import {
  ExecutionProgressEntry,
  ExecutionProgressEntryStatus,
} from '../../execution/entities/execution-progress-entry.entity';

@Injectable()
export class ProgressDailySource implements IDataSource {
  key = 'progress.daily';
  label = 'Daily Progress Records';
  module = 'Progress';
  scope = 'PROJECT' as const;

  fields: DataSourceField[] = [
    { key: 'measureDate', label: 'Date', type: 'date', groupable: true },
    {
      key: 'measuredQty',
      label: 'Measured Qty',
      type: 'number',
      aggregatable: true,
    },
    {
      key: 'totalToDate',
      label: 'Total To Date',
      type: 'number',
      aggregatable: true,
    },
    {
      key: 'boqCode',
      label: 'BOQ Code',
      type: 'string',
      groupable: true,
      filterable: true,
    },
    { key: 'boqDescription', label: 'BOQ Description', type: 'string' },
    {
      key: 'status',
      label: 'Status',
      type: 'string',
      groupable: true,
      filterable: true,
    },
    { key: 'locationId', label: 'Location', type: 'string', groupable: true },
    { key: 'createdBy', label: 'Created By', type: 'string', groupable: true },
  ];

  filters: DataSourceFilter[] = [
    { key: 'projectId', label: 'Project', type: 'select', required: true },
    { key: 'dateRange', label: 'Date Range', type: 'date_range' },
    {
      key: 'status',
      label: 'Status',
      type: 'multi_select',
      options: [
        { value: 'PENDING', label: 'Pending' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'REJECTED', label: 'Rejected' },
      ],
    },
  ];

  constructor(
    @InjectRepository(ExecutionProgressEntry)
    private readonly progressRepo: Repository<ExecutionProgressEntry>,
  ) {}

  async execute(config: QueryConfig): Promise<any[]> {
    const qb = this.progressRepo
      .createQueryBuilder('p')
      .leftJoin('p.workOrderItem', 'woItem')
      .leftJoin('woItem.boqItem', 'b')
      .select([
        'p.id AS "id"',
        'p.entryDate AS "measureDate"',
        'p.enteredQty AS "measuredQty"',
        'NULL AS "totalToDate"',
        'b.boqCode AS "boqCode"',
        'b.description AS "boqDescription"',
        'p.status AS "status"',
        'p.executionEpsNodeId AS "locationId"',
        'p.createdBy AS "createdBy"',
      ]);

    if (config.projectId) {
      qb.andWhere('p.projectId = :pid', { pid: config.projectId });
    }

    if (config.dateRange?.start) {
      qb.andWhere('p.entryDate >= :start', { start: config.dateRange.start });
    }
    if (config.dateRange?.end) {
      qb.andWhere('p.entryDate <= :end', { end: config.dateRange.end });
    }

    if (config.filters?.status?.length) {
      qb.andWhere('p.status IN (:...statuses)', {
        statuses: config.filters.status,
      });
    }

    // Support groupBy aggregation for trend charts
    if (config.groupBy?.length) {
      const groupCols = config.groupBy.map((g) => {
        if (g === 'boqCode') return 'b.boqCode';
        if (g === 'boqDescription') return 'b.description';
        return `p.${g}`;
      });

      qb.select([]);
      groupCols.forEach((col) => qb.addSelect(col, col.split('.').pop()));
      qb.addSelect('SUM(p.enteredQty)', 'totalMeasured');
      qb.addSelect('COUNT(p.id)', 'recordCount');
      groupCols.forEach((col) => qb.addGroupBy(col));
    }

    if (config.orderBy?.length) {
      config.orderBy.forEach((o) => qb.addOrderBy(`p.${o.field}`, o.direction));
    } else {
      qb.addOrderBy('p.entryDate', 'DESC');
    }

    if (config.limit) {
      qb.limit(config.limit);
    }

    return qb.getRawMany();
  }

  async count(config: QueryConfig): Promise<number> {
    const qb = this.progressRepo.createQueryBuilder('p');

    if (config.projectId) {
      qb.andWhere('p.projectId = :pid', { pid: config.projectId });
    }

    if (config.dateRange?.start) {
      qb.andWhere('p.entryDate >= :start', { start: config.dateRange.start });
    }
    if (config.dateRange?.end) {
      qb.andWhere('p.entryDate <= :end', { end: config.dateRange.end });
    }

    return qb.getCount();
  }
}
