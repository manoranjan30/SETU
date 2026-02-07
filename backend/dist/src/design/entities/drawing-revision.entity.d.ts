import { DrawingRegister } from './drawing-register.entity';
import { User } from '../../users/user.entity';
export declare enum RevisionStatus {
    DRAFT = "DRAFT",
    SUBMITTED = "SUBMITTED",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED"
}
export declare class DrawingRevision {
    id: number;
    registerId: number;
    register: DrawingRegister;
    revisionNumber: string;
    filePath: string;
    originalFileName: string;
    fileSize: number;
    fileType: string;
    status: RevisionStatus;
    comments: string;
    uploadedById: number;
    uploadedBy: User;
    uploadedAt: Date;
}
