import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { toRelativePath } from '../common/path.utils';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import {
  QualityInspection,
  InspectionStatus,
} from './entities/quality-inspection.entity';
import { QualityMaterialTest } from './entities/quality-material-test.entity';
import { QualityObservationNcr } from './entities/quality-observation-ncr.entity';
import { QualityChecklist } from './entities/quality-checklist.entity';
import {
  QualityItem,
  QualityStatus,
  QualityType,
} from './entities/quality-item.entity';
import { QualityAudit } from './entities/quality-audit.entity';
import { QualityDocument } from './entities/quality-document.entity';
import {
  QualitySnagPhoto,
  SnagPhotoType,
} from './entities/quality-snag-photo.entity';
import { QualityHistory } from './entities/quality-history.entity';
import { QualityWorkflowService } from './quality-workflow.service';
import { EpsNode } from '../eps/eps.entity';
import {
  BATCH_SLIP_FIELD_KEYS,
  BatchSlipFieldKey,
  QualityBatchSlipFieldSynonym,
} from './entities/quality-batch-slip-field-synonym.entity';

@Injectable()
export class QualityService {
  constructor(
    @InjectRepository(QualityInspection)
    private readonly inspectionRepo: Repository<QualityInspection>,
    @InjectRepository(QualityMaterialTest)
    private readonly materialRepo: Repository<QualityMaterialTest>,
    @InjectRepository(QualityObservationNcr)
    private readonly observationNcrRepo: Repository<QualityObservationNcr>,
    @InjectRepository(QualityChecklist)
    private readonly checklistRepo: Repository<QualityChecklist>,
    @InjectRepository(QualityItem)
    private readonly itemRepo: Repository<QualityItem>,
    @InjectRepository(QualityHistory)
    private readonly historyRepo: Repository<QualityHistory>,
    @InjectRepository(QualityAudit)
    private readonly auditRepo: Repository<QualityAudit>,
    @InjectRepository(QualityDocument)
    private readonly documentRepo: Repository<QualityDocument>,
    @InjectRepository(QualitySnagPhoto)
    private readonly photoRepo: Repository<QualitySnagPhoto>,
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
    @InjectRepository(QualityBatchSlipFieldSynonym)
    private readonly batchSlipSynonymRepo: Repository<QualityBatchSlipFieldSynonym>,
    private readonly workflowService: QualityWorkflowService,
  ) {}

  private parseOptionalProjectId(projectId?: number | string | null) {
    if (projectId === undefined || projectId === null || projectId === '') {
      return null;
    }
    const parsed = Number(projectId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException('projectId must be a valid project id.');
    }
    return parsed;
  }

  private validateBatchSlipFieldKey(fieldKey: string): BatchSlipFieldKey {
    if (!BATCH_SLIP_FIELD_KEYS.includes(fieldKey as BatchSlipFieldKey)) {
      throw new BadRequestException('Invalid batch slip field key.');
    }
    return fieldKey as BatchSlipFieldKey;
  }

  private normalizeBatchSlipLabel(label: unknown) {
    const normalized = String(label ?? '').trim().replace(/\s+/g, ' ');
    if (normalized.length < 2 || normalized.length > 60) {
      throw new BadRequestException(
        'Batch slip label must be between 2 and 60 characters.',
      );
    }
    return normalized;
  }

  private async validateProjectExists(projectId: number | null) {
    if (projectId === null) return;
    const exists = await this.epsRepo.exist({ where: { id: projectId } });
    if (!exists) {
      throw new BadRequestException('projectId does not exist.');
    }
  }

  private async assertBatchSlipSynonymUnique(
    projectId: number | null,
    fieldKey: BatchSlipFieldKey,
    label: string,
    excludeId?: number,
  ) {
    const query = this.batchSlipSynonymRepo
      .createQueryBuilder('synonym')
      .where('synonym.fieldKey = :fieldKey', { fieldKey })
      .andWhere('LOWER(synonym.label) = LOWER(:label)', { label });

    if (projectId === null) {
      query.andWhere('synonym.projectId IS NULL');
    } else {
      query.andWhere('synonym.projectId = :projectId', { projectId });
    }

    if (excludeId) {
      query.andWhere('synonym.id <> :excludeId', { excludeId });
    }

    const duplicate = await query.getOne();
    if (duplicate) {
      throw new BadRequestException(
        'This label already exists for the selected field and scope.',
      );
    }
  }

