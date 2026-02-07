import { User } from '../users/user.entity';
export declare class AuditLog {
    id: number;
    action: string;
    resourceType: string;
    resourceId: string;
    details: string;
    userId: number;
    user: User;
    timestamp: Date;
}
