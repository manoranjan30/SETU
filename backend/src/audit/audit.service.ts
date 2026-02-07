import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(
    userId: number,
    action: string,
    resourceType: string,
    resourceId: string | number,
    details?: any,
  ) {
    try {
      const log = this.auditRepo.create({
        userId,
        action,
        resourceType,
        resourceId: String(resourceId),
        details: details ? JSON.stringify(details) : undefined,
      });
      await this.auditRepo.save(log);
    } catch (e) {
      console.error('Failed to save audit log', e);
      // Non-blocking
    }
  }
}
