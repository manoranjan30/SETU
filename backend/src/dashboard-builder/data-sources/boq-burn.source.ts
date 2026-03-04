import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IDataSource, DataSourceField, DataSourceFilter, QueryConfig } from './base.data-source';
import { BoqItem } from '../../boq/entities/boq-item.entity';

@Injectable()
export class BoqBurnSource implements IDataSource {
    key = 'boq.burn';
    label = 'BOQ Cost & Progress';
    module = 'BOQ';
    scope = 'PROJECT' as const;

    fields: DataSourceField[] = [
        { key: 'boqCode', label: 'BOQ Code', type: 'string', groupable: true, filterable: true },
        { key: 'description', label: 'Description', type: 'string', filterable: true },
        { key: 'uom', label: 'UOM', type: 'string', groupable: true },
        { key: 'qty', label: 'Contract Qty', type: 'number', aggregatable: true },
        { key: 'consumedQty', label: 'Executed Qty', type: 'number', aggregatable: true },
        { key: 'rate', label: 'Rate', type: 'number' },
        { key: 'amount', label: 'Contract Amount', type: 'number', aggregatable: true },
        { key: 'burnValue', label: 'Burn Value', type: 'number', aggregatable: true },
        { key: 'burnPercent', label: 'Burn %', type: 'percent' },
        { key: 'status', label: 'Status', type: 'string', groupable: true, filterable: true },
    ];

    filters: DataSourceFilter[] = [
        { key: 'projectId', label: 'Project', type: 'select', required: true },
        {
            key: 'status', label: 'Status', type: 'multi_select', options: [
                { value: 'DRAFT', label: 'Draft' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'COMPLETED', label: 'Completed' },
            ]
        },
    ];

    constructor(
        @InjectRepository(BoqItem)
        private readonly boqRepo: Repository<BoqItem>,
    ) { }

    async execute(config: QueryConfig): Promise<any[]> {
        const qb = this.boqRepo.createQueryBuilder('b')
            .select([
                'b.id AS "id"',
                'b.boqCode AS "boqCode"',
                'b.description AS "description"',
                'b.uom AS "uom"',
                'b.qty AS "qty"',
                'b.consumedQty AS "consumedQty"',
                'b.rate AS "rate"',
                'b.amount AS "amount"',
                'CASE WHEN b.qty > 0 THEN ROUND((b.consumedQty / b.qty) * 100, 2) ELSE 0 END AS "burnPercent"',
                'ROUND(b.consumedQty * b.rate, 2) AS "burnValue"',
                'b.status AS "status"',
            ]);

        if (config.projectId) {
            qb.andWhere('b.projectId = :pid', { pid: config.projectId });
        }

        if (config.filters?.status?.length) {
            qb.andWhere('b.status IN (:...statuses)', { statuses: config.filters.status });
        }

        if (config.orderBy?.length) {
            config.orderBy.forEach((o) => qb.addOrderBy(`b.${o.field}`, o.direction));
        } else {
            qb.addOrderBy('b.boqCode', 'ASC');
        }

        if (config.limit) {
            qb.limit(config.limit);
        }

        return qb.getRawMany();
    }

    async count(config: QueryConfig): Promise<number> {
        const qb = this.boqRepo.createQueryBuilder('b');

        if (config.projectId) {
            qb.andWhere('b.projectId = :pid', { pid: config.projectId });
        }

        return qb.getCount();
    }
}
