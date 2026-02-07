import { EpsNode } from '../../eps/eps.entity';
import { DrawingCategory } from './drawing-category.entity';
import { DrawingRevision } from './drawing-revision.entity';
export declare enum DrawingStatus {
    PLANNED = "PLANNED",
    IN_PROGRESS = "IN_PROGRESS",
    GFC = "GFC",
    OBSOLETE = "OBSOLETE",
    HOLD = "HOLD"
}
export declare class DrawingRegister {
    id: number;
    projectId: number;
    project: EpsNode;
    categoryId: number;
    category: DrawingCategory;
    drawingNumber: string;
    title: string;
    status: DrawingStatus;
    currentRevisionId: number;
    currentRevision: DrawingRevision;
    revisions: DrawingRevision[];
    createdAt: Date;
    updatedAt: Date;
}
