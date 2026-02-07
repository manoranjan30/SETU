import { WbsStatus } from '../entities/wbs.entity';
export declare class CreateWbsDto {
    parentId?: number;
    wbsName: string;
    discipline?: string;
    isControlAccount?: boolean;
    responsibleRoleId?: number;
    responsibleUserId?: number;
}
export declare class UpdateWbsDto {
    wbsName?: string;
    discipline?: string;
    isControlAccount?: boolean;
    responsibleRoleId?: number;
    responsibleUserId?: number;
    status?: WbsStatus;
}
export declare class ReorderWbsDto {
    parentId?: number;
    newSequence: number;
}
