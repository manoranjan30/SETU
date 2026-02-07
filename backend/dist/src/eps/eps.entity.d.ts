import { ProjectProfile } from './project-profile.entity';
export declare enum EpsNodeType {
    COMPANY = "COMPANY",
    PROJECT = "PROJECT",
    BLOCK = "BLOCK",
    TOWER = "TOWER",
    FLOOR = "FLOOR",
    UNIT = "UNIT",
    ROOM = "ROOM"
}
export declare class EpsNode {
    id: number;
    name: string;
    type: EpsNodeType;
    parentId: number;
    parent: EpsNode;
    children: EpsNode[];
    order: number;
    createdBy: string;
    updatedBy: string;
    projectProfile: ProjectProfile;
    createdAt: Date;
    updatedAt: Date;
}
