import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { toRelativePath } from '../common/path.utils';
import { ApprovalRuntimeService } from '../common/approval-runtime.service';
import { ReleaseStrategyService } from '../planning/release-strategy.service';
import {
  CreateMaterialItpTemplateDto,
  CreateMaterialReceiptDto,
  CreateMaterialTestResultDto,
} from './dto/material-itp.dto';
import {
  MATERIAL_ITP_STATUS,
  QualityMaterialItpTemplate,
} from './entities/quality-material-itp-template.entity';
import { QualityMaterialItpCheckpoint } from './entities/quality-material-itp-checkpoint.entity';
import { QualityMaterialReceipt } from './entities/quality-material-receipt.entity';
import { QualityMaterialTestObligation } from './entities/quality-material-test-obligation.entity';
import { QualityMaterialTestResult } from './entities/quality-material-test-result.entity';
import { QualityMaterialEvidenceFile } from './entities/quality-material-evidence-file.entity';
import { QualityMaterialApprovalRun } from './entities/quality-material-approval-run.entity';
import { QualityMaterialApprovalStep } from './entities/quality-material-approval-step.entity';
import {
  QualityCubeTestRegister,
  QualityCubeTestStatus,
} from './entities/quality-cube-test-register.entity';
import { QualityConcreteGrade } from './entities/quality-concrete-grade.entity';
import { User } from '../users/user.entity';

const ITP_DOCUMENT_TYPE = 'MATERIAL_ITP_TEMPLATE';
const RESULT_DOCUMENT_TYPE = 'MATERIAL_TEST_RESULT';
const ITP_PROCESS_CODE = 'MATERIAL_ITP_APPROVAL';
const RESULT_PROCESS_CODE = 'MATERIAL_TEST_RESULT_APPROVAL';

@Injectable()
export class MaterialItpService {
  constructor(
    @InjectRepository(QualityMaterialItpTemplate)
    private readonly templateRepo: Repository<QualityMaterialItpTemplate>,
    @InjectRepository(QualityMaterialItpCheckpoint)
    private readonly checkpointRepo: Repository<QualityMaterialItpCheckpoint>,
    @InjectRepository(QualityMaterialReceipt)
    private readonly receiptRepo: Repository<QualityMaterialReceipt>,
    @InjectRepository(QualityMaterialTestObligation)
    private readonly obligationRepo: Repository<QualityMaterialTestObligation>,
    @InjectRepository(QualityMaterialTestResult)
    private readonly resultRepo: Repository<QualityMaterialTestResult>,
    @InjectRepository(QualityMaterialEvidenceFile)
    private readonly evidenceRepo: Repository<QualityMaterialEvidenceFile>,
    @InjectRepository(QualityMaterialApprovalRun)
    private readonly runRepo: Repository<QualityMaterialApprovalRun>,
    @InjectRepository(QualityMaterialApprovalStep)
    private readonly stepRepo: Repository<QualityMaterialApprovalStep>,
    @InjectRepository(QualityCubeTestRegister)
    private readonly cubeRegisterRepo: Repository<QualityCubeTestRegister>,
    @InjectRepository(QualityConcreteGrade)
    private readonly concreteGradeRepo: Repository<QualityConcreteGrade>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly releaseStrategyService: ReleaseStrategyService,
    private readonly approvalRuntimeService: ApprovalRuntimeService,
  ) {}

  async listTemplates(projectId: number) {
    const templates = await this.templateRepo.find({
      where: { projectId },
      relations: ['checkpoints'],
      order: { updatedAt: 'DESC', checkpoints: { sequence: 'ASC' } },
    });
    return this.attachApprovalRuns(templates, ITP_DOCUMENT_TYPE);
  }

  async getTemplate(id: number) {
    const template = await this.templateRepo.findOne({
      where: { id },
      relations: ['checkpoints'],
      order: { checkpoints: { sequence: 'ASC' } },
    });
    if (!template) throw new NotFoundException('Material ITP template not found');
    return this.attachApprovalRun(template, ITP_DOCUMENT_TYPE);
  }

  async createTemplate(projectId: number, dto: CreateMaterialItpTemplateDto, userId?: number) {
    this.assertTemplatePayload(dto);
    const template = this.templateRepo.create({
      projectId,
      materialName: dto.materialName.trim(),
      materialCode: dto.materialCode?.trim() || null,
      itpNo: dto.itpNo.trim(),
      revNo: dto.revNo?.trim() || '01',
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      standardRefs: dto.standardRefs || null,
      isGlobal: Boolean(dto.isGlobal),
      createdById: userId || null,
      checkpoints: this.buildCheckpointEntities(dto.checkpoints || []),
    });
    const saved = await this.templateRepo.save(template);
    return this.getTemplate(saved.id);
  }

  async updateTemplate(id: number, dto: CreateMaterialItpTemplateDto) {
    const template = await this.getTemplate(id);
    if (
      [MATERIAL_ITP_STATUS.ACTIVE, MATERIAL_ITP_STATUS.APPROVAL_IN_PROGRESS].includes(
        template.status as any,
      )
    ) {
      throw new BadRequestException('Active or approval-in-progress ITP cannot be edited');
    }
    this.assertTemplatePayload(dto);
    Object.assign(template, {
      materialName: dto.materialName.trim(),
      materialCode: dto.materialCode?.trim() || null,
      itpNo: dto.itpNo.trim(),
      revNo: dto.revNo?.trim() || template.revNo || '01',
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      standardRefs: dto.standardRefs || null,
      isGlobal: Boolean(dto.isGlobal),
      checkpoints: this.buildCheckpointEntities(dto.checkpoints || []),
    });
    await this.checkpointRepo.delete({ templateId: id });
    const saved = await this.templateRepo.save(template);
    return this.getTemplate(saved.id);
  }