  async getBatchSlipConfig(projectId?: number | string | null) {
    const parsedProjectId = this.parseOptionalProjectId(projectId);
    await this.validateProjectExists(parsedProjectId);

    const query = this.batchSlipSynonymRepo
      .createQueryBuilder('synonym')
      .where('synonym.isActive = true');

    if (parsedProjectId === null) {
      query.andWhere('synonym.projectId IS NULL');
    } else {
      query.andWhere(
        '(synonym.projectId IS NULL OR synonym.projectId = :projectId)',
        { projectId: parsedProjectId },
      );
    }

    const rows = await query
      .orderBy('synonym.fieldKey', 'ASC')
      .addOrderBy('synonym.projectId', 'ASC', 'NULLS FIRST')
      .addOrderBy('synonym.label', 'ASC')
      .getMany();

    const grouped: Record<string, string[]> = {};
    const seenByField = new Map<string, Set<string>>();
    rows.forEach((row) => {
      const seen = seenByField.get(row.fieldKey) ?? new Set<string>();
      const label = row.label.trim();
      const dedupeKey = label.toLowerCase();
      if (seen.has(dedupeKey)) return;

      grouped[row.fieldKey] = grouped[row.fieldKey] ?? [];
      grouped[row.fieldKey].push(label);
      seen.add(dedupeKey);
      seenByField.set(row.fieldKey, seen);
    });

    return grouped;
  }

  async listBatchSlipSynonyms(projectId?: number | string | null) {
    const parsedProjectId = this.parseOptionalProjectId(projectId);
    await this.validateProjectExists(parsedProjectId);

    const query = this.batchSlipSynonymRepo.createQueryBuilder('synonym');
    if (parsedProjectId !== null) {
      query.where(
        '(synonym.projectId IS NULL OR synonym.projectId = :projectId)',
        { projectId: parsedProjectId },
      );
    }

    return query
      .orderBy('synonym.fieldKey', 'ASC')
      .addOrderBy('synonym.projectId', 'ASC', 'NULLS FIRST')
      .addOrderBy('synonym.label', 'ASC')
      .getMany();
  }

  async createBatchSlipSynonym(data: any, createdByUserId?: number | null) {
    const projectId = this.parseOptionalProjectId(data?.projectId);
    const fieldKey = this.validateBatchSlipFieldKey(String(data?.fieldKey ?? ''));
    const label = this.normalizeBatchSlipLabel(data?.label);
    await this.validateProjectExists(projectId);
    await this.assertBatchSlipSynonymUnique(projectId, fieldKey, label);

    const synonym = this.batchSlipSynonymRepo.create({
      projectId,
      fieldKey,
      label,
      isActive: data?.isActive === undefined ? true : Boolean(data.isActive),
      createdByUserId: createdByUserId ?? null,
    });
    return this.batchSlipSynonymRepo.save(synonym);
  }

  async updateBatchSlipSynonym(id: number, data: any) {
    const synonym = await this.batchSlipSynonymRepo.findOne({ where: { id } });
    if (!synonym) {
      throw new NotFoundException('Batch slip synonym not found.');
    }

    const nextLabel =
      data?.label === undefined
        ? synonym.label
        : this.normalizeBatchSlipLabel(data.label);
    await this.assertBatchSlipSynonymUnique(
      synonym.projectId,
      synonym.fieldKey,
      nextLabel,
      synonym.id,
    );

    synonym.label = nextLabel;
    if (data?.isActive !== undefined) {
      synonym.isActive = Boolean(data.isActive);
    }

    return this.batchSlipSynonymRepo.save(synonym);
  }

  async deleteBatchSlipSynonym(id: number) {
    const result = await this.batchSlipSynonymRepo.delete(id);
    if (!result.affected) {
      throw new NotFoundException('Batch slip synonym not found.');
    }
    return { deleted: true };
  }

