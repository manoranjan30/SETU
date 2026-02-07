import { User } from '../../users/user.entity';
export declare class TableViewConfig {
    id: number;
    userId: number;
    user: User;
    tableId: string;
    viewName: string;
    config: any;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}