  async copyTemplate(id: number, targetProjectId: number, userId?: number) {
    const source = await this.getTemplate(id);
    const copied = this.templateRepo.create({
      projectId: targetProjectId,
      materialName: source.materialName,
      materialCode: source.materialCode,
      itpNo: source.itpNo,
      revNo: source.revNo,
      title: source.title,
      description: source.description,
      standardRefs: source.standardRefs,
      status: MATERIAL_ITP_STATUS.DRAFT,
      approvalStatus: 'NOT_SUBMITTED',
      sourceTemplateId: source.id,
      copiedFromProjectId: source.projectId,
      createdById: userId || null,
      checkpoints: (source.checkpoints || []).map((checkpoint) =>
        this.checkpointRepo.create({
          ...checkpoint,
          id: undefined,
          templateId: undefined as any,
          template: undefined as any,
        }),
      ),
    });
    const saved = await this.templateRepo.save(copied);
    return this.getTemplate(saved.id);
  }

  async submitItpApproval(id: number, userId: number) {
    const template = await this.getTemplate(id);
    if (!template.checkpoints?.length) {
      throw new BadRequestException('At least one checkpoint is required before approval');
    }
    const run = await this.startApprovalRun({
      projectId: template.projectId,
      documentType: ITP_DOCUMENT_TYPE,
      documentId: template.id,
      processCode: ITP_PROCESS_CODE,
      initiatorUserId: userId,
      context: {
        materialName: template.materialName,
        materialCode: template.materialCode,
        itpNo: template.itpNo,
        revNo: template.revNo,
      },
    });
    template.status = MATERIAL_ITP_STATUS.APPROVAL_IN_PROGRESS;
    template.approvalStatus = 'PENDING';
    template.approvalRunId = run.id;
    template.approvalStrategyId = run.releaseStrategyId;
    template.approvalStrategyVersion = run.releaseStrategyVersion;
    template.submittedById = userId;
    template.submittedAt = new Date();
    await this.templateRepo.save(template);
    return this.getTemplate(id);
  }

  async activateTemplate(id: number, userId?: number) {
    const template = await this.getTemplate(id);
    if (template.approvalStatus !== 'APPROVED') {
      throw new BadRequestException('Only approved ITP templates can be activated');
    }
    await this.templateRepo.update(
      {
        projectId: template.projectId,
        materialName: template.materialName,
        status: MATERIAL_ITP_STATUS.ACTIVE,
      },
      { status: MATERIAL_ITP_STATUS.SUPERSEDED, effectiveTo: this.today() },
    );
    template.status = MATERIAL_ITP_STATUS.ACTIVE;
    template.effectiveFrom = this.today();
    template.effectiveTo = null;
    template.approvedById = userId || template.approvedById;
    template.approvedAt = template.approvedAt || new Date();
    return this.templateRepo.save(template);
  }

  listReceipts(projectId: number) {
    return this.receiptRepo.find({
      where: { projectId },
      relations: ['itpTemplate', 'obligations', 'obligations.checkpoint'],
      order: { receivedDate: 'DESC', id: 'DESC' },
    });
  }

  async listCubeTestRegister(projectId: number) {
    const rows = await this.cubeRegisterRepo.find({
      where: { projectId },
      order: { dueDate: 'ASC', cubeId: 'ASC' },
    });
    return rows.map((row) => this.withLiveCubeStatus(row));
  }

  listConcreteGrades(projectId: number) {
    return this.concreteGradeRepo.find({
      where: { projectId },
      order: { grade: 'ASC' },
    });
  }

  async createConcreteGrade(projectId: number, dto: Partial<QualityConcreteGrade>) {
    const grade = dto.grade?.trim();
    if (!grade) throw new BadRequestException('Concrete grade is required');
    const row = this.concreteGradeRepo.create({
      projectId,
      grade,
      targetMeanStrengthMpa: this.toNullableNumberText(dto.targetMeanStrengthMpa),
      characteristicStrengthMpa: this.toNullableNumberText(
        dto.characteristicStrengthMpa,
      ),
      mixRatio: dto.mixRatio?.trim() || null,
      slumpRangeMm: dto.slumpRangeMm?.trim() || null,
      waterCementRatio: this.toNullableNumberText(dto.waterCementRatio),
      cementContentKgM3: this.toNullableNumberText(dto.cementContentKgM3),
      remarks: dto.remarks?.trim() || null,
      propertyDetails: dto.propertyDetails || null,
      isActive: dto.isActive ?? true,
    });
    return this.concreteGradeRepo.save(row);
  }

  async updateConcreteGrade(id: number, dto: Partial<QualityConcreteGrade>) {
    const row = await this.concreteGradeRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Concrete grade not found');
    Object.assign(row, {
      grade: dto.grade?.trim() || row.grade,
      targetMeanStrengthMpa:
        dto.targetMeanStrengthMpa === undefined
          ? row.targetMeanStrengthMpa
          : this.toNullableNumberText(dto.targetMeanStrengthMpa),
      characteristicStrengthMpa:
        dto.characteristicStrengthMpa === undefined
          ? row.characteristicStrengthMpa
          : this.toNullableNumberText(dto.characteristicStrengthMpa),
      mixRatio: dto.mixRatio === undefined ? row.mixRatio : dto.mixRatio?.trim() || null,
      slumpRangeMm:
        dto.slumpRangeMm === undefined ? row.slumpRangeMm : dto.slumpRangeMm?.trim() || null,
      waterCementRatio:
        dto.waterCementRatio === undefined
          ? row.waterCementRatio
          : this.toNullableNumberText(dto.waterCementRatio),
      cementContentKgM3:
        dto.cementContentKgM3 === undefined
          ? row.cementContentKgM3
          : this.toNullableNumberText(dto.cementContentKgM3),
      remarks: dto.remarks === undefined ? row.remarks : dto.remarks?.trim() || null,
      propertyDetails:
        dto.propertyDetails === undefined ? row.propertyDetails : dto.propertyDetails || null,
      isActive: dto.isActive ?? row.isActive,
    });
    return this.concreteGradeRepo.save(row);
  }

