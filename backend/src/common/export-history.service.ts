import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ExportHistory,
  ExportHistoryStatus,
} from './entities/export-history.entity';
import { EpsNode } from '../eps/eps.entity';

@Injectable()
export class ExportHistoryService {
  constructor(
    @InjectRepository(ExportHistory)
    private readonly repo: Repository<ExportHistory>,
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
  ) {}

  async list(module?: string, limit = 50) {
    const rows = await this.repo.find({
      where: module ? { module } : {},
      order: { createdAt: 'DESC' },
      take: Math.min(200, Math.max(10, Number(limit) || 50)),
    });
    const projectIds = Array.from(
      new Set(
        rows
          .map((row) => row.projectId)
          .filter((id): id is number => typeof id === 'number'),
      ),
    );
    const projects = projectIds.length
      ? await this.epsRepo.find({ where: { id: In(projectIds) } })
      : [];
    const projectMap = new Map(projects.map((project) => [project.id, project.name]));
    return rows.map((row) => ({
      ...row,
      projectName: row.projectId ? projectMap.get(row.projectId) || null : null,
    }));
  }

  async record(input: {
    module: string;
    exportType: string;
    projectId?: number | null;
    status: ExportHistoryStatus;
    recipientCount?: number;
    fileName?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    return this.repo.save(
      this.repo.create({
        module: input.module,
        exportType: input.exportType,
        projectId: input.projectId ?? null,
        status: input.status,
        recipientCount: input.recipientCount || 0,
        fileName: input.fileName || null,
        dateFrom: input.dateFrom || null,
        dateTo: input.dateTo || null,
        errorMessage: input.errorMessage || null,
        metadata: input.metadata || {},
      }),
    );
  }
}
