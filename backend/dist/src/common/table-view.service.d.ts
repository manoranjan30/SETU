import { Repository } from 'typeorm';
import { TableViewConfig } from './entities/table-view-config.entity';
export declare class TableViewService {
    private readonly repo;
    constructor(repo: Repository<TableViewConfig>);
    getViews(userId: number, tableId: string): Promise<TableViewConfig[]>;
    saveView(userId: number, dto: {
        tableId: string;
        viewName: string;
        config: any;
        isDefault?: boolean;
    }): Promise<TableViewConfig>;
    deleteView(userId: number, id: number): Promise<TableViewConfig>;
}
