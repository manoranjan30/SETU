import { EpsNode } from '../../eps/eps.entity';
export declare class EhsProjectConfig {
    id: number;
    projectId: number;
    project: EpsNode;
    ehsManagerId: number;
    ehsManagerContact: string;
    inceptionDate: Date;
    lastLtiDate: Date;
    targetSafetyScore: number;
    createdAt: Date;
    updatedAt: Date;
}