  async deleteConcreteGrade(id: number) {
    await this.concreteGradeRepo.delete(id);
    return { success: true };
  }

  async createCubeTestRegister(
    projectId: number,
    dto: Partial<QualityCubeTestRegister>,
  ) {
    const castDate = dto.castDate || this.today();
    const testAge = dto.testAge || ('7_DAY' as any);
    const dueDays = testAge === '28_DAY' ? 28 : 7;
    const cubeId = dto.cubeId?.trim() || (await this.getNextCubeId(projectId));
    const row = this.cubeRegisterRepo.create({
      ...dto,
      projectId,
      cubeId,
      testAge,
      castDate,
      dueDate: dto.dueDate || this.addDays(castDate, dueDays),
      status: dto.status || QualityCubeTestStatus.PENDING,
      specimenSize: dto.specimenSize || '150 x 150 x 150 mm',
    });
    const saved = await this.cubeRegisterRepo.save(row);
    return this.withLiveCubeStatus(saved);
  }

  async updateCubeTestRegister(
    id: number,
    dto: Partial<QualityCubeTestRegister>,
    userId?: number,
  ) {
    const row = await this.cubeRegisterRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Cube test register row not found');
    const actorName = await this.getUserDisplayName(userId);
    const isApproval = dto.status === QualityCubeTestStatus.APPROVED;

    const loadKn =
      dto.loadKn === undefined || dto.loadKn === null || dto.loadKn === ''
        ? row.loadKn
        : String(dto.loadKn);
    const specimenSize = dto.specimenSize || row.specimenSize || '150 x 150 x 150 mm';
    const loadedAreaMm2 = this.getCubeLoadedAreaMm2(specimenSize);
    const compressiveStrengthMpa =
      loadKn && loadedAreaMm2
        ? ((Number(loadKn) * 1000) / loadedAreaMm2).toFixed(3)
        : dto.compressiveStrengthMpa === undefined ||
            dto.compressiveStrengthMpa === null
          ? row.compressiveStrengthMpa
          : String(dto.compressiveStrengthMpa);
    const requiredStrengthMpa =
      dto.requiredStrengthMpa === undefined || dto.requiredStrengthMpa === null
        ? row.requiredStrengthMpa
        : String(dto.requiredStrengthMpa);
    const characteristicStrengthMpa = this.resolveCharacteristicStrengthMpa(
      row,
      dto,
    );
    const targetMeanStrengthMpa =
      requiredStrengthMpa ||
      this.resolveCalculationNumber(row.calculationDetails, 'targetMeanStrengthMpa') ||
      characteristicStrengthMpa;
    const evaluation = this.evaluateCubeStrength({
      age: dto.testAge || row.testAge,
      compressiveStrengthMpa,
      characteristicStrengthMpa,
      targetMeanStrengthMpa,
    });

    Object.assign(row, {
      specimenSize,
      loadKn,
      compressiveStrengthMpa,
      averageStrengthMpa:
        dto.averageStrengthMpa === undefined || dto.averageStrengthMpa === null
          ? row.averageStrengthMpa
          : String(dto.averageStrengthMpa),
      requiredStrengthMpa,
      testedByName: isApproval
        ? row.testedByName || dto.testedByName || actorName
        : actorName || dto.testedByName || row.testedByName,
      testedDate: dto.testedDate ?? row.testedDate ?? this.today(),
      remarks: dto.remarks ?? row.remarks,
      calculationDetails: {
        ...(row.calculationDetails || {}),
        loadedAreaMm2,
        loadKn,
        formula:
          'Compressive strength (MPa) = failure load (kN) x 1000 / loaded area (mm2)',
        compressiveStrengthMpa,
        characteristicStrengthMpa,
        targetMeanStrengthMpa,
        requiredStrengthMpa,
        strengthStatus: evaluation.status,
        strengthMessage: evaluation.message,
      },
      status: isApproval ? QualityCubeTestStatus.APPROVED : evaluation.status,
      approvedAt:
        isApproval
          ? new Date()
          : row.approvedAt,
      approvedByUserId:
        isApproval
          ? userId ?? row.approvedByUserId
          : row.approvedByUserId,
      witnessedByName: isApproval
        ? actorName || row.witnessedByName
        : row.witnessedByName,
    });

    const saved = await this.cubeRegisterRepo.save(row);
    return this.withLiveCubeStatus(saved);
  }

  async deleteCubeTestRegister(id: number) {
    const row = await this.cubeRegisterRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Cube test register row not found');
    await this.cubeRegisterRepo.delete(id);
    return { success: true };
  }

  private withLiveCubeStatus(row: QualityCubeTestRegister) {
    if (
      [
        QualityCubeTestStatus.TESTED,
        QualityCubeTestStatus.PASSED,
        QualityCubeTestStatus.NEEDS_ATTENTION,
        QualityCubeTestStatus.APPROVED,
        QualityCubeTestStatus.FAILED,
      ].includes(row.status)
    ) {
      return row;
    }
    const today = this.today();
    if (row.dueDate === today) {
      return { ...row, status: QualityCubeTestStatus.DUE_TODAY };
    }
    if (row.dueDate < today) {
      return { ...row, status: QualityCubeTestStatus.OVERDUE };
    }
    return row;
  }

