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
    module: string,
    action: string,
    recordId?: string | number,
    projectId?: number,
    details?: any,
    ipAddress?: string,
  ) {
    try {
      const log = this.auditRepo.create({
        userId,
        module,
        action,
        recordId: recordId ? String(recordId) : undefined,
        projectId,
        details,
        ipAddress,
      });
      await this.auditRepo.save(log);
    } catch (e) {
      console.error('AuditLog Error:', e);
    }
  }

  async findAll(projectId?: number, module?: string, limit: number = 100) {
    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (module) where.module = module;

    return this.auditRepo.find({
      where,
      relations: ['user'],
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  async findByProject(projectId: number) {
    return this.auditRepo.find({
      where: { projectId },
      relations: ['user'],
      order: { timestamp: 'DESC' },
    });
  }
}
