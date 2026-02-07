import { EpsNode } from '../../eps/eps.entity';
import { User } from '../../users/user.entity';
export declare enum TrainingType {
    INDUCTION = "INDUCTION",
    TBT = "TBT",
    SPECIALIZED = "SPECIALIZED",
    FIRE_DRILL = "FIRE_DRILL",
    FIRST_AID = "FIRST_AID"
}
export declare class EhsTraining {
    id: number;
    projectId: number;
    project: EpsNode;
    trainingType: TrainingType;
    status: string;
    date: string;
    topic: string;
    trainer: string;
    attendeeCount: number;
    attendeeNames: string[];
    duration: number;
    remarks: string;
    createdById: number;
    createdBy: User;
    createdAt: Date;
}