  async getSummary(projectId: number) {
    // Summary data for the overview dashboard
    const inspections = await this.inspectionRepo.find({
      where: { projectId },
    });
    const materialTests = await this.materialRepo.find({
      where: { projectId },
    });
    const observationsNcr = await this.observationNcrRepo.find({
      where: { projectId },
    });
    const checklists = await this.checklistRepo.find({ where: { projectId } });
    const defaults = await this.itemRepo.find({ where: { projectId } });

    const openNcr = observationsNcr.filter(
      (o) => o.type === 'NCR' && o.status === 'Open',
    ).length;
    const openObservations = observationsNcr.filter(
      (o) => o.type === 'Observation' && o.status === 'Open',
    ).length;
    const pendingInspections = inspections.filter(
      (i) => i.status === InspectionStatus.PENDING,
    ).length;
    const failedTests = materialTests.filter((t) => t.result === 'Fail').length;

    // Calculate a basic quality score (percent of passed inspections)
    const totalClosedInspections = inspections.filter((i) =>
      [InspectionStatus.APPROVED, InspectionStatus.REJECTED].includes(i.status),
    ).length;
    const passedInspections = inspections.filter(
      (i) => i.status === InspectionStatus.APPROVED,
    ).length;
    const qualityScore =
      totalClosedInspections > 0
        ? (passedInspections / totalClosedInspections) * 100
        : 100;

    return {
      openNcr,
      openObservations,
      pendingInspections,
      failedTests,
      qualityScore: Math.round(qualityScore),
      snagsCount: defaults.filter(
        (s) => s.type === QualityType.SNAG && s.status !== QualityStatus.CLOSED,
      ).length,
      totalInspections: inspections.length,
      checklistsCount: checklists.length,
    };
  }

  // Inspections (Legacy)
  async getInspections(projectId: number) {
    return this.inspectionRepo.find({
      where: { projectId },
      order: { requestDate: 'DESC' },
    });
  }
  async createInspection(data: any) {
    const item = this.inspectionRepo.create(data);
    return this.inspectionRepo.save(item);
  }
  async updateInspection(id: number, data: any) {
    await this.inspectionRepo.update(id, data);
    return this.inspectionRepo.findOne({ where: { id } });
  }
  async deleteInspection(id: number) {
    return this.inspectionRepo.delete(id);
  }

  // Material Tests
  async getMaterialTests(projectId: number) {
    return this.materialRepo.find({
      where: { projectId },
      order: { testDate: 'DESC' },
    });
  }
  async createMaterialTest(data: any) {
    const item = this.materialRepo.create(data);
    return this.materialRepo.save(item);
  }
  async updateMaterialTest(id: number, data: any) {
    await this.materialRepo.update(id, data);
    return this.materialRepo.findOne({ where: { id } });
  }
  async deleteMaterialTest(id: number) {
    return this.materialRepo.delete(id);
  }

  // Observations & NCR (Legacy - potentially merge later)
  async getObservationsNcr(projectId: number) {
    return this.observationNcrRepo.find({
      where: { projectId },
      order: { reportedDate: 'DESC' },
    });
  }
  async createObservationNcr(data: any) {
    const item = this.observationNcrRepo.create(data);
    return this.observationNcrRepo.save(item);
  }
  async updateObservationNcr(id: number, data: any) {
    await this.observationNcrRepo.update(id, data);
    return this.observationNcrRepo.findOne({ where: { id } });
  }
  async deleteObservationNcr(id: number) {
    return this.observationNcrRepo.delete(id);
  }

  // Checklists
  async getChecklists(projectId: number) {
    return this.checklistRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }
  async createChecklist(data: any) {
    const item = this.checklistRepo.create(data);
    return this.checklistRepo.save(item);
  }
  async updateChecklist(id: number, data: any) {
    await this.checklistRepo.update(id, data);
    return this.checklistRepo.findOne({ where: { id } });
  }
  async deleteChecklist(id: number) {
    return this.checklistRepo.delete(id);
  }