  private getCubeLoadedAreaMm2(specimenSize?: string | null) {
    const size = String(specimenSize || '').match(/(\d{2,3})/);
    const sideMm = size ? Number(size[1]) : 150;
    return sideMm * sideMm;
  }

  private toNullableNumberText(value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(3) : null;
  }

  private resolveCalculationNumber(
    calculationDetails: Record<string, unknown> | null | undefined,
    key: string,
  ) {
    const numeric = Number(calculationDetails?.[key]);
    return Number.isFinite(numeric) ? numeric.toFixed(3) : null;
  }

  private resolveCharacteristicStrengthMpa(
    row: QualityCubeTestRegister,
    dto: Partial<QualityCubeTestRegister>,
  ) {
    const configured = this.resolveCalculationNumber(
      row.calculationDetails,
      'characteristicStrengthMpa',
    );
    if (configured) return configured;
    const required = Number(dto.requiredStrengthMpa ?? row.requiredStrengthMpa);
    const inferred = String(row.mixIdOrGrade || '').match(/M\s?(\d{2,3})/i);
    if (inferred) return Number(inferred[1]).toFixed(3);
    return Number.isFinite(required) ? required.toFixed(3) : null;
  }

  private evaluateCubeStrength(input: {
    age: QualityCubeTestRegister['testAge'];
    compressiveStrengthMpa: string | null;
    characteristicStrengthMpa: string | null;
    targetMeanStrengthMpa: string | null;
  }) {
    const strength = Number(input.compressiveStrengthMpa);
    const characteristic = Number(input.characteristicStrengthMpa);
    const target = Number(input.targetMeanStrengthMpa);
    if (!Number.isFinite(strength)) {
      return {
        status: QualityCubeTestStatus.TESTED,
        message: 'Load/MPa pending for evaluation',
      };
    }
    if (!Number.isFinite(characteristic)) {
      return {
        status: QualityCubeTestStatus.TESTED,
        message: 'Characteristic strength unavailable',
      };
    }
    if (input.age === '7_DAY') {
      const threshold = characteristic * 0.65;
      return strength >= threshold
        ? {
            status: QualityCubeTestStatus.PASSED,
            message: `7-day strength is at least 65% of characteristic MPa (${threshold.toFixed(3)}).`,
          }
        : {
            status: QualityCubeTestStatus.NEEDS_ATTENTION,
            message: `7-day strength is below 65% of characteristic MPa (${threshold.toFixed(3)}).`,
          };
    }

    if (strength < characteristic) {
      return {
        status: QualityCubeTestStatus.FAILED,
        message: '28-day strength is below characteristic MPa.',
      };
    }
    if (Number.isFinite(target) && strength < target) {
      return {
        status: QualityCubeTestStatus.NEEDS_ATTENTION,
        message: '28-day strength is between characteristic MPa and target mean strength.',
      };
    }
    return {
      status: QualityCubeTestStatus.PASSED,
      message: '28-day strength meets or exceeds target mean strength.',
    };
  }

  private async getUserDisplayName(userId?: number) {
    if (!userId) return null;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return user?.username || user?.displayName || null;
  }

  private parseCubeSerial(cubeId?: string | null) {
    const match = String(cubeId || '').match(/C(\d{4,5})$/i);
    return match ? Number(match[1]) : 0;
  }

  private async getNextCubeId(projectId: number) {
    const rows = await this.cubeRegisterRepo.find({
      where: { projectId },
      select: ['cubeId'],
    });
    const maxSerial = rows.reduce(
      (max, row) => Math.max(max, this.parseCubeSerial(row.cubeId)),
      0,
    );
    return `C${String(maxSerial + 1).padStart(5, '0')}`;
  }

  async createReceipt(projectId: number, dto: CreateMaterialReceiptDto) {
    const template = dto.itpTemplateId
      ? await this.getTemplate(dto.itpTemplateId)
      : await this.findActiveTemplate(projectId, dto.materialName, dto.materialCode);
    if (template.projectId !== projectId) {
      throw new BadRequestException('Selected ITP template belongs to another project');
    }
    if (template.status !== MATERIAL_ITP_STATUS.ACTIVE) {
      throw new BadRequestException('Material receipt requires an active approved ITP');
    }
    const receipt = await this.receiptRepo.save(
      this.receiptRepo.create({
        projectId,
        itpTemplateId: template.id,
        materialName: dto.materialName.trim(),
        materialCode: dto.materialCode?.trim() || template.materialCode,
        brand: dto.brand?.trim() || null,
        grade: dto.grade?.trim() || null,
        supplier: dto.supplier?.trim() || null,
        manufacturer: dto.manufacturer?.trim() || null,
        batchNumber: dto.batchNumber?.trim(),
        lotNumber: dto.lotNumber?.trim() || null,
        challanNumber: dto.challanNumber?.trim() || null,
        quantity: dto.quantity === undefined || dto.quantity === null ? null : String(dto.quantity),
        uom: dto.uom?.trim() || null,
        receivedDate: dto.receivedDate || this.today(),
        manufactureDate: dto.manufactureDate || null,
        packingWeekNo: dto.packingWeekNo?.trim() || null,
      }),
    );
    await this.generateObligations(receipt.id);
    return this.receiptRepo.findOne({
      where: { id: receipt.id },
      relations: ['itpTemplate', 'obligations', 'obligations.checkpoint'],
    });
  }

