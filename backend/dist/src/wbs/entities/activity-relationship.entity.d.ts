import { Activity } from './activity.entity';
export declare enum RelationshipType {
    FS = "FS",
    SS = "SS",
    FF = "FF",
    SF = "SF"
}
export declare class ActivityRelationship {
    id: number;
    projectId: number;
    predecessor: Activity;
    successor: Activity;
    relationshipType: RelationshipType;
    lagDays: number;
}
