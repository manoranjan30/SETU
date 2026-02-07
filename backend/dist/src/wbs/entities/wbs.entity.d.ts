import { EpsNode } from '../../eps/eps.entity';
import { User } from '../../users/user.entity';
import { Role } from '../../roles/role.entity';
export declare enum WbsStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE"
}
import { Activity } from './activity.entity';
export declare class WbsNode {
    id: number;
    projectId: number;
    project: EpsNode;
    parentId: number | null;
    parent: WbsNode;
    children: WbsNode[];
    wbsCode: string;
    wbsName: string;
    wbsLevel: number;
    sequenceNo: number;
    discipline: string;
    isControlAccount: boolean;
    responsibleRoleId: number | null;
    responsibleRole: Role;
    responsibleUserId: number | null;
    responsibleUser: User;
    status: WbsStatus;
    startDate: Date | null;
    finishDate: Date | null;
    startDateActual: Date | null;
    finishDateActual: Date | null;
    startDateBaseline: Date | null;
    finishDateBaseline: Date | null;
    startDatePlanned: Date | null;
    finishDatePlanned: Date | null;
    duration: number;
    percentComplete: number;
    budgetedValue: number;
    actualValue: number;
    createdBy: string;
    createdOn: Date;
    updatedOn: Date;
    activities: Activity[];
}