  async generateObligations(receiptId: number) {
    const receipt = await this.receiptRepo.findOne({
      where: { id: receiptId },
      relations: ['itpTemplate', 'itpTemplate.checkpoints'],
    });
    if (!receipt) throw new NotFoundException('Material receipt not found');
    const existing = await this.obligationRepo.find({ where: { receiptId } });
    const existingCheckpointIds = new Set(existing.map((item) => item.checkpointId));
    const checkpoints = receipt.itpTemplate.checkpoints || [];
    const created: QualityMaterialTestObligation[] = [];
    for (const checkpoint of checkpoints) {
      if (existingCheckpointIds.has(checkpoint.id)) continue;
      const dueDate = this.addHoursToDate(receipt.receivedDate, checkpoint.dueOffsetHours || 0);
      const warningDate = checkpoint.expiryWindowDays
        ? this.addDays(dueDate, -checkpoint.expiryWindowDays)
        : null;
      created.push(
        this.obligationRepo.create({
          projectId: receipt.projectId,
          receiptId: receipt.id,
          templateId: receipt.itpTemplateId,
          checkpointId: checkpoint.id,
          materialName: receipt.materialName,
          brand: receipt.brand,
          grade: receipt.grade,
          dueDate,
          warningDate,
          status: this.isBeforeToday(dueDate) ? 'OVERDUE' : 'PENDING',
          priority: checkpoint.isMandatory ? 'HIGH' : 'MEDIUM',
          reason: checkpoint.characteristic,
        }),
      );
    }
    if (created.length) await this.obligationRepo.save(created);
    return this.listObligations(receipt.projectId);
  }

  async listObligations(projectId: number) {
    await this.refreshObligationStatuses(projectId);
    return this.obligationRepo.find({
      where: { projectId },
      relations: ['receipt', 'template', 'checkpoint'],
      order: { dueDate: 'ASC', id: 'DESC' },
    });
  }

  async listResults(projectId: number) {
    const results = await this.resultRepo.find({
      where: { projectId },
      relations: ['obligation', 'receipt', 'template', 'checkpoint'],
      order: { testDate: 'DESC', id: 'DESC' },
    });
    return this.attachApprovalRuns(results, RESULT_DOCUMENT_TYPE);
  }

  async createResult(obligationId: number, dto: CreateMaterialTestResultDto, userId?: number) {
    const obligation = await this.obligationRepo.findOne({
      where: { id: obligationId },
      relations: ['checkpoint', 'template', 'receipt'],
    });
    if (!obligation) throw new NotFoundException('Material test obligation not found');
    const result = await this.resultRepo.save(
      this.resultRepo.create({
        projectId: obligation.projectId,
        obligationId,
        receiptId: obligation.receiptId,
        templateId: obligation.templateId,
        checkpointId: obligation.checkpointId,
        testDate: dto.testDate || this.today(),
        testedById: userId || null,
        testedByName: dto.testedByName?.trim() || null,
        labType: dto.labType || 'SITE',
        documentType: dto.documentType || null,
        primaryDocumentUrl: dto.primaryDocumentUrl || null,
        numericValue: dto.numericValue === undefined || dto.numericValue === null ? null : String(dto.numericValue),
        textValue: dto.textValue || null,
        observedGrade: dto.observedGrade || null,
        result: dto.result || this.evaluateResult(dto, obligation.checkpoint),
        reviewStatus: 'DRAFT',
        remarks: dto.remarks || null,
        criteriaSnapshot: obligation.checkpoint.acceptanceCriteria || null,
        itpSnapshot: {
          templateId: obligation.templateId,
          itpNo: obligation.template.itpNo,
          revNo: obligation.template.revNo,
          checkpointId: obligation.checkpointId,
          characteristic: obligation.checkpoint.characteristic,
        },
      }),
    );
    obligation.lastResultId = result.id;
    obligation.status = 'RESULT_LOGGED';
    await this.obligationRepo.save(obligation);
    return this.resultRepo.findOne({
      where: { id: result.id },
      relations: ['obligation', 'receipt', 'template', 'checkpoint'],
    });
  }

  async submitResultApproval(resultId: number, userId: number) {
    const result = await this.resultRepo.findOne({
      where: { id: resultId },
      relations: ['checkpoint', 'template', 'obligation'],
    });
    if (!result) throw new NotFoundException('Material test result not found');
    await this.assertResultEvidenceComplete(result);
    const run = await this.startApprovalRun({
      projectId: result.projectId,
      documentType: RESULT_DOCUMENT_TYPE,
      documentId: result.id,
      processCode: RESULT_PROCESS_CODE,
      initiatorUserId: userId,
      context: {
        materialName: result.obligation.materialName,
        checkpoint: result.checkpoint.characteristic,
        labType: result.labType,
        result: result.result,
      },
    });
    result.reviewStatus = 'APPROVAL_IN_PROGRESS';
    result.approvalRunId = run.id;
    result.approvalStrategyId = run.releaseStrategyId;
    result.approvalStrategyVersion = run.releaseStrategyVersion;
    result.submittedById = userId;
    result.submittedAt = new Date();
    result.evidenceSummary = await this.buildEvidenceSummary('RESULT', result.id);
    await this.resultRepo.save(result);
    return this.getResult(result.id);
  }

