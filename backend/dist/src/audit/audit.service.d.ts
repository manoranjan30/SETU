import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
export declare class AuditService {
    private readonly auditRepo;
    constructor(auditRepo: Repository<AuditLog>);
    log(userId: number, action: string, resourceType: string, resourceId: string | number, details?: any): Promise<void>;
}
