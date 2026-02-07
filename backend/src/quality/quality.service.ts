import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QualityInspection } from './entities/quality-inspection.entity';
import { QualityMaterialTest } from './entities/quality-material-test.entity';
import { QualityObservationNcr } from './entities/quality-observation-ncr.entity';
import { QualityChecklist } from './entities/quality-checklist.entity';
import { QualitySnagList } from './entities/quality-snag-list.entity';
import { QualityAudit } from './entities/quality-audit.entity';
import { QualityDocument } from './entities/quality-document.entity';

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
    @InjectRepository(QualitySnagList)
    private readonly snagRepo: Repository<QualitySnagList>,
    @InjectRepository(QualityAudit)
    private readonly auditRepo: Repository<QualityAudit>,
    @InjectRepository(QualityDocument)
    private readonly documentRepo: Repository<QualityDocument>,
  ) {}

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
    const snags = await this.snagRepo.find({ where: { projectId } });

    const openNcr = observationsNcr.filter(
      (o) => o.type === 'NCR' && o.status === 'Open',
    ).length;
    const openObservations = observationsNcr.filter(
      (o) => o.type === 'Observation' && o.status === 'Open',
    ).length;
    const pendingInspections = inspections.filter(
      (i) => i.status === 'Pending' || i.status === 'In Progress',
    ).length;
    const failedTests = materialTests.filter((t) => t.result === 'Fail').length;

    // Calculate a basic quality score (percent of passed inspections)
    const totalClosedInspections = inspections.filter((i) =>
      ['Pass', 'Fail'].includes(i.status),
    ).length;
    const passedInspections = inspections.filter(
      (i) => i.status === 'Pass',
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
      snagsCount: snags.filter((s) => s.status !== 'Closed').length,
      totalInspections: inspections.length,
      checklistsCount: checklists.length,
    };
  }

  // Inspections
  async getInspections(projectId: number) {
    return this.inspectionRepo.find({
      where: { projectId },
      order: { scheduledDate: 'DESC' },
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

  // Observations & NCR
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

  // Snag List
  async getSnags(projectId: number) {
    return this.snagRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }
  async createSnag(data: any) {
    const item = this.snagRepo.create(data);
    return this.snagRepo.save(item);
  }
  async updateSnag(id: number, data: any) {
    await this.snagRepo.update(id, data);
    return this.snagRepo.findOne({ where: { id } });
  }
  async deleteSnag(id: number) {
    return this.snagRepo.delete(id);
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