  async approveStep(documentType: string, documentId: number, stepId: number, userId: number, comments?: string) {
    const run = await this.getRunForDocument(documentType, documentId);
    const step = run.steps.find((item) => item.id === stepId);
    if (!step) throw new NotFoundException('Approval step not found');
    if (step.status !== 'PENDING') {
      throw new BadRequestException('This approval step is not pending');
    }
    await this.assertUserCanApprove(run.projectId, step, userId);
    const approvedUserIds = new Set(step.approvedUserIds || []);
    if (approvedUserIds.has(userId)) {
      throw new BadRequestException('You have already approved this step');
    }
    approvedUserIds.add(userId);
    const signer = await this.approvalRuntimeService.getSignerSnapshot(run.projectId, userId);
    step.approvedUserIds = Array.from(approvedUserIds);
    step.currentApprovalCount = step.approvedUserIds.length;
    step.signerDisplayName = signer.displayName;
    step.signerCompany = signer.companyLabel;
    step.signerRole = signer.roleLabel;
    step.signedBy = signer.displayName;
    step.comments = comments || null;
    if (step.currentApprovalCount >= step.minApprovalsRequired) {
      step.status = 'APPROVED';
      step.completedAt = new Date();
      await this.stepRepo.save(step);
      await this.advanceOrCompleteRun(run, userId);
    } else {
      await this.stepRepo.save(step);
    }
    return this.getRunForDocument(documentType, documentId);
  }

  async rejectStep(documentType: string, documentId: number, stepId: number, userId: number, comments?: string) {
    const run = await this.getRunForDocument(documentType, documentId);
    const step = run.steps.find((item) => item.id === stepId);
    if (!step) throw new NotFoundException('Approval step not found');
    if (step.status !== 'PENDING') throw new BadRequestException('This approval step is not pending');
    await this.assertUserCanApprove(run.projectId, step, userId);
    step.status = 'REJECTED';
    step.comments = comments || null;
    step.completedAt = new Date();
    run.status = 'REJECTED';
    await this.stepRepo.save(step);
    await this.runRepo.save(run);
    await this.applyDocumentApprovalStatus(run, 'REJECTED', userId);
    return this.getRunForDocument(documentType, documentId);
  }

  async getResult(id: number) {
    const result = await this.resultRepo.findOne({
      where: { id },
      relations: ['obligation', 'receipt', 'template', 'checkpoint'],
    });
    if (!result) throw new NotFoundException('Material test result not found');
    return this.attachApprovalRun(result, RESULT_DOCUMENT_TYPE);
  }

  listEvidence(projectId: number, ownerType?: string, ownerId?: number) {
    const where: any = { projectId };
    if (ownerType) where.ownerType = ownerType;
    if (ownerId) where.ownerId = ownerId;
    return this.evidenceRepo.find({ where, order: { uploadedAt: 'DESC' } });
  }

  async createEvidence(projectId: number, body: any, file: Express.Multer.File, userId?: number) {
    if (!file) throw new BadRequestException('Evidence file is required');
    const ownerType = String(body.ownerType || '').toUpperCase();
    const ownerId = Number(body.ownerId);
    if (!ownerType || !ownerId) throw new BadRequestException('ownerType and ownerId are required');
    const evidence = this.evidenceRepo.create({
      projectId,
      ownerType,
      ownerId,
      resultId: body.resultId ? Number(body.resultId) : ownerType === 'RESULT' ? ownerId : null,
      receiptId: body.receiptId ? Number(body.receiptId) : ownerType === 'RECEIPT' ? ownerId : null,
      templateId: body.templateId ? Number(body.templateId) : ownerType === 'TEMPLATE' ? ownerId : null,
      checkpointId: body.checkpointId ? Number(body.checkpointId) : null,
      evidenceType: body.evidenceType || this.inferEvidenceType(file.mimetype),
      fileKind: file.mimetype?.startsWith('image/') ? 'PHOTO' : 'DOCUMENT',
      fileName: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      relativeUrl: toRelativePath(file.path),
      description: body.description || null,
      uploadedById: userId || null,
      isRequired: body.isRequired === 'true' || body.isRequired === true,
      metadata: body.metadata ? this.parseMaybeJson(body.metadata) : null,
    });
    return this.evidenceRepo.save(evidence);
  }

  private async startApprovalRun(input: {
    projectId: number;
    documentType: string;
    documentId: number;
    processCode: string;
    initiatorUserId: number;
    context: Record<string, any>;
  }) {
    const resolved = await this.releaseStrategyService.resolveStrategy(input.projectId, {
      projectId: input.projectId,
      moduleCode: 'QUALITY',
      processCode: input.processCode,
      documentType: input.documentType,
      amount: 0,
      vendorId: null,
      userId: input.initiatorUserId,
      context: input.context,
    } as any);
    const strategy = resolved.matchedStrategy;
    if (!strategy?.resolvedSteps?.length) {
      throw new BadRequestException(
        `No active release strategy found for ${input.processCode}. Configure it in Planning > Release Strategy.`,
      );
    }
    const steps = [...strategy.resolvedSteps].sort((a, b) => a.levelNo - b.levelNo);
    const run = await this.runRepo.save(
      this.runRepo.create({
        projectId: input.projectId,
        documentType: input.documentType,
        documentId: input.documentId,
        releaseStrategyId: strategy.id,
        releaseStrategyVersion: strategy.version,
        strategyName: strategy.name,
        moduleCode: strategy.moduleCode,
        processCode: strategy.processCode,
        status: 'IN_PROGRESS',
        currentStepOrder: steps[0].levelNo,
        initiatorUserId: input.initiatorUserId,
        contextSnapshot: input.context,
      }),
    );
    await this.stepRepo.save(
      steps.map((step, index) =>
        this.stepRepo.create({
          runId: run.id,
          stepOrder: step.levelNo,
          stepName: step.stepName,
          approverMode: step.approverMode,
          assignedUserId: step.approverMode === 'USER' ? step.userIds?.[0] || step.userId || null : null,
          assignedUserIds:
            step.approverMode === 'USER'
              ? step.userIds?.length
                ? step.userIds
                : step.userId
                  ? [step.userId]
                  : []
              : null,
          assignedRoleId: step.roleId || null,
          minApprovalsRequired: step.minApprovalsRequired || 1,
          currentApprovalCount: 0,
          approvedUserIds: [],
          status: index === 0 ? 'PENDING' : 'WAITING',
        }),
      ),
    );
    return this.getRunForDocument(input.documentType, input.documentId);
  }

