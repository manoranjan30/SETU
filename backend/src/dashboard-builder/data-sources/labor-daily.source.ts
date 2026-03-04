import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IDataSource, DataSourceField, DataSourceFilter, QueryConfig } from './base.data-source';
import { DailyLaborPresence } from '../../labor/entities/daily-labor-presence.entity';

@Injectable()
export class LaborDailySource implements IDataSource {
    key = 'labor.daily';
    label = 'Daily Manpower';
    module = 'Labor';
    scope = 'PROJECT' as const;

    fields: DataSourceField[] = [
        { key: 'date', label: 'Date', type: 'date', groupable: true },
        { key: 'categoryName', label: 'Category', type: 'string', groupable: true, filterable: true },
        { key: 'categoryGroup', label: 'Category Group', type: 'string', groupable: true, filterable: true },
        { key: 'count', label: 'Headcount', type: 'number', aggregatable: true },
        { key: 'contractorName', label: 'Contractor', type: 'string', groupable: true, filterable: true },
    ];

    filters: DataSourceFilter[] = [
        { key: 'projectId', label: 'Project', type: 'select', required: true },
        { key: 'dateRange', label: 'Date Range', type: 'date_range' },
        {
            key: 'categoryGroup', label: 'Category Group', type: 'multi_select', options: [
                { value: 'Skilled', label: 'Skilled' },
                { value: 'Semi-Skilled', label: 'Semi-Skilled' },
                { value: 'Unskilled', label: 'Unskilled' },
            ]
        },
    ];

    constructor(
        @InjectRepository(DailyLaborPresence)
        private readonly laborRepo: Repository<DailyLaborPresence>,
    ) { }

    async execute(config: QueryConfig): Promise<any[]> {
        const qb = this.laborRepo.createQueryBuilder('l')
            .leftJoin('l.category', 'c')
            .select([
                'l.id AS "id"',
                'l.date AS "date"',
                'c.name AS "categoryName"',
                'c.categoryGroup AS "categoryGroup"',
                'l.count AS "count"',
                'l.contractorName AS "contractorName"',
            ]);

        if (config.projectId) {
            qb.andWhere('l.projectId = :pid', { pid: config.projectId });
        }

        if (config.dateRange?.start) {
            qb.andWhere('l.date >= :start', { start: config.dateRange.start });
        }
        if (config.dateRange?.end) {
            qb.andWhere('l.date <= :end', { end: config.dateRange.end });
        }

        if (config.filters?.categoryGroup?.length) {
            qb.andWhere('c.categoryGroup IN (:...groups)', { groups: config.filters.categoryGroup });
        }

        // Support groupBy aggregation for charts (e.g., SUM count by date)
        if (config.groupBy?.length) {
            const groupCols = config.groupBy.map((g) => {
                if (g === 'categoryName') return 'c.name';
                if (g === 'categoryGroup') return 'c.categoryGroup';
                return `l.${g}`;
            });

            qb.select([]);
            groupCols.forEach((col) => qb.addSelect(col, col.split('.').pop()));
            qb.addSelect('SUM(l.count)', 'totalCount');
            groupCols.forEach((col) => qb.addGroupBy(col));
        }

        if (config.orderBy?.length) {
            config.orderBy.forEach((o) => qb.addOrderBy(`l.${o.field}`, o.direction));
        } else {
            qb.addOrderBy('l.date', 'DESC');
        }

        if (config.limit) {
            qb.limit(config.limit);
        }

        return qb.getRawMany();
    }

    async count(config: QueryConfig): Promise<number> {
        const qb = this.laborRepo.createQueryBuilder('l');

        if (config.projectId) {
            qb.andWhere('l.projectId = :pid', { pid: config.projectId });
        }

        if (config.dateRange?.start) {
            qb.andWhere('l.date >= :start', { start: config.dateRange.start });
        }
        if (config.dateRange?.end) {
            qb.andWhere('l.date <= :end', { end: config.dateRange.end });
        }

        return qb.getCount();
    }
}
