import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
export declare class AuditService {
    private readonly auditRepo;
    constructor(auditRepo: Repository<AuditLog>);
    log(userId: number, module: string, action: string, recordId?: string | number, projectId?: number, details?: any, ipAddress?: string): Promise<void>;
    findAll(projectId?: number, module?: string, limit?: number): Promise<AuditLog[]>;
    findByProject(projectId: number): Promise<AuditLog[]>;
}