  private async getRunForDocument(documentType: string, documentId: number) {
    const run = await this.runRepo.findOne({
      where: { documentType, documentId },
      relations: ['steps'],
      order: { steps: { stepOrder: 'ASC' } },
    });
    if (!run) throw new NotFoundException('Approval workflow not found');
    return run;
  }

  private async attachApprovalRun<T extends { id: number }>(
    item: T,
    documentType: string,
  ): Promise<T & { approvalRun?: QualityMaterialApprovalRun | null }> {
    const run = await this.runRepo.findOne({
      where: { documentType, documentId: item.id },
      relations: ['steps'],
      order: { steps: { stepOrder: 'ASC' } },
    });
    return { ...(item as any), approvalRun: run || null };
  }

  private async attachApprovalRuns<T extends { id: number }>(
    items: T[],
    documentType: string,
  ): Promise<Array<T & { approvalRun?: QualityMaterialApprovalRun | null }>> {
    if (!items.length) return [];
    const runs = await this.runRepo.find({
      where: { documentType, documentId: In(items.map((item) => item.id)) },
      relations: ['steps'],
      order: { steps: { stepOrder: 'ASC' } },
    });
    const runMap = new Map(runs.map((run) => [run.documentId, run]));
    return items.map((item) => ({
      ...(item as any),
      approvalRun: runMap.get(item.id) || null,
    }));
  }

  private async advanceOrCompleteRun(run: QualityMaterialApprovalRun, userId: number) {
    const latest = await this.getRunForDocument(run.documentType, run.documentId);
    const next = latest.steps.find((step) => step.status === 'WAITING');
    if (next) {
      next.status = 'PENDING';
      latest.currentStepOrder = next.stepOrder;
      await this.stepRepo.save(next);
      await this.runRepo.save(latest);
      return;
    }
    latest.status = 'APPROVED';
    await this.runRepo.save(latest);
    await this.applyDocumentApprovalStatus(latest, 'APPROVED', userId);
  }

  private async applyDocumentApprovalStatus(run: QualityMaterialApprovalRun, status: 'APPROVED' | 'REJECTED', userId: number) {
    if (run.documentType === ITP_DOCUMENT_TYPE) {
      const template = await this.getTemplate(run.documentId);
      template.approvalStatus = status;
      template.status = status === 'APPROVED' ? MATERIAL_ITP_STATUS.APPROVED : MATERIAL_ITP_STATUS.REJECTED;
      template.approvedById = status === 'APPROVED' ? userId : null;
      template.approvedAt = status === 'APPROVED' ? new Date() : null;
      await this.templateRepo.save(template);
    }
    if (run.documentType === RESULT_DOCUMENT_TYPE) {
      const result = await this.getResult(run.documentId);
      result.reviewStatus = status;
      result.reviewedById = status === 'APPROVED' ? userId : null;
      result.reviewedAt = status === 'APPROVED' ? new Date() : null;
      await this.resultRepo.save(result);
      if (status === 'APPROVED') {
        await this.evidenceRepo.update(
          { ownerType: 'RESULT', ownerId: result.id },
          { isLocked: true, lockedAt: new Date(), lockReason: 'Material test result approved' },
        );
        await this.obligationRepo.update({ id: result.obligationId }, { status: 'COMPLETED', lastResultId: result.id });
      }
    }
  }

  private async assertUserCanApprove(projectId: number, step: QualityMaterialApprovalStep, userId: number) {
    if (await this.isAdminUser(userId)) {
      return;
    }
    if (step.approverMode === 'USER') {
      const allowed = new Set(step.assignedUserIds?.length ? step.assignedUserIds : step.assignedUserId ? [step.assignedUserId] : []);
      if (!allowed.has(userId)) throw new ForbiddenException('You are not assigned to this approval step');
      return;
    }
    if (step.approverMode === 'PROJECT_ROLE' && step.assignedRoleId) {
      const roleIds = await this.approvalRuntimeService.getProjectRoleIds(projectId, userId);
      if (!roleIds.includes(step.assignedRoleId)) {
        throw new ForbiddenException('Your project role is not assigned to this approval step');
      }
    }
  }

