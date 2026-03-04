import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IDataSource, DataSourceField, DataSourceFilter, QueryConfig } from './base.data-source';
import { Activity } from '../../wbs/entities/activity.entity';

@Injectable()
export class ActivityListSource implements IDataSource {
    key = 'activity.list';
    label = 'All Activities';
    module = 'WBS';
    scope = 'PROJECT' as const;

    fields: DataSourceField[] = [
        { key: 'activityCode', label: 'Activity Code', type: 'string', groupable: true, filterable: true },
        { key: 'activityName', label: 'Activity Name', type: 'string', filterable: true },
        { key: 'activityType', label: 'Type', type: 'string', groupable: true, filterable: true },
        { key: 'status', label: 'Status', type: 'string', groupable: true, filterable: true },
        { key: 'percentComplete', label: '% Complete', type: 'percent', aggregatable: true },
        { key: 'durationPlanned', label: 'Planned Duration', type: 'number', aggregatable: true },
        { key: 'durationActual', label: 'Actual Duration', type: 'number', aggregatable: true },
        { key: 'startDatePlanned', label: 'Planned Start', type: 'date' },
        { key: 'finishDatePlanned', label: 'Planned Finish', type: 'date' },
        { key: 'startDateActual', label: 'Actual Start', type: 'date' },
        { key: 'finishDateActual', label: 'Actual Finish', type: 'date' },
        { key: 'budgetedValue', label: 'Budgeted Value', type: 'number', aggregatable: true },
        { key: 'actualValue', label: 'Actual Value', type: 'number', aggregatable: true },
        { key: 'isMilestone', label: 'Is Milestone', type: 'boolean', filterable: true },
        { key: 'wbsNodeName', label: 'WBS Node', type: 'string', groupable: true },
    ];

    filters: DataSourceFilter[] = [
        { key: 'projectId', label: 'Project', type: 'select', required: true },
        {
            key: 'status', label: 'Status', type: 'multi_select', options: [
                { value: 'NOT_STARTED', label: 'Not Started' },
                { value: 'IN_PROGRESS', label: 'In Progress' },
                { value: 'COMPLETED', label: 'Completed' },
            ]
        },
        {
            key: 'activityType', label: 'Type', type: 'multi_select', options: [
                { value: 'TASK', label: 'Task' },
                { value: 'MILESTONE', label: 'Milestone' },
            ]
        },
        { key: 'dateRange', label: 'Date Range', type: 'date_range' },
    ];

    constructor(
        @InjectRepository(Activity)
        private readonly activityRepo: Repository<Activity>,
    ) { }

    async execute(config: QueryConfig): Promise<any[]> {
        const qb = this.activityRepo.createQueryBuilder('a')
            .leftJoin('a.wbsNode', 'w')
            .select([
                'a.id AS "id"',
                'a.activityCode AS "activityCode"',
                'a.activityName AS "activityName"',
                'a.activityType AS "activityType"',
                'a.status AS "status"',
                'a.percentComplete AS "percentComplete"',
                'a.durationPlanned AS "durationPlanned"',
                'a.durationActual AS "durationActual"',
                'a.startDatePlanned AS "startDatePlanned"',
                'a.finishDatePlanned AS "finishDatePlanned"',
                'a.startDateActual AS "startDateActual"',
                'a.finishDateActual AS "finishDateActual"',
                'a.budgetedValue AS "budgetedValue"',
                'a.actualValue AS "actualValue"',
                'a.isMilestone AS "isMilestone"',
                'w.name AS "wbsNodeName"',
            ]);

        if (config.projectId) {
            qb.andWhere('a.projectId = :pid', { pid: config.projectId });
        }

        if (config.filters?.status?.length) {
            qb.andWhere('a.status IN (:...statuses)', { statuses: config.filters.status });
        }

        if (config.filters?.activityType?.length) {
            qb.andWhere('a.activityType IN (:...types)', { types: config.filters.activityType });
        }

        if (config.dateRange?.start) {
            qb.andWhere('a.startDatePlanned >= :start', { start: config.dateRange.start });
        }
        if (config.dateRange?.end) {
            qb.andWhere('a.finishDatePlanned <= :end', { end: config.dateRange.end });
        }

        if (config.orderBy?.length) {
            config.orderBy.forEach((o) => qb.addOrderBy(`a.${o.field}`, o.direction));
        } else {
            qb.addOrderBy('a.activityCode', 'ASC');
        }

        if (config.limit) {
            qb.limit(config.limit);
        }

        return qb.getRawMany();
    }

    async count(config: QueryConfig): Promise<number> {
        const qb = this.activityRepo.createQueryBuilder('a');

        if (config.projectId) {
            qb.andWhere('a.projectId = :pid', { pid: config.projectId });
        }

        if (config.filters?.status?.length) {
            qb.andWhere('a.status IN (:...statuses)', { statuses: config.filters.status });
        }

        return qb.getCount();
    }
}
