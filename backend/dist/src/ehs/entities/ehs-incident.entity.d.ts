import { EpsNode } from '../../eps/eps.entity';
import { User } from '../../users/user.entity';
export declare enum IncidentType {
    NEAR_MISS = "NEAR_MISS",
    FAC = "FAC",
    MTC = "MTC",
    LTI = "LTI",
    PROPERTY_DAMAGE = "PROPERTY_DAMAGE",
    ENVIRONMENTAL = "ENVIRONMENTAL"
}
export declare enum InvestigationStatus {
    PENDING = "PENDING",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETE = "COMPLETE"
}
export declare enum IncidentStatus {
    REPORTED = "REPORTED",
    INVESTIGATING = "INVESTIGATING",
    CLOSED = "CLOSED"
}
export declare class EhsIncident {
    id: number;
    projectId: number;
    project: EpsNode;
    incidentDate: string;
    incidentType: IncidentType;
    location: string;
    description: string;
    affectedPersons: string[];
    bodyPartAffected: string;
    immediateCause: string;
    rootCause: string;
    witnesses: string[];
    photoUrls: string[];
    firstAidGiven: boolean;
    hospitalVisit: boolean;
    daysLost: number;
    investigationStatus: InvestigationStatus;
    investigatedById: number;
    investigatedBy: User;
    investigationDate: string;
    correctiveActions: string;
    preventiveActions: string;
    status: IncidentStatus;
    reportedById: number;
    reportedBy: User;
    createdAt: Date;
    updatedAt: Date;
}
