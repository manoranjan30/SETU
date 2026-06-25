import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QualityObservationNcr } from './entities/quality-observation-ncr.entity';

export type QualityNcrSourceType =
  | 'QUALITY_SITE_OBSERVATION'
  | 'QUALITY_CHECKLIST_OBSERVATION';

@Injectable()
export class QualityNcrSyncService {
  constructor(
    @InjectRepository(QualityObservationNcr)
    private readonly ncrRepo: Repository<QualityObservationNcr>,
  ) {}

  async ensureCriticalNcr(input: {
    projectId: number;
    sourceType: QualityNcrSourceType;
    sourceId: string;
    sourceReference: string;
    category: string;
    description: string;
    location?: string | null;
    reportedBy?: string | null;
    targetDate?: string | null;
    attachmentUrl?: string | null;
  }) {
    let ncr = await this.ncrRepo.findOne({
      where: { sourceType: input.sourceType, sourceId: input.sourceId },
    });
    if (!ncr) {
      ncr = this.ncrRepo.create({
        projectId: input.projectId,
        type: 'NCR',
        severity: 'Critical',
        category: input.category || 'Quality',
        issueDescription: input.description,
        location: input.location || null,
        reportedDate: new Date().toISOString().slice(0, 10),
        reportedBy: input.reportedBy || 'System',
        assignedTo: null,
        status: 'Open',
        rootCause: null,
        correctiveAction: null,
        targetDate: input.targetDate || null,
        closedDate: null,
        attachmentUrl: input.attachmentUrl || null,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceReference: input.sourceReference,
      });
    } else {
      ncr.category = input.category || ncr.category;
      ncr.issueDescription = input.description;
      ncr.location = input.location || ncr.location;
      ncr.targetDate = input.targetDate || ncr.targetDate;
      ncr.attachmentUrl = input.attachmentUrl || ncr.attachmentUrl;
      ncr.sourceReference = input.sourceReference;
    }
    return this.ncrRepo.save(ncr);
  }

  async markRectified(
    ncrId: number | null | undefined,
    correctiveAction?: string | null,
  ) {
    if (!ncrId) return;
    await this.ncrRepo.update(ncrId, {
      status: 'In Progress',
      correctiveAction: correctiveAction?.trim() || null,
    });
  }

  async markOpen(ncrId: number | null | undefined) {
    if (!ncrId) return;
    await this.ncrRepo.update(ncrId, { status: 'Open', closedDate: null });
  }

  async markClosed(ncrId: number | null | undefined) {
    if (!ncrId) return;
    await this.ncrRepo.update(ncrId, {
      status: 'Closed',
      closedDate: new Date().toISOString().slice(0, 10),
    });
  }

  async deleteLinkedNcr(ncrId: number | null | undefined) {
    if (!ncrId) return;
    await this.ncrRepo.delete(ncrId);
  }
}