  // UNIFIED QUALITY ITEMS (Snags & Observations)
  async getSnags(
    projectId: number,
    paging?: { limit?: number; offset?: number; q?: string; status?: string },
  ) {
    const query = this.itemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.photos', 'photos')
      .where('item.projectId = :projectId', { projectId })
      .andWhere('item.type = :type', { type: QualityType.SNAG });
    if (paging?.status && paging.status !== 'ALL') {
      query.andWhere('item.status = :status', { status: paging.status });
    }
    const q = paging?.q?.trim().toLowerCase();
    if (q) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where(
            `LOWER(COALESCE(item.description, '') || ' ' || COALESCE(item.locationName, '') || ' ' || COALESCE(item.trade, '') || ' ' || COALESCE(item.priority::text, '') || ' ' || COALESCE(item.status::text, '')) LIKE :q`,
            { q: `%${q}%` },
          );
        }),
      );
    }
    query.orderBy('item.createdAt', 'DESC');
    const hasPaging =
      Number.isFinite(Number(paging?.limit)) ||
      Number.isFinite(Number(paging?.offset));
    const limit = Math.min(100, Math.max(1, Number(paging?.limit) || 25));
    const offset = Math.max(0, Number(paging?.offset) || 0);
    const [items, total] = hasPaging
      ? await query.skip(offset).take(limit).getManyAndCount()
      : [await query.getMany(), undefined];
    // Map for frontend compatibility
    const data = items.map((item) => ({
      ...item,
      defectDescription: item.description,
    }));
    return hasPaging
      ? {
          data,
          total: total || 0,
          limit,
          offset,
          hasMore: offset + data.length < (total || 0),
        }
      : data;
  }

  async createSnag(data: any, file?: any) {
    // 1. Create with defaults
    const newItem = this.itemRepo.create({
      ...data,
      type: QualityType.SNAG,
      status: QualityStatus.OPEN,
      pendingActionRole: 'SITE_ENGINEER', // Default
      description: data.defectDescription || data.description, // Handle mismatch
    }) as unknown as QualityItem;

    // Map DTO fields to new Entity fields if mismatch exists
    if (data.defectDescription) newItem.description = data.defectDescription;

    const saved = await this.itemRepo.save(newItem);

    // 2. Add History
    await this.historyRepo.save({
      qualityItemId: saved.id,
      fromStatus: 'VOID',
      toStatus: QualityStatus.OPEN,
      actionBy: 'User', // TODO: Context
      remarks: 'Created Snag',
    });

    // 3. Save Photo
    if (file) {
      await this.photoRepo.save({
        snagId: saved.id,
        url: toRelativePath(`/uploads/${file.filename}`),
        type: SnagPhotoType.INITIAL,
        uploadedBy: 'User',
      });
    }

    return this.itemRepo.findOne({
      where: { id: saved.id },
      relations: ['photos'],
    });
  }

  async updateSnag(id: number, data: any, file?: any) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Quality Item not found');

    // 1. Validate Transition
    if (data.status && data.status !== item.status) {
      this.workflowService.validateTransition(
        item,
        data.status as QualityStatus,
      );

      // 2. Capture History
      await this.historyRepo.save({
        qualityItemId: item.id,
        fromStatus: item.status,
        toStatus: data.status,
        actionBy: 'User',
        remarks: data.remarks || 'Status update',
      });

      // 3. Update Status & Pending Role
      item.status = data.status;
      item.pendingActionRole = this.workflowService.getPendingActionRole(
        data.status,
      );

      // 4. Update Timestamps
      if (item.status === QualityStatus.RECTIFIED)
        item.rectifiedAt = new Date();
      if (item.status === QualityStatus.VERIFIED) item.verifiedAt = new Date();
      if (item.status === QualityStatus.CLOSED) item.closedAt = new Date();
    }

    // 5. Update other fields
    if (data.defectDescription) item.description = data.defectDescription;
    if (data.priority) item.priority = data.priority;
    if (data.assignedTo) item.assignedTo = data.assignedTo;

    // 6. Handle File Upload (Evidence)
    if (file) {
      let type = SnagPhotoType.INITIAL;
      if (item.status === QualityStatus.RECTIFIED)
        type = SnagPhotoType.RECTIFIED;
      else if (item.status === QualityStatus.VERIFIED)
        type = SnagPhotoType.VERIFIED;

      await this.photoRepo.save({
        snagId: id,
        url: toRelativePath(`/uploads/${file.filename}`),
        type,
        uploadedBy: 'User',
      });
    }

    return this.itemRepo.save(item);
  }

  async deleteSnag(id: number) {
    return this.itemRepo.delete(id);
  }

  // Audits
  async getAudits(projectId: number) {
    return this.auditRepo.find({
      where: { projectId },
      order: { auditDate: 'DESC' },
    });
  }
  async createAudit(data: any) {
    const item = this.auditRepo.create(data);
    return this.auditRepo.save(item);
  }
  async updateAudit(id: number, data: any) {
    await this.auditRepo.update(id, data);
    return this.auditRepo.findOne({ where: { id } });
  }
  async deleteAudit(id: number) {
    return this.auditRepo.delete(id);
  }

  // Documents
  async getDocuments(projectId: number) {
    return this.documentRepo.find({
      where: { projectId },
      order: { submissionDate: 'DESC' },
    });
  }
  async createDocument(data: any) {
    const item = this.documentRepo.create(data);
    return this.documentRepo.save(item);
  }
  async updateDocument(id: number, data: any) {
    await this.documentRepo.update(id, data);
    return this.documentRepo.findOne({ where: { id } });
  }
  async deleteDocument(id: number) {
    return this.documentRepo.delete(id);
  }
}