  private async isAdminUser(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles'],
    });
    return Boolean(user?.roles?.some((role) => role.name === 'Admin'));
  }

  private async assertResultEvidenceComplete(result: QualityMaterialTestResult) {
    const checkpoint = result.checkpoint;
    const evidence = await this.evidenceRepo.find({
      where: { ownerType: 'RESULT', ownerId: result.id },
    });
    const photoCount = evidence.filter((item) => item.fileKind === 'PHOTO').length;
    const documentCount = evidence.filter((item) => item.fileKind === 'DOCUMENT').length;
    if (checkpoint.requiresPhotoEvidence && photoCount < (checkpoint.minPhotoCount || 1)) {
      throw new BadRequestException(`At least ${checkpoint.minPhotoCount || 1} evidence photo(s) are required`);
    }
    if ((checkpoint.requiresDocument || checkpoint.requiresLabReport) && documentCount < 1) {
      throw new BadRequestException('At least one evidence document is required');
    }
    const requiredTypes = checkpoint.requiredEvidenceTypes || [];
    const availableTypes = new Set(evidence.map((item) => item.evidenceType));
    const missing = requiredTypes.filter((type) => !availableTypes.has(type));
    if (missing.length) {
      throw new BadRequestException(`Missing required evidence: ${missing.join(', ')}`);
    }
  }

  private async buildEvidenceSummary(ownerType: string, ownerId: number) {
    const evidence = await this.evidenceRepo.find({ where: { ownerType, ownerId } });
    return {
      total: evidence.length,
      photos: evidence.filter((item) => item.fileKind === 'PHOTO').length,
      documents: evidence.filter((item) => item.fileKind === 'DOCUMENT').length,
      types: Array.from(new Set(evidence.map((item) => item.evidenceType))),
    };
  }

  private async findActiveTemplate(projectId: number, materialName: string, materialCode?: string) {
    const where: any[] = [{ projectId, materialName, status: MATERIAL_ITP_STATUS.ACTIVE }];
    if (materialCode) where.unshift({ projectId, materialCode, status: MATERIAL_ITP_STATUS.ACTIVE });
    const template = await this.templateRepo.findOne({
      where,
      relations: ['checkpoints'],
      order: { updatedAt: 'DESC' },
    });
    if (!template) throw new NotFoundException('No active ITP template found for this material');
    return template;
  }

  private buildCheckpointEntities(checkpoints: any[]) {
    return checkpoints.map((checkpoint, index) =>
      this.checkpointRepo.create({
        sequence: checkpoint.sequence ?? index + 1,
        section: checkpoint.section || 'OTHER',
        slNo: checkpoint.slNo || null,
        characteristic: checkpoint.characteristic,
        testSpecification: checkpoint.testSpecification || null,
        unit: checkpoint.unit || null,
        verifyingDocument: checkpoint.verifyingDocument || 'OTHER',
        frequencyType: checkpoint.frequencyType || 'MANUAL',
        frequencyValue: checkpoint.frequencyValue ?? null,
        frequencyUnit: checkpoint.frequencyUnit || null,
        acceptanceCriteria: checkpoint.acceptanceCriteria || null,
        applicableGrades: checkpoint.applicableGrades || null,
        inspectionCategory: checkpoint.inspectionCategory || null,
        contractorAction: checkpoint.contractorAction || null,
        pmcAction: checkpoint.pmcAction || null,
        isMandatory: checkpoint.isMandatory ?? true,
        requiresDocument: checkpoint.requiresDocument ?? false,
        requiresPhotoEvidence: checkpoint.requiresPhotoEvidence ?? false,
        requiresNumericResult: checkpoint.requiresNumericResult ?? false,
        requiresLabReport: checkpoint.requiresLabReport ?? false,
        requiresThirdParty: checkpoint.requiresThirdParty ?? false,
        requiredEvidenceTypes: checkpoint.requiredEvidenceTypes || null,
        minPhotoCount: checkpoint.minPhotoCount ?? 0,
        dueOffsetHours: checkpoint.dueOffsetHours ?? null,
        expiryWindowDays: checkpoint.expiryWindowDays ?? null,
      }),
    );
  }

  private assertTemplatePayload(dto: CreateMaterialItpTemplateDto) {
    if (!dto.materialName?.trim()) throw new BadRequestException('Material name is required');
    if (!dto.itpNo?.trim()) throw new BadRequestException('ITP number is required');
    if (!dto.title?.trim()) throw new BadRequestException('ITP title is required');
    for (const checkpoint of dto.checkpoints || []) {
      if (!checkpoint.characteristic?.trim()) {
        throw new BadRequestException('Every checkpoint requires a characteristic');
      }
    }
  }

  private async refreshObligationStatuses(projectId: number) {
    const items = await this.obligationRepo.find({
      where: { projectId, status: In(['PENDING', 'DUE_SOON', 'OVERDUE']) },
    });
    for (const item of items) {
      if (item.dueDate && this.isBeforeToday(item.dueDate)) item.status = 'OVERDUE';
      else if (item.warningDate && !this.isBeforeToday(item.warningDate)) item.status = 'DUE_SOON';
    }
    if (items.length) await this.obligationRepo.save(items);
  }

  private evaluateResult(dto: CreateMaterialTestResultDto, checkpoint: QualityMaterialItpCheckpoint) {
    const criteria = checkpoint.acceptanceCriteria || {};
    const value = dto.numericValue === undefined || dto.numericValue === null ? null : Number(dto.numericValue);
    if (!Number.isNaN(value) && value !== null) {
      if (criteria.min !== undefined && value < Number(criteria.min)) return 'FAIL';
      if (criteria.max !== undefined && value > Number(criteria.max)) return 'FAIL';
      return 'PASS';
    }
    return dto.textValue ? 'PENDING_REVIEW' : 'PENDING_REVIEW';
  }

  private inferEvidenceType(mimeType: string) {
    if (mimeType?.startsWith('image/')) return 'PHOTO';
    if (mimeType?.includes('pdf')) return 'LAB_REPORT';
    return 'DOCUMENT';
  }

  private parseMaybeJson(value: string) {
    try {
      return JSON.parse(value);
    } catch {
      return { value };
    }
  }

  private today() {
    return new Date().toISOString().slice(0, 10);
  }

  private addDays(date: string, days: number) {
    const next = new Date(`${date}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + days);
    return next.toISOString().slice(0, 10);
  }

  private addHoursToDate(date: string, hours: number) {
    const next = new Date(`${date}T00:00:00.000Z`);
    next.setUTCHours(next.getUTCHours() + hours);
    return next.toISOString().slice(0, 10);
  }

  private isBeforeToday(date: string) {
    return date < this.today();
  }
}
