import { User } from '../users/user.entity';
export declare class AuditLog {
    id: number;
    userId: number;
    user: User;
    projectId: number;
    module: string;
    action: string;
    recordId: string;
    details: any;
    ipAddress: string;
    timestamp: Date;
}
