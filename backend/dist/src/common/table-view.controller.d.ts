import { TableViewService } from './table-view.service';
export declare class TableViewController {
    private readonly service;
    constructor(service: TableViewService);
    getViews(req: any, tableId: string): Promise<import("./entities/table-view-config.entity").TableViewConfig[]>;
    saveView(req: any, body: {
        tableId: string;
        viewName: string;
        config: any;
        isDefault?: boolean;
    }): Promise<import("./entities/table-view-config.entity").TableViewConfig>;
    deleteView(req: any, id: number): Promise<import("./entities/table-view-config.entity").TableViewConfig>;
}
