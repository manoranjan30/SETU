import { EpsNode } from '../../eps/eps.entity';
import { User } from '../../users/user.entity';
export declare enum ObservationType {
    UNSAFE_ACT = "UNSAFE_ACT",
    UNSAFE_CONDITION = "UNSAFE_CONDITION",
    GOOD_PRACTICE = "GOOD_PRACTICE"
}
export declare enum SeverityLevel {
    CRITICAL = "CRITICAL",
    SERIOUS = "SERIOUS",
    MINOR = "MINOR",
    NEGLIGIBLE = "NEGLIGIBLE"
}
export declare enum ObservationStatus {
    OPEN = "OPEN",
    IN_PROGRESS = "IN_PROGRESS",
    PENDING_VERIFICATION = "PENDING_VERIFICATION",
    CLOSED = "CLOSED",
    ESCALATED = "ESCALATED"
}
export declare class EhsObservation {
    id: number;
    projectId: number;
    project: EpsNode;
    date: string;
    category: string;
    observationType: ObservationType;
    severity: SeverityLevel;
    location: string;
    description: string;
    photoUrl: string;
    reportedById: number;
    reportedBy: User;
    assignedToId: number;
    assignedTo: User;
    targetDate: string;
    correctiveAction: string;
    status: ObservationStatus;
    closedDate: string;
    closedById: number;
    closedBy: User;
    createdAt: Date;
    updatedAt: Date;
}
