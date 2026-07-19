import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { toRelativePaths } from '../common/path.utils';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, In } from 'typeorm';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { ProjectProfile } from '../eps/project-profile.entity';
import {
  ActivityObservation,
  ActivityObservationStatus,
} from './entities/activity-observation.entity';
import {
  QualityInspection,
  InspectionStatus,
} from './entities/quality-inspection.entity';
import { User } from '../users/user.entity';
import { TempUser } from '../temp-user/entities/temp-user.entity';
import { Vendor } from '../workdoc/entities/vendor.entity';
import { WorkOrder } from '../workdoc/entities/work-order.entity';
import { QualityActivity } from './entities/quality-activity.entity';
import { QualityActivityList } from './entities/quality-activity-list.entity';
import { QualityChecklistTemplate } from './entities/quality-checklist-template.entity';
import { QualityFloorStructure } from './entities/quality-floor-structure.entity';
import { QualityUnit } from './entities/quality-unit.entity';
import { QualityRoom } from './entities/quality-room.entity';
import {
  QualityInspectionStage,
  StageStatus,
} from './entities/quality-inspection-stage.entity';
import { QualityExecutionItem } from './entities/quality-execution-item.entity';
import { QualitySignature } from './entities/quality-signature.entity';
import { QualitySequenceEdge } from './entities/quality-sequence-edge.entity';
import { QualityActivityStatus } from './entities/quality-activity.entity';
import { QualityApplicabilityLevel } from './entities/quality-activity.entity';
import {
  QualityCardStatus,
  QualityPourCard,
} from './entities/quality-pour-card.entity';
import { QualityPrePourClearanceCard } from './entities/quality-pre-pour-clearance-card.entity';
import { QualityCubeTestRegister } from './entities/quality-cube-test-register.entity';
import { AuditService } from '../audit/audit.service';
import { ComplianceService } from './compliance.service';
import { InspectionWorkflowService } from './inspection-workflow.service';
import { PushNotificationService } from '../notifications/push-notification.service';
import { NotificationComposerService } from '../notifications/notification-composer.service';
import {
  InspectionWorkflowRun,
  WorkflowRunStatus,
} from './entities/inspection-workflow-run.entity';
import {
  InspectionWorkflowStep,
  WorkflowStepStatus,
} from './entities/inspection-workflow-step.entity';
import { ApprovalRuntimeService } from '../common/approval-runtime.service';
import { CustomerMilestoneService } from '../milestone/customer-milestone.service';
import { QualityInspectionAttachmentService } from './quality-inspection-attachment.service';
import { SystemSettingsService } from '../common/system-settings.service';

export interface CreateInspectionDto {
  projectId: number;
  epsNodeId: number;
  locationPath?: string;
  locationLabel?: string;
  listId: number;
  activityId: number;
  qualityUnitId?: number;
  qualityRoomId?: number;
  partNo?: number;
  totalParts?: number;
  partLabel?: string;
  comments?: string;
  requestDate?: string;
  signature?: { data: string; role: string; signedBy: string };
  vendorId?: number;
  vendorName?: string;
  drawingNo: string;
  elementName?: string;
  goNo?: number;
  goLabel?: string;
  goDetails?: string;
  relatedChecklistInspectionIds?: number[];
  attachmentDraftIds?: string[];
  contractorName?: string;
  processCode?: string;
  documentType?: string;
}

export interface UpdateInspectionStatusDto {
  status: InspectionStatus; // APPROVED, REJECTED
  comments?: string;
  inspectedBy?: string;
  inspectionDate?: string;
}

export interface ExpandGoSeriesDto {
  projectId: number;
  epsNodeId: number;
  activityId: number;
  newTotalParts: number;
  qualityUnitId?: number;
  qualityRoomId?: number;
}

@Injectable()
export class QualityInspectionService {
  private readonly logger = new Logger(QualityInspectionService.name);
  private readonly rfiBackdatingGlobalKey = 'QUALITY_RFI_BACKDATING_ENABLED';

  constructor(
    @InjectRepository(QualityInspection)
    private readonly inspectionRepo: Repository<QualityInspection>,
    @InjectRepository(QualityActivity)
    private readonly activityRepo: Repository<QualityActivity>,
    @InjectRepository(QualityActivityList)
    private readonly listRepo: Repository<QualityActivityList>,
    @InjectRepository(QualityChecklistTemplate)
    private readonly checklistTemplateRepo: Repository<QualityChecklistTemplate>,
    @InjectRepository(QualityFloorStructure)
    private readonly floorStructureRepo: Repository<QualityFloorStructure>,
    @InjectRepository(QualityUnit)
    private readonly qualityUnitRepo: Repository<QualityUnit>,
    @InjectRepository(QualityRoom)
    private readonly qualityRoomRepo: Repository<QualityRoom>,
    @InjectRepository(QualityInspectionStage)
    private readonly stageRepo: Repository<QualityInspectionStage>,
    @InjectRepository(QualityExecutionItem)
    private readonly executionItemRepo: Repository<QualityExecutionItem>,
    @InjectRepository(QualitySignature)
    private readonly signatureRepo: Repository<QualitySignature>,
    @InjectRepository(QualitySequenceEdge)
    private readonly sequenceRepo: Repository<QualitySequenceEdge>,
    @InjectRepository(EpsNode)
    private readonly epsNodeRepo: Repository<EpsNode>,
    @InjectRepository(ProjectProfile)
    private readonly projectProfileRepo: Repository<ProjectProfile>,
    @InjectRepository(ActivityObservation)
    private readonly observationRepo: Repository<ActivityObservation>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(TempUser)
    private readonly tempUserRepo: Repository<TempUser>,
    @InjectRepository(WorkOrder)
    private readonly workOrderRepo: Repository<WorkOrder>,
    @InjectRepository(InspectionWorkflowRun)
    private readonly workflowRunRepo: Repository<InspectionWorkflowRun>,
    @InjectRepository(InspectionWorkflowStep)
    private readonly workflowStepRepo: Repository<InspectionWorkflowStep>,
    @InjectRepository(QualityPourCard)
    private readonly pourCardRepo: Repository<QualityPourCard>,
    @InjectRepository(QualityPrePourClearanceCard)
    private readonly prePourClearanceRepo: Repository<QualityPrePourClearanceCard>,
    @InjectRepository(QualityCubeTestRegister)
    private readonly cubeRegisterRepo: Repository<QualityCubeTestRegister>,
    private readonly complianceService: ComplianceService,
    private readonly auditService: AuditService,
    private readonly inspectionWorkflowService: InspectionWorkflowService,
    private readonly pushService: PushNotificationService,
    private readonly notificationComposer: NotificationComposerService,
    private readonly approvalRuntimeService: ApprovalRuntimeService,
    private readonly customerMilestoneService: CustomerMilestoneService,
    private readonly attachmentService: QualityInspectionAttachmentService,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  async getRfiDateSettings(projectId: number) {
    const globalEnabled = await this.systemSettings.getSettingBool(
      this.rfiBackdatingGlobalKey,
    );
    const projectValue = await this.systemSettings.getSetting(
      this.rfiBackdatingProjectKey(projectId),
    );
    const normalizedProjectValue = String(projectValue || '').trim().toLowerCase();
    const projectEnabled =
      projectValue == null
        ? false
        : ['true', '1', 'yes', 'on'].includes(normalizedProjectValue);
    return {
      globalEnabled,
      projectEnabled,
      projectOverride: projectValue,
      enabled: globalEnabled && projectEnabled,
      projectSettingKey: this.rfiBackdatingProjectKey(projectId),
    };
  }

  async updateRfiDateSettings(projectId: number, enabled: boolean) {
    await this.systemSettings.updateSetting(
      this.rfiBackdatingProjectKey(projectId),
      enabled ? 'true' : 'false',
    );
    return this.getRfiDateSettings(projectId);
  }

  async listRfiDateProjectSettings() {
    const [projectNodes, profiles] = await Promise.all([
      this.epsNodeRepo.find({
        where: { type: EpsNodeType.PROJECT },
        relations: ['projectProfile'],
        order: { name: 'ASC', id: 'ASC' },
      }),
      this.projectProfileRepo.find({ relations: ['epsNode'] }),
    ]);
    const profileByProjectId = new Map(
      profiles
        .filter((profile) => profile.epsNode?.id)
        .map((profile) => [profile.epsNode.id, profile]),
    );
    const rows = await Promise.all(
      projectNodes.map(async (project) => {
        const profile = project.projectProfile || profileByProjectId.get(project.id);
        const settings = await this.getRfiDateSettings(project.id);
        return {
          projectId: project.id,
          projectProfileId: profile?.id || null,
          projectCode: profile?.projectCode || null,
          projectName: profile?.projectName || project.name || `Project ${project.id}`,
          ...settings,
        };
      }),
    );
    const globalEnabled = await this.systemSettings.getSettingBool(
      this.rfiBackdatingGlobalKey,
    );
    return {
      globalEnabled,
      projects: rows,
    };
  }

  private deriveInspectionProcessCode(dto: CreateInspectionDto): string {
    return (dto.processCode || 'QA_QC_APPROVAL').trim().toUpperCase();
  }

  private rfiBackdatingProjectKey(projectId: number) {
    return `QUALITY_RFI_BACKDATING_PROJECT_${projectId}`;
  }

  private todayIsoDate() {
    return new Date().toISOString().split('T')[0];
  }

  private parseIsoDateOnly(value: unknown, label: string) {
    const text = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new BadRequestException(`${label} must be a valid date.`);
    }
    const date = new Date(`${text}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
      throw new BadRequestException(`${label} must be a valid date.`);
    }
    if (text > this.todayIsoDate()) {
      throw new BadRequestException(`${label} cannot be in the future.`);
    }
    return text;
  }

  private async assertRfiBackdatingEnabled(projectId: number) {
    const settings = await this.getRfiDateSettings(projectId);
    if (!settings.enabled) {
      throw new BadRequestException(
        'Manual RFI request/approval dates are not enabled for this project.',
      );
    }
  }

  private async resolveRfiRequestDate(projectId: number, requestedDate?: string) {
    if (!requestedDate) return this.todayIsoDate();
    await this.assertRfiBackdatingEnabled(projectId);
    return this.parseIsoDateOnly(requestedDate, 'RFI request date');
  }

  private async resolveRfiApprovalTimestamp(
    projectId: number,
    approvalDate?: unknown,
  ) {
    if (!approvalDate) return new Date();
    await this.assertRfiBackdatingEnabled(projectId);
    const date = this.parseIsoDateOnly(approvalDate, 'RFI approval date');
    return new Date(`${date}T12:00:00.000Z`);
  }

  private buildRfiSignatureMetadata(
    effectiveApprovalAt: Date,
    actualSignedAt: Date,
    signatureEvidence?: Record<string, unknown>,
    extra?: Record<string, unknown>,
  ) {
    const effectiveIso = effectiveApprovalAt.toISOString();
    const actualIso = actualSignedAt.toISOString();
    return {
      timestamp: effectiveApprovalAt,
      ...(signatureEvidence || {}),
      effectiveApprovalAt: effectiveIso,
      actualSignedAt: actualIso,
      isBackdatedSignature: effectiveIso !== actualIso,
      ...(extra || {}),
    };
  }

  private deriveInspectionDocumentType(
    dto: CreateInspectionDto,
    applicability: QualityApplicabilityLevel,
  ): string {
    if (dto.documentType?.trim()) {
      return dto.documentType.trim().toUpperCase();
    }

    if (applicability === QualityApplicabilityLevel.ROOM) {
      return 'ROOM_RFI';
    }
    if (applicability === QualityApplicabilityLevel.UNIT) {
      return 'UNIT_RFI';
    }
    return 'FLOOR_RFI';
  }

  private deriveGoFields(
    dto: CreateInspectionDto,
    applicability: QualityApplicabilityLevel,
  ): { goNo: number | null; goLabel: string | null } {
    if (applicability !== QualityApplicabilityLevel.FLOOR) {
      return { goNo: null, goLabel: null };
    }

    const resolvedGoNo =
      typeof dto.goNo === 'number' ? dto.goNo : dto.partNo || 1;
    const explicitLabel = dto.goLabel?.trim();
    return {
      goNo: resolvedGoNo,
      goLabel:
        explicitLabel && explicitLabel.length > 0
          ? explicitLabel
          : `GO ${resolvedGoNo}`,
    };
  }

  private getActiveInspectionStatuses() {
    return Object.values(InspectionStatus).filter(
      (status) =>
        status !== InspectionStatus.REJECTED &&
        status !== InspectionStatus.CANCELED,
    );
  }

  private async assertInspectionGoScopeAvailable(
    dto: CreateInspectionDto,
    partNo: number,
  ) {
    const query = this.inspectionRepo
      .createQueryBuilder('inspection')
      .where('inspection.projectId = :projectId', { projectId: dto.projectId })
      .andWhere('inspection.epsNodeId = :epsNodeId', {
        epsNodeId: dto.epsNodeId,
      })
      .andWhere('inspection.activityId = :activityId', {
        activityId: dto.activityId,
      })
      .andWhere('inspection.partNo = :partNo', { partNo })
      .andWhere('inspection.status IN (:...activeStatuses)', {
        activeStatuses: this.getActiveInspectionStatuses(),
      });

    if (typeof dto.qualityUnitId === 'number') {
      query.andWhere('inspection.qualityUnitId = :qualityUnitId', {
        qualityUnitId: dto.qualityUnitId,
      });
    } else {
      query.andWhere('inspection.qualityUnitId IS NULL');
    }

    if (typeof dto.qualityRoomId === 'number') {
      query.andWhere('inspection.qualityRoomId = :qualityRoomId', {
        qualityRoomId: dto.qualityRoomId,
      });
    } else {
      query.andWhere('inspection.qualityRoomId IS NULL');
    }

    const existing = await query.orderBy('inspection.id', 'DESC').getOne();
    if (existing) {
      const goLabel =
        existing.goLabel ||
        existing.partLabel ||
        `GO ${existing.partNo || partNo}`;
      throw new BadRequestException(
        `${goLabel} is already active for this activity and location as RFI #${existing.id}. Use Add GO for the next GO, or reject/cancel the existing RFI before re-raising this GO.`,
      );
    }
  }

  async getActiveVendors(projectId: number) {
    // Return all vendors that have any work order for this project.
    // We do not filter by status or expiry — even a CLOSED or expired work
    // order means the vendor has been engaged on this project and should
    // appear as a valid selection when raising an RFI.
    const workOrders = await this.workOrderRepo.find({
      where: { projectId },
      relations: ['vendor'],
    });

    const vendorMap = new Map<number, Vendor>();
    for (const wo of workOrders) {
      if (wo.vendor && !vendorMap.has(wo.vendor.id)) {
        vendorMap.set(wo.vendor.id, wo.vendor);
      }
    }

    // If no project-specific work orders exist, fall back to all vendors in
    // the system so the picker is never empty for a valid project.
    if (vendorMap.size === 0) {
      const allVendors = await this.vendorRepo.find({
        order: { name: 'ASC' },
      });
      return allVendors;
    }

    return Array.from(vendorMap.values());
  }

  async getInspections(
    projectId: number,
    epsNodeId?: number,
    listId?: number,
    viewerUserId?: number,
    viewerIsAdmin: boolean = false,
    paging?: {
      limit?: number;
      offset?: number;
      q?: string;
      status?: string;
    },
  ) {
    const query = this.inspectionRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.activity', 'activity')
      .leftJoinAndSelect('i.epsNode', 'eps')
      .where('i.projectId = :projectId', { projectId });

    if (epsNodeId) {
      query.andWhere('i.epsNodeId = :epsNodeId', { epsNodeId });
    }
    if (listId) {
      query.andWhere('i.listId = :listId', { listId });
    }
    if (paging?.status && paging.status !== 'ALL') {
      query.andWhere('i.status = :status', { status: paging.status });
    }
    const q = paging?.q?.trim().toLowerCase();
    if (q) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where(
            `LOWER(COALESCE(i.comments, '') || ' ' || COALESCE(i.drawingNo, '') || ' ' || COALESCE(i.elementName, '') || ' ' || COALESCE(i.contractorName, '') || ' ' || COALESCE(i.goDetails, '') || ' ' || COALESCE(i.goLabel, '')) LIKE :q`,
            { q: `%${q}%` },
          )
            .orWhere('LOWER(activity.name) LIKE :q', { q: `%${q}%` })
            .orWhere('LOWER(eps.name) LIKE :q', { q: `%${q}%` });
        }),
      );
    }

    query.orderBy('i.createdAt', 'DESC');
    const hasPaging =
      Number.isFinite(Number(paging?.limit)) ||
      Number.isFinite(Number(paging?.offset));
    const limit = Math.min(100, Math.max(1, Number(paging?.limit) || 25));
    const offset = Math.max(0, Number(paging?.offset) || 0);
    const [inspections, total] = hasPaging
      ? await query.skip(offset).take(limit).getManyAndCount()
      : [await query.getMany(), undefined];

    if (inspections.length === 0) {
      return hasPaging
        ? { data: [], total: total || 0, limit, offset, hasMore: false }
        : [];
    }

    // Build related lookups in batch to avoid per-row queries.
    const unitIds = Array.from(
      new Set(
        inspections
          .map((i) => i.qualityUnitId)
          .filter((id): id is number => typeof id === 'number'),
      ),
    );
    const roomIds = Array.from(
      new Set(
        inspections
          .map((i) => i.qualityRoomId)
          .filter((id): id is number => typeof id === 'number'),
      ),
    );
    const relatedInspectionIds = Array.from(
      new Set(
        inspections.flatMap((inspection) =>
          this.normalizeRelatedChecklistInspectionIds(
            inspection.relatedChecklistInspectionIds,
          ),
        ),
      ),
    );

    const requestedByIds = Array.from(
      new Set(
        inspections
          .map((inspection) => inspection.requestedById)
          .filter((id): id is number => typeof id === 'number'),
      ),
    );
    const [epsById, units, rooms, relatedInspections, requesters] =
      await Promise.all([
        this.loadEpsAncestryMap(
          inspections
            .map((inspection) => inspection.epsNodeId)
            .filter((id): id is number => typeof id === 'number'),
        ),
        unitIds.length
          ? this.qualityUnitRepo.find({ where: { id: In(unitIds) } })
          : Promise.resolve([]),
        roomIds.length
          ? this.qualityRoomRepo.find({ where: { id: In(roomIds) } })
          : Promise.resolve([]),
        relatedInspectionIds.length
          ? this.inspectionRepo.find({
              where: { id: In(relatedInspectionIds), projectId },
              relations: ['activity'],
            })
          : Promise.resolve([]),
        requestedByIds.length
          ? this.userRepo.find({ where: { id: In(requestedByIds) } })
          : Promise.resolve([]),
      ]);

    const unitsById = new Map<number, QualityUnit>(units.map((u) => [u.id, u]));
    const roomsById = new Map<number, QualityRoom>(rooms.map((r) => [r.id, r]));
    const relatedById = new Map(
      relatedInspections.map((inspection) => [inspection.id, inspection]),
    );
    const requesterById = new Map(requesters.map((user) => [user.id, user]));

    const inspectionsWithWorkflow = await this.attachWorkflowSummary(
      inspections,
      viewerUserId,
      viewerIsAdmin,
    );

    const data = inspectionsWithWorkflow.map((inspection) => {
      const ancestry = this.buildEpsAncestry(inspection.epsNodeId, epsById);
      const locationPath =
        inspection.locationPath || ancestry.map((n) => n.name).join(' > ');

      const blockName = ancestry.find(
        (n) => n.type === EpsNodeType.BLOCK,
      )?.name;
      const towerName = ancestry.find(
        (n) => n.type === EpsNodeType.TOWER,
      )?.name;
      const floorName = ancestry.find(
        (n) => n.type === EpsNodeType.FLOOR,
      )?.name;

      const qualityUnit = inspection.qualityUnitId
        ? unitsById.get(inspection.qualityUnitId)
        : undefined;
      const qualityRoom = inspection.qualityRoomId
        ? roomsById.get(inspection.qualityRoomId)
        : undefined;

      // If inspection is raised on UNIT/ROOM EPS node, use that as fallback.
      const epsUnitName = ancestry.find(
        (n) => n.type === EpsNodeType.UNIT,
      )?.name;
      const epsRoomName = ancestry.find(
        (n) => n.type === EpsNodeType.ROOM,
      )?.name;
      const requester = inspection.requestedById
        ? requesterById.get(inspection.requestedById)
        : undefined;

      return {
        ...inspection,
        locationPath,
        blockName,
        towerName,
        floorName,
        unitName: qualityUnit?.name || epsUnitName || null,
        roomName: qualityRoom?.name || epsRoomName || null,
        raisedBy: requester
          ? {
              id: requester.id,
              username: requester.username,
              displayName: requester.displayName || requester.username,
              designation: requester.designation || null,
            }
          : inspection.requestedById
            ? {
                id: inspection.requestedById,
                username: `User #${inspection.requestedById}`,
                displayName: `User #${inspection.requestedById}`,
                designation: null,
              }
            : null,
        relatedChecklistInspections:
          this.normalizeRelatedChecklistInspectionIds(
            inspection.relatedChecklistInspectionIds,
          )
            .map((id) => relatedById.get(id))
            .filter(Boolean)
            .map((related: any) => ({
              id: related.id,
              activityName:
                related.activity?.activityName || `RFI #${related.id}`,
              status: related.status,
              requestDate: related.requestDate,
              goNo: related.goNo,
              goLabel: related.goLabel,
              partNo: related.partNo,
              partLabel: related.partLabel,
              drawingNo: related.drawingNo,
              elementName: related.elementName,
              goDetails: related.goDetails,
            })),
      };
    });

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

  async getMyPendingInspections(projectId: number, userId: number) {
    const inspections = (await this.getInspections(
      projectId,
      undefined,
      undefined,
      userId,
      false,
    )) as any[];
    const userRoleIds = await this.getUserProjectRoleIds(projectId, userId);

    return inspections.filter((inspection) => {
      if (
        [InspectionStatus.APPROVED, InspectionStatus.CANCELED].includes(
          inspection.status,
        )
      ) {
        return false;
      }
      return this.inspectionHasActionableApprovalForUser(
        inspection,
        userId,
        userRoleIds,
      );
    });
  }

  async getInspectionDetails(
    id: number,
    viewerUserId?: number,
    viewerIsAdmin: boolean = false,
  ) {
    const inspection = await this.loadInspectionWithDetails(id);
    if (!inspection) throw new NotFoundException('Inspection not found');
    const hydratedInspection =
      await this.materializeInspectionStagesIfMissing(inspection);
    await this.reopenLegacyReversedInspectionIfNeeded(hydratedInspection);
    // Normalize photo arrays on all checklist items (fixes old absolute URLs)
    for (const stage of hydratedInspection.stages ?? []) {
      for (const item of stage.items ?? []) {
        item.photos = toRelativePaths(item.photos);
      }
    }
    const [withWorkflow] = await this.attachWorkflowSummary(
      [hydratedInspection],
      viewerUserId,
      viewerIsAdmin,
      true,
    );
    const withRelated =
      await this.attachRelatedChecklistSummaries(withWorkflow);
    return {
      ...withRelated,
      locationPath:
        withRelated.locationPath ||
        (await this.buildEpsLocationPath(withRelated.epsNodeId)),
      attachments: await this.attachmentService.listForInspection(id),
    };
  }

  private async reopenLegacyReversedInspectionIfNeeded(
    inspection: QualityInspection,
  ) {
    const run = await this.workflowRunRepo.findOne({
      where: { inspectionId: inspection.id },
      relations: ['steps'],
    });
    const shouldReopen =
      inspection.status === InspectionStatus.REVERSED ||
      run?.status === WorkflowRunStatus.REVERSED;
    if (!shouldReopen) return;

    inspection.status = InspectionStatus.PENDING;
    inspection.isLocked = false;
    inspection.lockedAt = null;
    inspection.lockedByUserId = null;
    await this.inspectionRepo.save(inspection);

    const stagesToReopen = (inspection.stages || []).filter(
      (stage) => stage.status === StageStatus.APPROVED || stage.isLocked,
    );
    for (const stage of stagesToReopen) {
      stage.status = StageStatus.COMPLETED;
      stage.isLocked = false;
      stage.lockedAt = null;
      stage.lockedByUserId = null;
    }
    if (stagesToReopen.length > 0) {
      await this.stageRepo.save(stagesToReopen);
    }

    if (run) {
      const sortedSteps = [...(run.steps || [])].sort(
        (a, b) => a.stepOrder - b.stepOrder,
      );
      const firstStep = sortedSteps[0];
      for (const step of sortedSteps) {
        step.status =
          step.id === firstStep?.id
            ? WorkflowStepStatus.PENDING
            : WorkflowStepStatus.WAITING;
        step.completedAt = null;
        step.signatureId = null;
        step.currentApprovalCount = 0;
        step.approvedUserIds = [];
        step.signedBy = null;
        step.signerDisplayName = null;
        step.signerCompany = null;
        step.signerRole = null;
        step.comments =
          step.id === firstStep?.id
            ? step.comments || 'Reopened from legacy reversed state'
            : null;
      }
      if (sortedSteps.length > 0) {
        await this.workflowStepRepo.save(sortedSteps);
      }
      run.status = WorkflowRunStatus.IN_PROGRESS;
      run.currentStepOrder = firstStep?.stepOrder || 1;
      await this.workflowRunRepo.save(run);
    }
  }

  async getApprovalDashboard(projectId: number, userId: number) {
    const inspections = (await this.getInspections(
      projectId,
      undefined,
      undefined,
      userId,
    )) as any[];
    const actorSnapshot = await this.getApproverSnapshot(projectId, userId);
    const userRoleIds = await this.getUserProjectRoleIds(projectId, userId);

    const canApproveInspection = (inspection: any) => {
      if (!inspection.workflowSummary?.pendingStep) return false;
      const step = inspection.workflowSummary.pendingStep;
      const assignedUserIds = step.assignedUserIds || [];
      if (assignedUserIds.includes(userId)) return true;
      if (step.assignedUserId && step.assignedUserId === userId) return true;
      if (step.assignedRoleId && userRoleIds.includes(step.assignedRoleId)) {
        return true;
      }
      return false;
    };

    const pendingForMe = inspections.filter((inspection) =>
      canApproveInspection(inspection),
    );
    const approvedByMe = inspections.filter((inspection) =>
      (inspection.workflowSummary?.completedSteps || []).some(
        (step: any) => step.signedByUserId === userId,
      ),
    );
    const stageApprovedPendingFinal = inspections.filter(
      (inspection) =>
        inspection.stageApprovalSummary?.approvedStages > 0 &&
        inspection.stageApprovalSummary?.approvedStages ===
          inspection.stageApprovalSummary?.totalStages &&
        inspection.status !== InspectionStatus.APPROVED,
    );

    return {
      actor: actorSnapshot,
      counts: {
        pendingForMe: pendingForMe.length,
        approvedByMe: approvedByMe.length,
        stageApprovedPendingFinal: stageApprovedPendingFinal.length,
      },
      pendingForMe,
      approvedByMe,
      stageApprovedPendingFinal,
    };
  }

  async getUnitProgress(
    projectId: number,
    epsNodeId: number,
    activityId: number,
  ) {
    const activity = await this.activityRepo.findOne({
      where: { id: activityId },
    });
    if (!activity) throw new NotFoundException('Activity not found');

    const selectedNode = await this.epsNodeRepo.findOne({
      where: { id: epsNodeId },
    });
    if (!selectedNode) throw new NotFoundException('EPS node not found');

    const floorId =
      selectedNode.type === EpsNodeType.FLOOR
        ? selectedNode.id
        : selectedNode.type === EpsNodeType.UNIT
          ? selectedNode.parentId
          : selectedNode.type === EpsNodeType.ROOM
            ? (
                await this.epsNodeRepo.findOne({
                  where: { id: selectedNode.parentId },
                })
              )?.parentId
            : null;

    if (!floorId) {
      throw new BadRequestException(
        'Unit progress is only available in floor/unit/room context.',
      );
    }

    const floorStructure = await this.floorStructureRepo.findOne({
      where: { projectId, floorId },
      relations: ['units'],
    });

    const units = [...(floorStructure?.units || [])].sort(
      (a, b) => a.sequence - b.sequence,
    );
    const unitIds = units.map((u) => u.id);

    if (unitIds.length === 0) {
      return {
        activityId,
        floorId,
        totalUnits: 0,
        raisedUnitIds: [],
        pendingUnitIds: [],
        units: [],
      };
    }

    const inspections = await this.inspectionRepo.find({
      where: {
        projectId,
        activityId,
        epsNodeId: floorId,
      } as any,
      order: { createdAt: 'DESC' },
    });

    const latestByUnit = new Map<number, QualityInspection>();
    for (const insp of inspections) {
      if (!insp.qualityUnitId) continue;
      if (!unitIds.includes(insp.qualityUnitId)) continue;
      if (!latestByUnit.has(insp.qualityUnitId)) {
        latestByUnit.set(insp.qualityUnitId, insp);
      }
    }

    const isActiveSubmission = (inspection?: QualityInspection) =>
      Boolean(
        inspection &&
        inspection.status !== InspectionStatus.REJECTED &&
        inspection.status !== InspectionStatus.CANCELED,
      );
    const raisedUnitIds = Array.from(latestByUnit.entries())
      .filter(([, inspection]) => isActiveSubmission(inspection))
      .map(([unitId]) => unitId)
      .sort((a, b) => a - b);
    const pendingUnitIds = unitIds.filter(
      (id) => !isActiveSubmission(latestByUnit.get(id)),
    );

    return {
      activityId,
      floorId,
      totalUnits: unitIds.length,
      raisedUnitIds,
      pendingUnitIds,
      units: units.map((u) => ({
        id: u.id,
        name: u.name,
        latestInspectionStatus: latestByUnit.get(u.id)?.status || null,
        inspectionId: latestByUnit.get(u.id)?.id || null,
      })),
    };
  }

  async create(dto: CreateInspectionDto, userId?: number) {
    // 0. EPS Floor-Level Restriction
    const epsNode = await this.epsNodeRepo.findOne({
      where: { id: dto.epsNodeId },
    });
    if (!epsNode) throw new NotFoundException('EPS node not found');

    const ALLOWED_EPS_TYPES: EpsNodeType[] = [
      EpsNodeType.FLOOR,
      EpsNodeType.UNIT,
      EpsNodeType.ROOM,
    ];
    if (!ALLOWED_EPS_TYPES.includes(epsNode.type)) {
      throw new BadRequestException(
        `RFI must be raised at Floor level or below. Selected node is "${epsNode.type}". Please select a Floor, Unit, or Room.`,
      );
    }

    // 1. Verify Activity
    const activity = await this.activityRepo.findOne({
      where: { id: dto.activityId },
    });
    if (!activity) throw new NotFoundException('Activity not found');
    if (!dto.drawingNo?.trim()) {
      throw new BadRequestException(
        'Drawing number is required while raising RFI.',
      );
    }
    if (
      (activity.requiresPourCard || activity.requiresPourClearanceCard) &&
      !dto.elementName?.trim()
    ) {
      throw new BadRequestException(
        'Elements is required while raising RFI for activities that require pour cards.',
      );
    }

    const applicability =
      activity.applicabilityLevel || QualityApplicabilityLevel.FLOOR;

    if (applicability === QualityApplicabilityLevel.FLOOR) {
      if (epsNode.type !== EpsNodeType.FLOOR) {
        throw new BadRequestException(
          'Activity is FLOOR level. Please select a FLOOR node to raise RFI.',
        );
      }
    } else if (applicability === QualityApplicabilityLevel.UNIT) {
      if (![EpsNodeType.FLOOR, EpsNodeType.UNIT].includes(epsNode.type)) {
        throw new BadRequestException(
          'Activity is UNIT level. Please select a FLOOR/UNIT context to raise RFI.',
        );
      }
      if (!dto.qualityUnitId) {
        throw new BadRequestException(
          'Unit-level activity requires qualityUnitId while raising RFI.',
        );
      }
    } else if (applicability === QualityApplicabilityLevel.ROOM) {
      if (
        ![EpsNodeType.FLOOR, EpsNodeType.UNIT, EpsNodeType.ROOM].includes(
          epsNode.type,
        )
      ) {
        throw new BadRequestException(
          'Activity is ROOM level. Please select a FLOOR/UNIT/ROOM context to raise RFI.',
        );
      }
      if (!dto.qualityUnitId || !dto.qualityRoomId) {
        throw new BadRequestException(
          'Room-level activity requires qualityUnitId and qualityRoomId while raising RFI.',
        );
      }
    }

    const floorScope = await this.resolveFloorVisibilityScope(epsNode);
    if (
      !this.isActivityVisibleForFloorScope(activity.floorVisibility, floorScope)
    ) {
      throw new BadRequestException(
        'This activity is not configured to be visible for the selected floor.',
      );
    }

    const requestedPartNo = dto.partNo || dto.goNo || 1;

    const effectiveChecklistIds =
      activity.assignedChecklistIds && activity.assignedChecklistIds.length > 0
        ? activity.assignedChecklistIds
        : activity.checklistTemplateId
          ? [activity.checklistTemplateId]
          : [];

    await this.assertInspectionGoScopeAvailable(dto, requestedPartNo);

    // 3. CHECKLIST VERIFICATION (mandatory before RFI)
    if (effectiveChecklistIds.length === 0) {
      throw new BadRequestException(
        'At least one checklist must be assigned to the activity before raising an RFI.',
      );
    }

    // 4. SEQUENCE ENFORCEMENT
    if (activity.previousActivityId) {
      const allowed = await this.checkPredecessor(
        activity.previousActivityId,
        dto.epsNodeId,
        floorScope,
      );

      if (!allowed.approved && !activity.allowBreak) {
        throw new BadRequestException(
          `Cannot raise RFI. Predecessor activity "${allowed.activityName}" is not yet APPROVED.`,
        );
      }
    }

    // 5. Update Activity Status to RFI_RAISED
    activity.status = QualityActivityStatus.RFI_RAISED;
    await this.activityRepo.save(activity);

    // 6. Resolve Vendor Information
    let finalVendorId = dto.vendorId;
    let finalVendorName = dto.vendorName;

    if (userId) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (user?.isTempUser) {
        // Auto-capture vendor for temporary users
        const tempUser = await this.tempUserRepo.findOne({
          where: { user: { id: userId } },
          relations: ['vendor'],
        });
        if (tempUser?.vendor) {
          finalVendorId = tempUser.vendor.id;
          finalVendorName = tempUser.vendor.name;
        }
      } else if (dto.vendorId && !finalVendorName) {
        // Fetch name for manually selected vendor if not provided
        const vendor = await this.vendorRepo.findOne({
          where: { id: dto.vendorId },
        });
        if (vendor) {
          finalVendorName = vendor.name;
        }
      }
    }

    const processCode = this.deriveInspectionProcessCode(dto);
    const documentType = this.deriveInspectionDocumentType(dto, applicability);
    const { goNo, goLabel } = this.deriveGoFields(dto, applicability);
    const locationPath =
      dto.locationPath?.trim() ||
      dto.locationLabel?.trim() ||
      (await this.buildEpsLocationPath(dto.epsNodeId));
    const relatedChecklistInspectionIds =
      await this.validateRelatedChecklistInspectionIds(dto);
    await this.attachmentService.validateDrafts(
      dto.projectId,
      dto.attachmentDraftIds,
      userId,
    );
    const requestDate = await this.resolveRfiRequestDate(
      dto.projectId,
      dto.requestDate,
    );

    // 7. Create Inspection
    const inspection = this.inspectionRepo.create({
      projectId: dto.projectId,
      epsNodeId: dto.epsNodeId,
      locationPath: locationPath || null,
      listId: activity.listId,
      activityId: dto.activityId,
      sequence: activity.sequence,
      qualityUnitId: dto.qualityUnitId,
      qualityRoomId: dto.qualityRoomId,
      partNo: requestedPartNo,
      totalParts: dto.totalParts || 1,
      partLabel:
        dto.partLabel ||
        ((dto.totalParts || 1) > 1 ? `GO ${requestedPartNo}` : null),
      goNo,
      goLabel,
      goDetails: dto.goDetails?.trim() || null,
      relatedChecklistInspectionIds,
      comments: dto.comments,
      requestDate,
      status: InspectionStatus.PENDING,
      requestedById: userId,
      vendorId: finalVendorId,
      vendorName: finalVendorName,
      drawingNo: dto.drawingNo.trim(),
      elementName: dto.elementName?.trim() || null,
      contractorName: dto.contractorName ?? finalVendorName,
      processCode,
      documentType,
    });

    // Ensure listId matches activity
    inspection.listId = activity.listId;

    const savedInspection = await this.inspectionRepo.save(inspection);
    await this.attachmentService.bindDrafts(
      savedInspection,
      dto.attachmentDraftIds,
      userId,
    );

    // 7. Initialize Stages from ALL assigned checklists
    if (effectiveChecklistIds.length > 0) {
      const templates = await this.checklistTemplateRepo.find({
        where: { id: In(effectiveChecklistIds) },
        relations: ['stages', 'stages.items'],
      });

      for (const template of templates) {
        if (!template.stages) continue;
        let isFirstStageForSignature = true;

        for (const stageTemplate of template.stages) {
          const stage = this.stageRepo.create({
            inspectionId: savedInspection.id,
            stageTemplateId: stageTemplate.id,
            status: StageStatus.PENDING,
          });
          const savedStage = await this.stageRepo.save(stage);

          // Initialize items for each stage
          const items: any[] = [];
          if (stageTemplate.items) {
            for (const itemTemplate of stageTemplate.items) {
              const item = this.executionItemRepo.create({
                stageId: savedStage.id,
                itemTemplateId: itemTemplate.id,
                isOk: false,
              });
              items.push(await this.executionItemRepo.save(item));
            }
          }

          // If signature provided during RFI creation, save it to the FIRST stage
          if (dto.signature && isFirstStageForSignature) {
            const fingerprint = this.complianceService.generateFingerprint({
              stageId: savedStage.id,
              items: items,
              metadata: {
                timestamp: new Date(),
                user:
                  dto.signature.signedBy ||
                  (userId ? String(userId) : 'Unknown'),
              },
            });
            const signature = this.signatureRepo.create({
              stageId: savedStage.id,
              role: dto.signature.role || 'Site Engineer',
              signedBy:
                dto.signature.signedBy || (userId ? String(userId) : 'Unknown'),
              signatureData: dto.signature.data,
              lockHash: fingerprint,
              metadata: { timestamp: new Date() },
            });
            await this.signatureRepo.save(signature);
            isFirstStageForSignature = false;
          }
        }
      }
    }

    // 8. Transition Activity to UNDER_INSPECTION once stages are ready
    await this.activityRepo.update(activity.id, {
      status: QualityActivityStatus.UNDER_INSPECTION,
    });

    // 9. Start Approval Workflow if template exists
    // The workflow service handles project-scoped notifications internally —
    // it notifies ONLY users assigned to THIS project with the matching workflow role.
    // No separate global notification needed here.
    await this.inspectionWorkflowService.startWorkflowForInspection(
      savedInspection.id,
      activity.listId,
      dto.projectId,
      userId || 0,
    );

    return this.inspectionRepo.findOne({
      where: { id: savedInspection.id },
      relations: ['stages', 'stages.items'],
    });
  }

  async updateStageStatus(
    stageId: number,
    data: {
      status: StageStatus;
      userId: number;
      isAdmin?: boolean;
      items?: {
        id: number;
        value: string;
        isOk: boolean;
        remarks?: string;
        photos?: string[];
      }[];
      signature?: { data: string; role: string };
      metadata?: any;
    },
  ) {
    const stage = await this.stageRepo.findOne({
      where: { id: stageId },
      relations: ['items', 'inspection', 'stageTemplate'],
    });

    if (!stage) throw new NotFoundException('Stage not found');

    if (stage.isLocked && !data.isAdmin) {
      throw new BadRequestException(
        'This stage is locked after approval. Only admin can edit it.',
      );
    }

    if (
      (data.signature || data.status === StageStatus.APPROVED) &&
      data.userId
    ) {
      await this.inspectionWorkflowService.assertUserCanApproveInspectionStep(
        stage.inspection.id,
        Number(data.userId),
        !!data.isAdmin,
      );
    }

    const effectiveItems = data.items || stage.items || [];
    const checkedItemsCount = effectiveItems.filter(
      (item) =>
        item?.isOk === true ||
        String(item?.isOk) === 'true' ||
        item?.value === 'YES' ||
        item?.value === 'NA',
    ).length;

    // 1. Update Items
    if (data.items && stage.items) {
      for (const itemUpdate of data.items) {
        const isOkParsed =
          itemUpdate.isOk === true || String(itemUpdate.isOk) === 'true';

        const normalizedPhotos = toRelativePaths(itemUpdate.photos);

        // Update DB directly
        await this.executionItemRepo.update(itemUpdate.id, {
          value: itemUpdate.value,
          isOk: isOkParsed,
          remarks: itemUpdate.remarks,
          photos: normalizedPhotos,
        });

        // Update in-memory item so that subsequent stageRepo.save(stage)
        // doesn't overwrite DB with stale values due to cascade: true.
        const memItem = stage.items.find((i) => i.id === itemUpdate.id);
        if (memItem) {
          memItem.value = itemUpdate.value ?? '';
          memItem.isOk = isOkParsed;
          memItem.remarks = itemUpdate.remarks ?? '';
          memItem.photos = normalizedPhotos;
        }
      }
    }

    const requestedStatus = data.status;
    const stageWasApproved = stage.status === StageStatus.APPROVED;

    // 2. Update Stage
    stage.status = requestedStatus;
    if (
      requestedStatus === StageStatus.COMPLETED ||
      requestedStatus === StageStatus.APPROVED
    ) {
      stage.completedAt = new Date();
      stage.completedBy = String(data.userId);
    }

    // 3. Handle Signature & Digital Locking
    if (data.signature) {
      if (requestedStatus === StageStatus.APPROVED) {
        const existingStageApproval = await this.signatureRepo.count({
          where: {
            stageId,
            inspectionId: stage.inspection.id,
            actionType: 'STAGE_APPROVE',
            isReversed: false,
          } as any,
        });
        if (existingStageApproval > 0 || stageWasApproved) {
          throw new BadRequestException('Stage is already approved');
        }
      }

      if (requestedStatus !== StageStatus.APPROVED && checkedItemsCount === 0) {
        throw new BadRequestException(
          'Select at least one checklist item before signing work progress.',
        );
      }

      const updatedItems = await this.executionItemRepo.find({
        where: { stageId },
      });
      const fingerprint = this.complianceService.generateFingerprint({
        stageId,
        items: updatedItems,
        metadata: {
          timestamp: new Date(),
          user: String(data.userId),
          gps: data.metadata?.gps,
        },
      });

      const signer = await this.getApproverSnapshot(
        stage.inspection.projectId,
        data.userId,
      );
      const actionType =
        requestedStatus === StageStatus.APPROVED
          ? 'STAGE_APPROVE'
          : 'SAVE_PROGRESS';
      const signature = this.signatureRepo.create({
        stageId,
        inspectionId: stage.inspection.id,
        userId: data.userId,
        signedByUserId: data.userId,
        actionType,
        role: signer.roleLabel || data.signature.role,
        signedBy: String(data.userId),
        signerDisplayName: signer.displayName,
        signerCompany: signer.companyLabel,
        signerRoleLabel: signer.roleLabel || data.signature.role,
        sourceType: signer.sourceType,
        signatureData: data.signature.data,
        lockHash: fingerprint,
        metadata: {
          timestamp: new Date(),
          gps: data.metadata?.gps,
          ipAddress: data.metadata?.ip,
        },
      });
      await this.signatureRepo.save(signature);
    }

    const savedStage = await this.stageRepo.save(stage);

    // 4. Update Parent Inspection Status
    if (
      data.status === StageStatus.APPROVED ||
      data.status === StageStatus.COMPLETED ||
      data.status === StageStatus.IN_PROGRESS
    ) {
      const parentInspection = await this.inspectionRepo.findOne({
        where: { id: stage.inspection.id },
        relations: ['stages'],
      });

      if (parentInspection && parentInspection.stages) {
        const allCompleted = parentInspection.stages.every(
          (s) =>
            s.status === StageStatus.APPROVED ||
            s.status === StageStatus.COMPLETED,
        );
        const someCompleted = parentInspection.stages.some(
          (s) =>
            s.status === StageStatus.APPROVED ||
            s.status === StageStatus.COMPLETED ||
            s.status === StageStatus.IN_PROGRESS,
        );

        if (allCompleted || someCompleted) {
          if (parentInspection.status === InspectionStatus.PENDING) {
            parentInspection.status = InspectionStatus.PARTIALLY_APPROVED;
            await this.inspectionRepo.save(parentInspection);
          }
        }
      }
    }

    return savedStage;
  }

  async updateStatus(
    id: number,
    dto: UpdateInspectionStatusDto,
    userId?: string,
  ) {
    const inspection = await this.inspectionRepo.findOne({
      where: { id },
      relations: ['stages', 'stages.items', 'stages.items.itemTemplate'],
    });
    if (!inspection) throw new NotFoundException('Inspection not found');

    if (
      dto.status === InspectionStatus.REJECTED &&
      (inspection.status === InspectionStatus.APPROVED || inspection.isLocked)
    ) {
      throw new BadRequestException(
        'Final approved checklist cannot be rejected. Only admin can reverse or delete it.',
      );
    }

    if (dto.status === InspectionStatus.APPROVED) {
      // Validate all checklist items are checked (isOk === true)
      let allItemsChecked = true;
      let hasItems = false;
      const failingItems: { itemId: number; itemText?: string }[] = [];

      if (inspection.stages && inspection.stages.length > 0) {
        for (const stage of inspection.stages) {
          if (stage.items && stage.items.length > 0) {
            hasItems = true;
            for (const item of stage.items) {
              if (item.isOk !== true) {
                allItemsChecked = false;
                failingItems.push({
                  itemId: item.id,
                  itemText: item.itemTemplate?.itemText,
                });
              }
            }
          }
        }
      }

      if (hasItems && !allItemsChecked) {
        console.error(
          'Approval validation failed for inspection',
          id,
          'Failing items:',
          failingItems,
        );
        throw new BadRequestException(
          `Cannot approve RFI. All checklist items must be verified and checked. (Failed: ${failingItems.length} items)`,
        );
      }

      await this.ensureNoUnresolvedInspectionObservations(
        inspection.id,
        'Close all observations linked to this RFI before approving it.',
      );
    }

    inspection.status = dto.status;
    if (dto.comments) inspection.comments = dto.comments;
    if (dto.inspectedBy) inspection.inspectedBy = dto.inspectedBy;

    if (
      dto.status === InspectionStatus.APPROVED ||
      dto.status === InspectionStatus.REJECTED
    ) {
      inspection.inspectionDate =
        dto.inspectionDate || new Date().toISOString().split('T')[0];
    }

    const saved = await this.inspectionRepo.save(inspection);
    if (saved.status === InspectionStatus.APPROVED) {
      await this.attachmentService.lockForInspection(saved.id);
    }

    // ─── Audit Logging ──────────────────────────────────────────────────
    if (
      dto.status === InspectionStatus.APPROVED ||
      dto.status === InspectionStatus.REJECTED
    ) {
      await this.auditService.log(
        userId ? parseInt(userId, 10) : 0,
        'QUALITY',
        dto.status === InspectionStatus.APPROVED ? 'APPROVE_RFI' : 'REJECT_RFI',
        String(inspection.id),
        inspection.epsNodeId,
        {
          activity: inspection.activityId,
          comments: dto.comments,
          inspectedBy: dto.inspectedBy,
          date: inspection.inspectionDate,
        },
      );

      // Notify the person who raised the RFI (fire-and-forget)
      if (inspection.requestedById) {
        const resultLabel =
          dto.status === InspectionStatus.APPROVED
            ? 'RFI Approved'
            : 'RFI Rejected';
        const notification =
          await this.notificationComposer.composeInspectionDecision({
            projectId: inspection.projectId,
            epsNodeId: inspection.epsNodeId,
            activityId: inspection.activityId,
            inspectionId: inspection.id,
            decisionLabel: resultLabel,
            comments: dto.comments,
          });
        this.pushService
          .sendToProjectUsers(
            inspection.projectId,
            [inspection.requestedById],
            notification.title,
            notification.body,
            {
              inspectionId: String(id),
              type: dto.status,
              ...notification.data,
            },
          )
          .catch(() => {
            /* non-fatal */
          });
      }
    }

    return saved;
  }

  // ─── Stage-wise Approval Pipeline ─────────────────────────────────────────

  private async assertRequiredCardsBeforeStageApproval(
    stage: QualityInspectionStage,
  ): Promise<void> {
    const activity = (stage.inspection as any)?.activity;
    if (!activity?.requiresPourCard && !activity?.requiresPourClearanceCard) {
      return;
    }

    const stages = await this.stageRepo.find({
      where: { inspectionId: stage.inspectionId },
      relations: ['stageTemplate'],
    });
    const [pourCard, prePourClearance] = await Promise.all([
      this.pourCardRepo.findOne({ where: { inspectionId: stage.inspectionId } }),
      this.prePourClearanceRepo.findOne({
        where: { inspectionId: stage.inspectionId },
      }),
    ]);
    const gateSummary = this.buildCardGateSummary(
      activity,
      stages,
      pourCard,
      prePourClearance,
      stage,
    );

    if (gateSummary.stageApprovalBlockers.length > 0) {
      throw new BadRequestException(
        gateSummary.stageApprovalBlockers.join(' '),
      );
    }
  }

  private isCardSubmitted(card?: { status?: QualityCardStatus | string } | null) {
    return Boolean(
      card &&
        [
          QualityCardStatus.SUBMITTED,
          QualityCardStatus.APPROVED,
          QualityCardStatus.LOCKED,
        ].includes(card.status as QualityCardStatus),
    );
  }

  private isCardApproved(card?: { status?: QualityCardStatus | string } | null) {
    return Boolean(
      card &&
        [QualityCardStatus.APPROVED, QualityCardStatus.LOCKED].includes(
          card.status as QualityCardStatus,
        ),
    );
  }

  private getPrePourClearanceApprovalRequirement(activity: any) {
    return String(
      activity?.prePourClearanceApprovalRequirement || 'SUBMITTED',
    ).toUpperCase() === 'APPROVED'
      ? 'APPROVED'
      : 'SUBMITTED';
  }

  private isPrePourClearanceGateSatisfied(
    requirement: 'SUBMITTED' | 'APPROVED',
    submitted: boolean,
    approved: boolean,
  ) {
    return requirement === 'APPROVED' ? approved : submitted;
  }

  private getStageSequence(stage: any, fallback: number) {
    const sequence = Number(stage?.stageTemplate?.sequence);
    return Number.isFinite(sequence) ? sequence : fallback;
  }

  private getTriggerStageMeta(stages: any[], triggerStageTemplateId?: number | null) {
    const normalizedTriggerId = Number(triggerStageTemplateId);
    if (!Number.isFinite(normalizedTriggerId) || normalizedTriggerId <= 0) {
      return {
        stage: null as any,
        sequence: null as number | null,
        approved: false,
        name: null as string | null,
      };
    }

    const sortedStages = [...(stages || [])].sort(
      (a, b) => this.getStageSequence(a, 0) - this.getStageSequence(b, 0),
    );
    const index = sortedStages.findIndex(
      (stage) => Number(stage.stageTemplateId) === normalizedTriggerId,
    );
    const stage = index >= 0 ? sortedStages[index] : null;
    const approved = Boolean(
      stage?.stageApproval?.fullyApproved ||
        stage?.status === StageStatus.APPROVED ||
        stage?.isLocked,
    );

    return {
      stage,
      sequence: stage ? this.getStageSequence(stage, index) : null,
      approved,
      name: stage?.stageTemplate?.name || null,
    };
  }

  private isStageAfterTrigger(
    stages: any[],
    currentStage: any,
    triggerSequence: number | null,
    activateImmediately: boolean,
  ) {
    const sortedStages = [...(stages || [])].sort(
      (a, b) => this.getStageSequence(a, 0) - this.getStageSequence(b, 0),
    );
    const currentIndex = sortedStages.findIndex(
      (stage) => Number(stage.id) === Number(currentStage?.id),
    );
    const currentSequence = this.getStageSequence(
      currentStage,
      currentIndex >= 0 ? currentIndex : 0,
    );
    return activateImmediately
      ? true
      : triggerSequence != null && currentSequence > triggerSequence;
  }

  private isLastChecklistStage(stages: any[], currentStage: any) {
    const sortedStages = [...(stages || [])].sort(
      (a, b) => this.getStageSequence(a, 0) - this.getStageSequence(b, 0),
    );
    const lastStage = sortedStages[sortedStages.length - 1];
    return Boolean(lastStage && Number(lastStage.id) === Number(currentStage?.id));
  }

  private buildCardGateSummary(
    activity: any,
    stages: any[],
    pourCard: QualityPourCard | null,
    prePourClearance: QualityPrePourClearanceCard | null,
    currentStage?: any | null,
  ) {
    const requiresPourCard = Boolean(activity?.requiresPourCard);
    const requiresPrePourClearance = Boolean(
      activity?.requiresPourClearanceCard,
    );
    const pourCardTrigger = this.getTriggerStageMeta(
      stages,
      activity?.pourCardTriggerStageTemplateId,
    );
    const clearanceTrigger = this.getTriggerStageMeta(
      stages,
      activity?.pourClearanceTriggerStageTemplateId,
    );
    const pourCardActivatesImmediately =
      requiresPourCard && !activity?.pourCardTriggerStageTemplateId;
    const pourCardActive =
      requiresPourCard &&
      (pourCardActivatesImmediately || pourCardTrigger.approved);
    const prePourClearanceActive =
      requiresPrePourClearance && clearanceTrigger.approved;
    const pourCardSubmitted = this.isCardSubmitted(pourCard);
    const pourCardApproved = this.isCardApproved(pourCard);
    const prePourClearanceSubmitted =
      this.isCardSubmitted(prePourClearance);
    const prePourClearanceApproved = this.isCardApproved(prePourClearance);
    const prePourClearanceApprovalRequirement =
      this.getPrePourClearanceApprovalRequirement(activity);
    const prePourClearanceGateSatisfied =
      this.isPrePourClearanceGateSatisfied(
        prePourClearanceApprovalRequirement,
        prePourClearanceSubmitted,
        prePourClearanceApproved,
      );

    const stageApprovalBlockers: string[] = [];
    const isLastStage = currentStage
      ? this.isLastChecklistStage(stages, currentStage)
      : false;

    if (
      currentStage &&
      requiresPrePourClearance &&
      prePourClearanceActive &&
      this.isStageAfterTrigger(
        stages,
        currentStage,
        clearanceTrigger.sequence,
        false,
      ) &&
      !prePourClearanceGateSatisfied
    ) {
      stageApprovalBlockers.push(
        prePourClearanceApprovalRequirement === 'APPROVED'
          ? 'Pre-pour clearance card approval is required before approving this stage.'
          : 'Pre-pour clearance card submission is required before approving this stage.',
      );
    }

    if (
      currentStage &&
      requiresPourCard &&
      pourCardActive &&
      this.isStageAfterTrigger(
        stages,
        currentStage,
        pourCardTrigger.sequence,
        pourCardActivatesImmediately,
      ) &&
      !pourCardSubmitted
    ) {
      stageApprovalBlockers.push(
        'Pour card submission is required before approving this stage.',
      );
    }

    if (
      currentStage &&
      isLastStage &&
      requiresPourCard &&
      !pourCardApproved
    ) {
      stageApprovalBlockers.push(
        'Pour card approval is required before final checklist stage approval.',
      );
    }

    const finalApprovalBlockers: string[] = [];
    if (requiresPourCard && !pourCardApproved) {
      finalApprovalBlockers.push(
        'Pour card approval is required before final checklist approval.',
      );
    }
    if (
      requiresPrePourClearance &&
      prePourClearanceActive &&
      !prePourClearanceGateSatisfied
    ) {
      finalApprovalBlockers.push(
        prePourClearanceApprovalRequirement === 'APPROVED'
          ? 'Pre-pour clearance card approval is required before final checklist approval.'
          : 'Pre-pour clearance card submission is required before final checklist approval.',
      );
    }

    return {
      requiresPourCard,
      requiresPrePourClearance,
      pourCardStatus: pourCard?.status || null,
      pourCardSubmitted,
      pourCardApproved,
      pourCardTriggerStageTemplateId:
        activity?.pourCardTriggerStageTemplateId ?? null,
      pourCardTriggerStageName: pourCardTrigger.name,
      pourCardTriggerApproved:
        pourCardActivatesImmediately || pourCardTrigger.approved,
      pourCardActive,
      pourCardActivationMode: pourCardActivatesImmediately
        ? 'IMMEDIATE'
        : 'AFTER_STAGE',
      prePourClearanceStatus: prePourClearance?.status || null,
      prePourClearanceSubmitted,
      prePourClearanceApproved,
      prePourClearanceApprovalRequirement,
      prePourClearanceGateSatisfied,
      prePourClearanceTriggerStageTemplateId:
        activity?.pourClearanceTriggerStageTemplateId ?? null,
      prePourClearanceTriggerStageName: clearanceTrigger.name,
      prePourClearanceTriggerApproved: clearanceTrigger.approved,
      prePourClearanceActive,
      stageApprovalBlockers,
      finalApprovalBlockers,
    };
  }

  async approveStage(
    inspectionId: number,
    stageId: number,
    userId: number,
    signatureData?: string,
    comments?: string,
    isAdmin: boolean = false,
    signatureEvidence?: Record<string, unknown>,
  ) {
    const stage = await this.stageRepo.findOne({
      where: { id: stageId, inspectionId },
      relations: [
        'inspection',
        'inspection.activity',
        'stageTemplate',
        'items',
        'signatures',
      ],
    });
    if (!stage)
      throw new NotFoundException('Stage not found for this inspection');

    if (!signatureData) {
      throw new BadRequestException(
        'A digital signature is required for stage approval',
      );
    }

    const incompleteItems = (stage.items || []).filter(
      (item) =>
        item?.value !== 'YES' && item?.value !== 'NA' && item?.isOk !== true,
    );
    if (incompleteItems.length > 0) {
      throw new BadRequestException(
        'All checklist items in the stage must be checked before stage approval.',
      );
    }

    await this.ensureNoUnresolvedInspectionObservations(
      inspectionId,
      'Close all observations linked to this RFI before approving further.',
      stageId,
      'Close all observations linked to this stage before approving it.',
    );

    await this.assertRequiredCardsBeforeStageApproval(stage);

    const run = await this.inspectionWorkflowService.getOrStartWorkflowState(
      inspectionId,
      userId,
    );
    if (!run) {
      throw new NotFoundException(
        'Workflow is not configured for this inspection',
      );
    }

    const sortedSteps = [...(run.steps || [])].sort(
      (a, b) => a.stepOrder - b.stepOrder,
    );
    if (sortedSteps.length === 0) {
      const existingLegacyApproval = this.getActiveStageApprovalSignatures(
        stage,
      ).find((signature: any) => signature.approvalLevelOrder == null);
      if (existingLegacyApproval || stage.status === StageStatus.APPROVED) {
        throw new BadRequestException('Stage is already approved');
      }

      const signer = await this.getApproverSnapshot(
        stage.inspection.projectId,
        userId,
      );
      const now = await this.resolveRfiApprovalTimestamp(
        stage.inspection.projectId,
        signatureEvidence?.approvalDate,
      );
      const actualSignedAt = new Date();
      stage.completedAt = now;
      stage.completedBy = String(userId);

      const fingerprint = this.complianceService.generateFingerprint({
        stageId,
        items: stage.items || [],
        metadata: { timestamp: now, user: String(userId) },
      });
      const approvalEntity = this.signatureRepo.create({
        stageId,
        inspectionId,
        workflowStepId: undefined,
        approvalLevelOrder: undefined,
        approvalLevelName: 'Direct Stage Approval',
        approvalAssignedUserId: undefined,
        approvalAssignedRoleId: undefined,
        isAutoInherited: false,
        inheritedFromStepOrder: undefined,
        userId,
        signedByUserId: userId,
        actionType: 'STAGE_APPROVE',
        role: signer.roleLabel || (isAdmin ? 'Admin' : 'Approver'),
        signedBy: String(userId),
        signerDisplayName: signer.displayName,
        signerCompany: signer.companyLabel,
        signerRoleLabel: signer.roleLabel || (isAdmin ? 'Admin' : 'Approver'),
        sourceType: signer.sourceType,
        signatureData,
        lockHash: fingerprint,
        createdAt: now,
        metadata: this.buildRfiSignatureMetadata(now, actualSignedAt, signatureEvidence, {
          identityBound: true,
          signatureMode:
            (signatureEvidence?.mode as string | undefined) || 'UNKNOWN',
          directStageApproval: true,
        }) as any,
      });
      const approval = await this.signatureRepo.save(approvalEntity);

      stage.signatures = [...(stage.signatures || []), approval];
      stage.status = StageStatus.APPROVED;
      stage.isLocked = true;
      stage.lockedAt = now;
      stage.lockedByUserId = userId;
      await this.stageRepo.save(stage);

      const inspection = await this.inspectionRepo.findOne({
        where: { id: inspectionId },
        relations: ['stages', 'stages.signatures'],
      });
      if (!inspection) throw new NotFoundException('Inspection not found');

      const totalStages = inspection.stages.length;
      const approvedStages = inspection.stages.filter(
        (inspectionStage: any) =>
          this.buildStageApprovalDetails(inspectionStage, run).fullyApproved,
      ).length;

      if (approvedStages > 0 && approvedStages < totalStages) {
        inspection.status = InspectionStatus.PARTIALLY_APPROVED;
        inspection.isLocked = false;
        inspection.lockedAt = null;
        inspection.lockedByUserId = null;
      } else if (approvedStages === totalStages && totalStages > 0) {
        inspection.status = InspectionStatus.APPROVED;
        inspection.isLocked = true;
        inspection.lockedAt = now;
        inspection.lockedByUserId = userId;
        inspection.inspectionDate = now.toISOString().split('T')[0];
        inspection.inspectedBy = signer.displayName;
      }
      await this.inspectionRepo.save(inspection);
      if (inspection.status === InspectionStatus.APPROVED) {
        await this.attachmentService.lockForInspection(inspection.id);
      }

      await this.auditService.log(
        userId,
        'QUALITY',
        'STAGE_APPROVE',
        String(inspectionId),
        inspection.epsNodeId,
        {
          stageId,
          stageName: stage.stageTemplate?.name,
          comments,
          signer: signer.displayName,
          company: signer.companyLabel,
          role: signer.roleLabel,
          directStageApproval: true,
        },
      );

      return {
        success: true,
        approvedStages,
        totalStages,
        inspectionStatus: inspection.status,
        signer,
        stageApproval: this.buildStageApprovalDetails(stage, run),
      };
    }

    const eligibleSteps =
      await this.inspectionWorkflowService.getEligibleApprovalStepsForUser(
        inspectionId,
        userId,
        isAdmin,
      );
    if (eligibleSteps.length === 0) {
      throw new BadRequestException(
        'You are not assigned to any approval level for this inspection.',
      );
    }

    const highestEligibleStep = eligibleSteps[eligibleSteps.length - 1];
    const candidateSteps = sortedSteps.filter(
      (step) => step.stepOrder <= highestEligibleStep.stepOrder,
    );
    const existingApprovals = this.getActiveStageApprovalSignatures(stage);
    const existingLevelOrders = new Set(
      existingApprovals
        .map((signature: any) => Number(signature.approvalLevelOrder))
        .filter((value) => Number.isFinite(value) && value > 0),
    );
    const missingSteps = candidateSteps.filter(
      (step) => !existingLevelOrders.has(step.stepOrder),
    );
    if (missingSteps.length === 0) {
      const currentStageDetails = this.buildStageApprovalDetails(stage, run);
      throw new BadRequestException(
        currentStageDetails.fullyApproved
          ? 'Stage is already approved at all levels'
          : 'Your approval levels are already recorded for this stage.',
      );
    }

    const signer = await this.getApproverSnapshot(
      stage.inspection.projectId,
      userId,
    );

    const now = await this.resolveRfiApprovalTimestamp(
      stage.inspection.projectId,
      signatureEvidence?.approvalDate,
    );
    const actualSignedAt = new Date();
    stage.completedAt = now;
    stage.completedBy = String(userId);

    const fingerprint = this.complianceService.generateFingerprint({
      stageId,
      items: stage.items || [],
      metadata: { timestamp: now, user: String(userId) },
    });
    const createdApprovals = await this.signatureRepo.save(
      missingSteps.map((step) =>
        this.signatureRepo.create({
          stageId,
          inspectionId,
          workflowStepId: step.id,
          approvalLevelOrder: step.stepOrder,
          approvalLevelName: step.stepName || `Level ${step.stepOrder}`,
          approvalAssignedUserId: step.assignedUserId ?? null,
          approvalAssignedRoleId: step.assignedRoleId ?? null,
          isAutoInherited: step.stepOrder < highestEligibleStep.stepOrder,
          inheritedFromStepOrder:
            step.stepOrder < highestEligibleStep.stepOrder
              ? highestEligibleStep.stepOrder
              : null,
          userId,
          signedByUserId: userId,
          actionType: 'STAGE_APPROVE',
          role: signer.roleLabel || step.stepName || 'Approver',
          signedBy: String(userId),
          signerDisplayName: signer.displayName,
          signerCompany: signer.companyLabel,
          signerRoleLabel: signer.roleLabel || step.stepName,
          sourceType: signer.sourceType,
          signatureData,
          lockHash: fingerprint,
          createdAt: now,
          metadata: this.buildRfiSignatureMetadata(now, actualSignedAt, signatureEvidence, {
            identityBound: true,
            signatureMode:
              (signatureEvidence?.mode as string | undefined) || 'UNKNOWN',
          }) as any,
        }),
      ),
    );
    stage.signatures = [...(stage.signatures || []), ...createdApprovals];

    const stageApprovalDetails = this.buildStageApprovalDetails(stage, run);
    stage.status = stageApprovalDetails.fullyApproved
      ? StageStatus.APPROVED
      : StageStatus.COMPLETED;
    stage.isLocked = stageApprovalDetails.fullyApproved;
    stage.lockedAt = stageApprovalDetails.fullyApproved ? now : null;
    stage.lockedByUserId = stageApprovalDetails.fullyApproved ? userId : null;
    await this.stageRepo.save(stage);

    // Recount stages and update parent inspection status
    const inspection = await this.inspectionRepo.findOne({
      where: { id: inspectionId },
      relations: ['stages', 'stages.signatures'],
    });
    if (!inspection) throw new NotFoundException('Inspection not found');

    const totalStages = inspection.stages.length;
    const approvedStages = inspection.stages.filter(
      (inspectionStage: any) =>
        this.buildStageApprovalDetails(inspectionStage, run).fullyApproved,
    ).length;

    if (approvedStages > 0 && approvedStages < totalStages) {
      inspection.status = InspectionStatus.PARTIALLY_APPROVED;
      inspection.isLocked = false;
      inspection.lockedAt = null;
      inspection.lockedByUserId = null;
    } else if (approvedStages === totalStages && totalStages > 0) {
      inspection.status = InspectionStatus.APPROVED;
      inspection.isLocked = true;
      inspection.lockedAt = now;
      inspection.lockedByUserId = userId;
      inspection.inspectionDate = now.toISOString().split('T')[0];
      inspection.inspectedBy = signer.displayName;
    }
    await this.inspectionRepo.save(inspection);
    if (inspection.status === InspectionStatus.APPROVED) {
      await this.attachmentService.lockForInspection(inspection.id);
    }

    if (approvedStages === totalStages && totalStages > 0 && run) {
      run.status = WorkflowRunStatus.COMPLETED as any;
      await this.workflowRunRepo.save(run);
    }

    if (inspection.status === InspectionStatus.APPROVED) {
      await this.customerMilestoneService.handleQualityApproval(inspection);
    }

    // Audit
    await this.auditService.log(
      userId,
      'QUALITY',
      'STAGE_APPROVE',
      String(inspectionId),
      inspection.epsNodeId,
      {
        stageId,
        stageName: stage.stageTemplate?.name,
        comments,
        signer: signer.displayName,
        company: signer.companyLabel,
        role: signer.roleLabel,
        appliedApprovalLevels: missingSteps.map((step) => ({
          stepOrder: step.stepOrder,
          stepName: step.stepName,
          autoInherited: step.stepOrder < highestEligibleStep.stepOrder,
        })),
      },
    );

    // Notify next approvers for this stage based on the next missing level
    const nextPendingLevel = stageApprovalDetails.pendingLevels?.[0] || null;
    if (nextPendingLevel) {
      const eligibleActors = await this.approvalRuntimeService.getProjectActors(
        stage.inspection.projectId,
      );
      const nextUserIds = nextPendingLevel.assignedUserIds?.length
        ? nextPendingLevel.assignedUserIds
        : nextPendingLevel.assignedUserId
          ? [nextPendingLevel.assignedUserId]
          : [];
      const nextRoleUserIds = nextPendingLevel.assignedRoleId
        ? eligibleActors
            .filter((actor) =>
              actor.projectRoleIds.includes(nextPendingLevel.assignedRoleId),
            )
            .map((actor) => actor.userId)
        : [];
      const notifyUserIds = Array.from(
        new Set([...nextUserIds, ...nextRoleUserIds]),
      );
      if (notifyUserIds.length > 0) {
        const notification =
          await this.notificationComposer.composeInspectionApprovalRequired({
            projectId: stage.inspection.projectId,
            epsNodeId: stage.inspection.epsNodeId,
            activityId: stage.inspection.activityId,
            inspectionId,
            stageName: stage.stageTemplate?.name,
            levelLabel: `Level ${nextPendingLevel.stepOrder}`,
          });
        this.pushService
          .sendToProjectUsers(
            stage.inspection.projectId,
            notifyUserIds,
            notification.title,
            notification.body,
            {
              inspectionId: String(inspectionId),
              stageId: String(stageId),
              type: 'STAGE_LEVEL_PENDING',
              ...notification.data,
            },
          )
          .catch(() => {
            /* non-fatal */
          });
      }
    }

    // Notify RFI raiser of progress
    if (inspection.requestedById) {
      const notification =
        await this.notificationComposer.composeInspectionDecision({
          projectId: inspection.projectId,
          epsNodeId: inspection.epsNodeId,
          activityId: inspection.activityId,
          inspectionId,
          decisionLabel:
            approvedStages === totalStages && totalStages > 0
              ? 'Checklist Approved'
              : 'Stage Approved',
          comments:
            approvedStages === totalStages && totalStages > 0
              ? `All stages approved (${approvedStages}/${totalStages}).`
              : `${approvedStages}/${totalStages} stages approved.`,
        });
      this.pushService
        .sendToProjectUsers(
          inspection.projectId,
          [inspection.requestedById],
          notification.title,
          notification.body,
          {
            inspectionId: String(inspectionId),
            stageId: String(stageId),
            type:
              approvedStages === totalStages && totalStages > 0
                ? 'APPROVED'
                : 'STAGE_APPROVED',
            ...notification.data,
          },
        )
        .catch(() => {
          /* non-fatal */
        });
    }

    return {
      success: true,
      approvedStages,
      totalStages,
      inspectionStatus: inspection.status,
      signer,
      stageApproval: stageApprovalDetails,
    };
  }

  async finalApprove(
    inspectionId: number,
    userId: number,
    signatureData?: string,
    comments?: string,
    isAdmin: boolean = false,
    signatureEvidence?: Record<string, unknown>,
  ) {
    const inspection = await this.inspectionRepo.findOne({
      where: { id: inspectionId },
      relations: [
        'activity',
        'stages',
        'stages.stageTemplate',
        'stages.signatures',
      ],
    });
    if (!inspection) throw new NotFoundException('Inspection not found');

    const run = await this.inspectionWorkflowService.getOrStartWorkflowState(
      inspectionId,
      userId,
    );
    const pendingStages = inspection.stages
      .map((stage) => ({
        stage,
        details: this.buildStageApprovalDetails(stage, run),
      }))
      .filter(({ details }) => !details.fullyApproved);

    if (pendingStages.length > 0) {
      const pendingNames = pendingStages
        .map(
          ({ stage, details }) =>
            `${stage.stageTemplate?.name || `Stage #${stage.id}`}${
              details.pendingDisplay ? ` (${details.pendingDisplay})` : ''
            }`,
        )
        .join(', ');
      throw new BadRequestException(
        `Cannot give final approval. The following stages are not yet approved: ${pendingNames}`,
      );
    }

    // Already approved
    if (inspection.status === InspectionStatus.APPROVED) {
      throw new BadRequestException('Inspection is already fully approved');
    }
    if (inspection.isLocked && !isAdmin) {
      throw new BadRequestException(
        'Inspection is locked after approval. Only admin can edit it.',
      );
    }
    if (!signatureData) {
      throw new BadRequestException(
        'A digital signature is required for final approval',
      );
    }

    await this.ensureNoUnresolvedInspectionObservations(
      inspectionId,
      'Close all observations linked to this RFI before giving final approval.',
    );

    const [pourCard, prePourClearance] = await Promise.all([
      this.pourCardRepo.findOne({ where: { inspectionId } }),
      this.prePourClearanceRepo.findOne({ where: { inspectionId } }),
    ]);
    const cardGateSummary = this.buildCardGateSummary(
      inspection.activity,
      inspection.stages || [],
      pourCard,
      prePourClearance,
      null,
    );
    if (cardGateSummary.finalApprovalBlockers.length > 0) {
      throw new BadRequestException(
        cardGateSummary.finalApprovalBlockers.join(' '),
      );
    }

    const signer = await this.getApproverSnapshot(inspection.projectId, userId);
    const approvalTimestamp = await this.resolveRfiApprovalTimestamp(
      inspection.projectId,
      signatureEvidence?.approvalDate,
    );
    const actualSignedAt = new Date();

    const fingerprint = this.complianceService.generateFingerprint({
      stageId: 0,
      items: [],
      metadata: { timestamp: approvalTimestamp, user: String(userId) },
    });
    const signature = this.signatureRepo.create({
      inspectionId,
      userId,
      signedByUserId: userId,
      actionType: 'FINAL_APPROVE',
      role: signer.roleLabel || 'Final Authority',
      signedBy: String(userId),
      signerDisplayName: signer.displayName,
      signerCompany: signer.companyLabel,
      signerRoleLabel: signer.roleLabel,
      sourceType: signer.sourceType,
      signatureData,
      lockHash: fingerprint,
      createdAt: approvalTimestamp,
      metadata: this.buildRfiSignatureMetadata(
        approvalTimestamp,
        actualSignedAt,
        signatureEvidence,
        {
        identityBound: true,
        signatureMode:
          (signatureEvidence?.mode as string | undefined) || 'UNKNOWN',
        },
      ) as any,
    });
    await this.signatureRepo.save(signature);

    // Mark as APPROVED
    inspection.status = InspectionStatus.APPROVED;
    inspection.inspectionDate = approvalTimestamp.toISOString().split('T')[0];
    inspection.inspectedBy = signer.displayName;
    inspection.isLocked = true;
    inspection.lockedAt = approvalTimestamp;
    inspection.lockedByUserId = userId;
    if (comments) inspection.comments = comments;
    await this.inspectionRepo.save(inspection);
    await this.attachmentService.lockForInspection(inspection.id);

    // Keep approval response fast; post-commit audit/notification work is non-blocking.
    void this.auditService
      .log(
        userId,
        'QUALITY',
        'FINAL_APPROVE_RFI',
        String(inspectionId),
        inspection.epsNodeId,
        {
          comments,
          signer: signer.displayName,
          company: signer.companyLabel,
          role: signer.roleLabel,
        },
      )
      .catch(() => {
        /* non-fatal */
      });

    // Notify the RFI raiser
    if (inspection.requestedById) {
      void (async () => {
        const notification =
          await this.notificationComposer.composeInspectionDecision({
            projectId: inspection.projectId,
            epsNodeId: inspection.epsNodeId,
            activityId: inspection.activityId,
            inspectionId,
            decisionLabel: 'RFI Approved',
            comments: comments || undefined,
          });
        await this.pushService.sendToProjectUsers(
          inspection.projectId,
          [inspection.requestedById],
          notification.title,
          notification.body,
          {
            inspectionId: String(inspectionId),
            type: 'APPROVED',
            ...notification.data,
          },
        );
      })().catch(() => {
        /* non-fatal */
      });
    }

    return { success: true, status: 'APPROVED' };
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  async reverseStageApproval(
    inspectionId: number,
    stageId: number,
    userId: number,
    reason: string,
    isAdmin: boolean,
  ) {
    if (!isAdmin) {
      throw new BadRequestException('Only admin can reverse stage approvals');
    }

    const stage = await this.stageRepo.findOne({
      where: { id: stageId, inspectionId },
      relations: ['inspection', 'signatures', 'stageTemplate'],
    });
    if (!stage) {
      throw new NotFoundException('Stage not found for this inspection');
    }
    if (stage.inspection?.status === InspectionStatus.APPROVED) {
      throw new BadRequestException(
        'Use final workflow reversal after final approval is completed',
      );
    }

    await this.signatureRepo.update(
      { stageId, actionType: 'STAGE_APPROVE', isReversed: false },
      {
        isReversed: true,
        reversedAt: new Date(),
        reversedByUserId: userId,
        reversalReason: reason,
      },
    );

    const refreshedStage = await this.stageRepo.findOne({
      where: { id: stageId, inspectionId },
      relations: ['inspection', 'items', 'signatures', 'stageTemplate'],
    });
    if (!refreshedStage) {
      throw new NotFoundException('Stage not found after reversal');
    }

    const run = await this.inspectionWorkflowService.getOrStartWorkflowState(
      inspectionId,
      userId,
    );
    const remainingApprovals = this.buildStageApprovalDetails(
      refreshedStage,
      run,
    );
    const checkedItems = (refreshedStage.items || []).filter(
      (item) =>
        item?.value === 'YES' || item?.value === 'NA' || item?.isOk === true,
    ).length;
    const totalItems = refreshedStage.items?.length || 0;

    refreshedStage.status = remainingApprovals.fullyApproved
      ? StageStatus.APPROVED
      : checkedItems === 0
        ? StageStatus.PENDING
        : checkedItems === totalItems && totalItems > 0
          ? StageStatus.COMPLETED
          : StageStatus.IN_PROGRESS;
    refreshedStage.isLocked = remainingApprovals.fullyApproved;
    refreshedStage.lockedAt = remainingApprovals.fullyApproved
      ? new Date()
      : null;
    refreshedStage.lockedByUserId = remainingApprovals.fullyApproved
      ? userId
      : null;
    refreshedStage.completedAt =
      checkedItems > 0 && totalItems > 0 && checkedItems === totalItems
        ? refreshedStage.completedAt || new Date()
        : (null as any);
    refreshedStage.completedBy =
      checkedItems > 0 && totalItems > 0 && checkedItems === totalItems
        ? refreshedStage.completedBy || String(userId)
        : (null as any);
    await this.stageRepo.save(refreshedStage);

    const inspection = await this.inspectionRepo.findOne({
      where: { id: inspectionId },
      relations: ['stages', 'stages.signatures'],
    });
    if (inspection) {
      const approvedStages = (inspection.stages || []).filter(
        (inspectionStage: any) =>
          this.buildStageApprovalDetails(inspectionStage, run).fullyApproved,
      ).length;
      inspection.status =
        approvedStages > 0
          ? InspectionStatus.PARTIALLY_APPROVED
          : InspectionStatus.PENDING;
      inspection.isLocked = false;
      inspection.lockedAt = null;
      inspection.lockedByUserId = null;
      await this.inspectionRepo.save(inspection);
    }

    await this.auditService.log(
      userId,
      'QUALITY',
      'REVERSE_STAGE_APPROVAL',
      String(inspectionId),
      stage.inspection?.epsNodeId,
      { stageId, reason, stageName: stage.stageTemplate?.name },
    );

    return { success: true };
  }

  private async getApproverSnapshot(projectId: number, userId: number) {
    return this.approvalRuntimeService.getSignerSnapshot(projectId, userId);
  }

  private async getUserProjectRoleIds(projectId: number, userId: number) {
    return this.approvalRuntimeService.getProjectRoleIds(projectId, userId);
  }

  private async loadInspectionWithDetails(id: number) {
    return this.inspectionRepo.findOne({
      where: { id },
      relations: [
        'activity',
        'stages',
        'stages.stageTemplate',
        'stages.stageTemplate.template',
        'stages.items',
        'stages.items.itemTemplate',
        'stages.signatures',
      ],
      order: {
        stages: {
          stageTemplate: { sequence: 'ASC' },
          items: { itemTemplate: { sequence: 'ASC' } },
        },
      },
    });
  }

  private normalizeRelatedChecklistInspectionIds(input?: number[]) {
    if (!Array.isArray(input)) {
      return [];
    }
    return Array.from(
      new Set(
        input
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    );
  }

  private async validateRelatedChecklistInspectionIds(
    dto: CreateInspectionDto,
  ) {
    const ids = this.normalizeRelatedChecklistInspectionIds(
      dto.relatedChecklistInspectionIds,
    );
    if (ids.length === 0) {
      return [];
    }

    const related = await this.inspectionRepo.find({
      where: {
        id: In(ids),
        projectId: dto.projectId,
        epsNodeId: dto.epsNodeId,
      },
    });
    const foundIds = new Set(related.map((inspection) => inspection.id));
    const missingIds = ids.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      throw new BadRequestException(
        `Related checklist RFI(s) not found at the selected project location: ${missingIds.join(', ')}.`,
      );
    }
    return ids;
  }

  async updateRelatedChecklistLinks(
    inspectionId: number,
    relatedChecklistInspectionIds?: number[],
  ) {
    const inspection = await this.inspectionRepo.findOne({
      where: { id: inspectionId },
    });
    if (!inspection) throw new NotFoundException('Inspection not found');
    if (inspection.status === InspectionStatus.APPROVED || inspection.isLocked) {
      throw new BadRequestException(
        'Related checklist links cannot be changed after final approval.',
      );
    }

    const ids = this.normalizeRelatedChecklistInspectionIds(
      relatedChecklistInspectionIds,
    );
    if (ids.includes(inspection.id)) {
      throw new BadRequestException('An RFI cannot be linked to itself.');
    }
    if (ids.length) {
      const related = await this.inspectionRepo.find({
        where: {
          id: In(ids),
          projectId: inspection.projectId,
          epsNodeId: inspection.epsNodeId,
        },
      });
      const foundIds = new Set(related.map((item) => item.id));
      const missingIds = ids.filter((id) => !foundIds.has(id));
      if (missingIds.length > 0) {
        throw new BadRequestException(
          `Related checklist RFI(s) not found at the selected project location: ${missingIds.join(', ')}.`,
        );
      }
    }

    inspection.relatedChecklistInspectionIds = ids;
    const saved = await this.inspectionRepo.save(inspection);
    return this.attachRelatedChecklistSummaries(saved);
  }

  private async attachRelatedChecklistSummaries(inspection: any) {
    const ids = this.normalizeRelatedChecklistInspectionIds(
      inspection.relatedChecklistInspectionIds,
    );
    if (ids.length === 0) {
      return { ...inspection, relatedChecklistInspections: [] };
    }

    const related = await this.inspectionRepo.find({
      where: { id: In(ids) },
      relations: ['activity', 'activity.list'],
    });
    const relatedById = new Map(related.map((item) => [item.id, item]));

    return {
      ...inspection,
      relatedChecklistInspections: ids
        .map((id) => relatedById.get(id))
        .filter(Boolean)
        .map((item: any) => ({
          id: item.id,
          activityId: item.activityId,
          activityName: item.activity?.activityName || `RFI #${item.id}`,
          listName: item.activity?.list?.name || null,
          status: item.status,
          requestDate: item.requestDate,
          goNo: item.goNo,
          goLabel: item.goLabel,
          partNo: item.partNo,
          partLabel: item.partLabel,
          drawingNo: item.drawingNo,
          elementName: item.elementName,
          goDetails: item.goDetails,
        })),
    };
  }

  async getRelatedChecklistOptions(
    projectId: number,
    epsNodeId: number,
    excludeInspectionId?: number,
  ) {
    const inspections = await this.inspectionRepo.find({
      where: {
        projectId,
        epsNodeId,
      },
      relations: ['activity', 'activity.list'],
      order: { requestDate: 'DESC', id: 'DESC' },
    });
    const eligible = inspections.filter(
      (inspection) =>
        inspection.id !== excludeInspectionId &&
        inspection.status !== InspectionStatus.CANCELED &&
        inspection.status !== InspectionStatus.REJECTED,
    );
    const checklistIds = Array.from(
      new Set(
        eligible.flatMap((inspection) =>
          this.getEffectiveChecklistIdsForActivity(inspection.activity),
        ),
      ),
    );
    const templates = checklistIds.length
      ? await this.checklistTemplateRepo.find({
          where: { id: In(checklistIds), projectId },
        })
      : [];
    const templateMap = new Map(
      templates.map((template) => [template.id, template]),
    );
    const groups = new Map<string, any>();

    for (const inspection of eligible) {
      const activity = inspection.activity;
      const effectiveIds = this.getEffectiveChecklistIdsForActivity(activity);
      for (const checklistId of effectiveIds) {
        const template = templateMap.get(checklistId);
        if (!template) continue;
        const key = `${checklistId}:${inspection.activityId}`;
        if (!groups.has(key)) {
          groups.set(key, {
            checklistId,
            checklistName: template.name,
            checklistNo: template.checklistNo,
            activityId: inspection.activityId,
            activityName:
              activity?.activityName || `Activity ${inspection.activityId}`,
            listName: activity?.list?.name || null,
            children: [],
          });
        }
        groups.get(key).children.push({
          inspectionId: inspection.id,
          rfiNumber: `RFI #${inspection.id}`,
          goNo: inspection.goNo,
          goLabel:
            inspection.goLabel ||
            inspection.partLabel ||
            `GO ${inspection.partNo || 1}`,
          goDetails: inspection.goDetails,
          elementName: inspection.elementName,
          drawingNo: inspection.drawingNo,
          status: inspection.status,
          requestDate: inspection.requestDate,
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) =>
      `${a.checklistName} ${a.activityName}`.localeCompare(
        `${b.checklistName} ${b.activityName}`,
      ),
    );
  }

  async addGo(dto: Omit<ExpandGoSeriesDto, 'newTotalParts'>) {
    return this.inspectionRepo.manager.transaction(async (manager) => {
      const query = manager
        .getRepository(QualityInspection)
        .createQueryBuilder('inspection')
        .setLock('pessimistic_write')
        .where('inspection.projectId = :projectId', {
          projectId: dto.projectId,
        })
        .andWhere('inspection.epsNodeId = :epsNodeId', {
          epsNodeId: dto.epsNodeId,
        })
        .andWhere('inspection.activityId = :activityId', {
          activityId: dto.activityId,
        });
      if (typeof dto.qualityUnitId === 'number') {
        query.andWhere('inspection.qualityUnitId = :qualityUnitId', {
          qualityUnitId: dto.qualityUnitId,
        });
      }
      if (typeof dto.qualityRoomId === 'number') {
        query.andWhere('inspection.qualityRoomId = :qualityRoomId', {
          qualityRoomId: dto.qualityRoomId,
        });
      }
      const scoped = await query.orderBy('inspection.partNo', 'ASC').getMany();
      if (scoped.length === 0) {
        throw new BadRequestException('Raise GO 1 before adding another GO.');
      }
      const currentTotal = scoped.reduce(
        (max, inspection) =>
          Math.max(max, inspection.totalParts || 1, inspection.partNo || 1),
        1,
      );
      const nextGoNo = currentTotal + 1;
      for (const inspection of scoped) {
        inspection.totalParts = nextGoNo;
      }
      await manager.getRepository(QualityInspection).save(scoped);
      return {
        previousTotalParts: currentTotal,
        newTotalParts: nextGoNo,
        nextGoNo,
        nextGoLabel: `GO ${nextGoNo}`,
      };
    });
  }

  private getEffectiveChecklistIdsForActivity(
    activity?: {
      assignedChecklistIds?: number[];
      checklistTemplateId?: number | null;
    } | null,
  ): number[] {
    if (activity?.assignedChecklistIds?.length) {
      return activity.assignedChecklistIds;
    }
    if (activity?.checklistTemplateId) {
      return [activity.checklistTemplateId];
    }
    return [];
  }

  private async resolveFloorVisibilityScope(epsNode: EpsNode) {
    const scope: { blockId?: number; towerId?: number; floorId?: number } = {};
    let current: EpsNode | null = epsNode;

    while (current) {
      if (current.type === EpsNodeType.FLOOR && !scope.floorId) {
        scope.floorId = current.id;
      }
      if (current.type === EpsNodeType.TOWER && !scope.towerId) {
        scope.towerId = current.id;
      }
      if (current.type === EpsNodeType.BLOCK && !scope.blockId) {
        scope.blockId = current.id;
      }

      if (!current.parentId) break;
      current = await this.epsNodeRepo.findOne({
        where: { id: current.parentId },
      });
    }

    return scope;
  }

  private isActivityVisibleForFloorScope(
    floorVisibility:
      | {
          mode?: 'ALL' | 'RESTRICTED';
          selectedNodeIds?: number[];
        }
      | null
      | undefined,
    scope: { blockId?: number; towerId?: number; floorId?: number } | null,
  ) {
    if (!floorVisibility || floorVisibility.mode !== 'RESTRICTED') {
      return true;
    }
    if (!scope) {
      return true;
    }
    const selectedIds = new Set(floorVisibility.selectedNodeIds || []);
    return [scope.floorId, scope.towerId, scope.blockId].some(
      (id) => typeof id === 'number' && selectedIds.has(id),
    );
  }

  private async materializeInspectionStagesIfMissing(inspection: any) {
    if ((inspection.stages || []).length > 0) {
      return inspection;
    }

    const checklistIds = this.getEffectiveChecklistIdsForActivity(
      inspection.activity,
    );
    if (checklistIds.length === 0) {
      return inspection;
    }

    const existingStageCount = await this.stageRepo.count({
      where: { inspectionId: inspection.id },
    });
    if (existingStageCount > 0) {
      return (
        (await this.loadInspectionWithDetails(inspection.id)) || inspection
      );
    }

    const templates = await this.checklistTemplateRepo.find({
      where: { id: In(checklistIds) },
      relations: ['stages', 'stages.items'],
    });

    for (const template of templates) {
      const orderedStages = [...(template.stages || [])].sort(
        (a, b) => (a.sequence || 0) - (b.sequence || 0),
      );

      for (const stageTemplate of orderedStages) {
        const savedStage = await this.stageRepo.save(
          this.stageRepo.create({
            inspectionId: inspection.id,
            stageTemplateId: stageTemplate.id,
            status: StageStatus.PENDING,
          }),
        );

        const orderedItems = [...(stageTemplate.items || [])].sort(
          (a, b) => (a.sequence || 0) - (b.sequence || 0),
        );
        for (const itemTemplate of orderedItems) {
          await this.executionItemRepo.save(
            this.executionItemRepo.create({
              stageId: savedStage.id,
              itemTemplateId: itemTemplate.id,
              isOk: false,
            }),
          );
        }
      }
    }

    return (await this.loadInspectionWithDetails(inspection.id)) || inspection;
  }

  private matchesStepForUser(
    step:
      | {
          assignedUserId?: number | null;
          assignedUserIds?: number[] | null;
          assignedRoleId?: number | null;
        }
      | null
      | undefined,
    userId: number,
    userRoleIds: number[],
    isAdmin: boolean,
  ) {
    if (!step) return false;
    if (isAdmin) return true;
    const assignedUserIds = step.assignedUserIds?.length
      ? step.assignedUserIds
      : step.assignedUserId
        ? [step.assignedUserId]
        : [];
    if (assignedUserIds.includes(userId)) {
      return true;
    }
    if (step.assignedRoleId && userRoleIds.includes(step.assignedRoleId)) {
      return true;
    }
    return false;
  }

  private buildCurrentUserWorkflowContext(
    sortedSteps: any[],
    pendingStep: any,
    pendingApproverNames: string[],
    stagePendingContext: any,
    userId?: number,
    userRoleIds: number[] = [],
    isAdmin: boolean = false,
  ) {
    const activeStep = stagePendingContext?.level || pendingStep || null;
    const activeLevel = activeStep?.stepOrder ?? null;

    if (!userId) {
      return {
        actorState: null,
        currentUserCanApprove: false,
        currentUserAssignedLevels: [] as number[],
        currentUserFutureLevels: [] as number[],
        currentUserBlockedReason: null as string | null,
        currentUserActionHint: null as string | null,
      };
    }

    const assignedLevels = isAdmin
      ? sortedSteps.map((step) => step.stepOrder)
      : sortedSteps
          .filter((step) =>
            this.matchesStepForUser(step, userId, userRoleIds, isAdmin),
          )
          .map((step) => step.stepOrder);
    const highestAssignedLevel =
      assignedLevels.length > 0
        ? assignedLevels[assignedLevels.length - 1]
        : null;
    const canApproveNow =
      activeStep != null &&
      activeLevel != null &&
      highestAssignedLevel != null &&
      highestAssignedLevel >= activeLevel;
    const futureLevels = assignedLevels.filter(
      (level) => activeLevel != null && level > activeLevel,
    );

    let actorState: string | null = null;
    let blockedReason: string | null = null;
    let actionHint: string | null = null;

    if (!activeStep) {
      actorState = 'COMPLETED';
      actionHint = 'All approval levels are completed for this RFI.';
    } else if (canApproveNow) {
      actorState = 'CAN_ACT_NOW';
      const isHigherLevelTakeover =
        highestAssignedLevel != null &&
        activeLevel != null &&
        highestAssignedLevel > activeLevel;
      if (isHigherLevelTakeover) {
        actionHint =
          stagePendingContext != null
            ? `Your higher-level stage approval is active now. Approving at level ${highestAssignedLevel} will automatically record all pending lower stage approvals through level ${highestAssignedLevel}.`
            : `Your higher-level workflow approval is active now. Approving at level ${highestAssignedLevel} will automatically record all pending lower workflow approvals through level ${highestAssignedLevel}.`;
      } else {
        actionHint =
          stagePendingContext != null
            ? `Your approval is active at stage level ${activeStep.stepOrder}.`
            : `Your approval is active at workflow level ${activeStep.stepOrder}.`;
      }
    } else if (assignedLevels.length > 0 && activeLevel != null) {
      actorState = 'ALREADY_ACTED_OR_NOT_ACTIVE';
      blockedReason =
        assignedLevels[0] < activeLevel
          ? `Your assigned approval level is already complete. The RFI is now waiting at level ${activeLevel}.`
          : 'Your approval is not active at the current level.';
      actionHint = blockedReason;
    } else {
      actorState = 'NOT_ASSIGNED';
      const approverLabel =
        pendingApproverNames.join(', ') ||
        activeStep.stepName ||
        'another approver';
      blockedReason = `This RFI is currently assigned to ${approverLabel}.`;
      actionHint = blockedReason;
    }

    return {
      actorState,
      currentUserCanApprove: canApproveNow,
      currentUserAssignedLevels: assignedLevels,
      currentUserFutureLevels: futureLevels,
      currentUserBlockedReason: blockedReason,
      currentUserActionHint: actionHint,
    };
  }

  private inspectionHasActionableApprovalForUser(
    inspection: any,
    userId: number,
    userRoleIds: number[],
  ) {
    if (inspection.workflowSummary?.currentUserCanApprove) {
      return true;
    }

    return (inspection.stages || []).some((stage: any) =>
      this.stageHasActionableApprovalForUser(
        stage?.stageApproval,
        userId,
        userRoleIds,
      ),
    );
  }

  private stageHasActionableApprovalForUser(
    stageApproval: any,
    userId: number,
    userRoleIds: number[],
  ) {
    if (!stageApproval || stageApproval.fullyApproved) {
      return false;
    }

    const activeLevel =
      stageApproval.pendingLevels?.[0]?.stepOrder ??
      stageApproval.levels?.find((level: any) => !level.approved)?.stepOrder ??
      null;
    if (activeLevel == null) {
      return false;
    }

    const assignedLevels = (stageApproval.levels || [])
      .filter((level: any) =>
        this.matchesStepForUser(level, userId, userRoleIds, false),
      )
      .map((level: any) => Number(level.stepOrder))
      .filter((level: number) => Number.isFinite(level));

    if (assignedLevels.length === 0) {
      return false;
    }

    return Math.max(...assignedLevels) >= Number(activeLevel);
  }

  async expandGoSeries(dto: ExpandGoSeriesDto) {
    if (!Number.isInteger(dto.newTotalParts) || dto.newTotalParts < 2) {
      throw new BadRequestException(
        'newTotalParts must be an integer greater than or equal to 2.',
      );
    }

    const activity = await this.activityRepo.findOne({
      where: { id: dto.activityId },
    });
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    const applicability =
      activity.applicabilityLevel || QualityApplicabilityLevel.FLOOR;
    if (applicability !== QualityApplicabilityLevel.FLOOR) {
      throw new BadRequestException(
        'Add GO is currently supported only for FLOOR-level activities.',
      );
    }

    const where: any = {
      projectId: dto.projectId,
      epsNodeId: dto.epsNodeId,
      activityId: dto.activityId,
    };
    if (typeof dto.qualityUnitId === 'number') {
      where.qualityUnitId = dto.qualityUnitId;
    }
    if (typeof dto.qualityRoomId === 'number') {
      where.qualityRoomId = dto.qualityRoomId;
    }

    const scopedInspections = await this.inspectionRepo.find({
      where,
      order: { partNo: 'ASC', createdAt: 'ASC' },
    });

    if (scopedInspections.length === 0) {
      throw new BadRequestException(
        'No existing GO inspections were found for this activity and location.',
      );
    }

    const currentTotal = scopedInspections.reduce(
      (max, inspection) => Math.max(max, inspection.totalParts || 1),
      1,
    );

    if (dto.newTotalParts <= currentTotal) {
      throw new BadRequestException(
        `New GO count must be greater than the current total of ${currentTotal}.`,
      );
    }

    for (const inspection of scopedInspections) {
      inspection.totalParts = dto.newTotalParts;
    }
    await this.inspectionRepo.save(scopedInspections);

    const existingPartNos = Array.from(
      new Set(scopedInspections.map((inspection) => inspection.partNo || 1)),
    ).sort((a, b) => a - b);

    return {
      success: true,
      activityId: dto.activityId,
      epsNodeId: dto.epsNodeId,
      previousTotalParts: currentTotal,
      totalParts: dto.newTotalParts,
      existingPartNos,
    };
  }

  private getActiveStageApprovalSignatures(stage: any) {
    return (stage?.signatures || [])
      .filter(
        (signature: any) =>
          signature?.actionType === 'STAGE_APPROVE' && !signature?.isReversed,
      )
      .sort(
        (a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  }

  private buildStageApprovalDetails(
    stage: any,
    run?: InspectionWorkflowRun | null,
  ) {
    const sortedSteps = [...(run?.steps || [])].sort(
      (a: any, b: any) => a.stepOrder - b.stepOrder,
    );
    const stageApprovals = this.getActiveStageApprovalSignatures(stage);
    const legacyApproval = stageApprovals.find(
      (signature: any) => signature.approvalLevelOrder == null,
    );
    const approvalsByLevel = new Map<number, any>();

    for (const signature of stageApprovals) {
      const levelOrder = Number(signature.approvalLevelOrder);
      if (
        Number.isFinite(levelOrder) &&
        levelOrder > 0 &&
        !approvalsByLevel.has(levelOrder)
      ) {
        approvalsByLevel.set(levelOrder, signature);
      }
    }

    const levels = sortedSteps.map((step: any) => {
      const signature =
        approvalsByLevel.get(step.stepOrder) || legacyApproval || null;
      return {
        stepOrder: step.stepOrder,
        stepName: step.stepName || `Level ${step.stepOrder}`,
        assignedRoleId: step.assignedRoleId ?? null,
        assignedUserId: step.assignedUserId ?? null,
        assignedUserIds:
          step.assignedUserIds ||
          (step.assignedUserId ? [step.assignedUserId] : []),
        approved: Boolean(signature),
        autoInherited: Boolean(signature?.isAutoInherited),
        inheritedFromStepOrder: signature?.inheritedFromStepOrder ?? null,
        signedByUserId: signature?.signedByUserId ?? null,
        signerDisplayName:
          signature?.signerDisplayName || signature?.signedBy || null,
        signerCompany: signature?.signerCompany || null,
        signerRoleLabel:
          signature?.signerRoleLabel ||
          signature?.role ||
          step.stepName ||
          null,
        approvedAt: signature?.createdAt || null,
      };
    });

    const pendingLevels = levels.filter((level) => !level.approved);
    const fullyApproved =
      levels.length > 0
        ? pendingLevels.length === 0
        : stage?.status === StageStatus.APPROVED;

    return {
      levels,
      pendingLevels,
      approvedLevelCount: levels.filter((level) => level.approved).length,
      requiredLevelCount: levels.length,
      fullyApproved,
      progressLabel: `${levels.filter((level) => level.approved).length} of ${
        levels.length
      }`,
      pendingDisplay:
        pendingLevels.length > 0
          ? pendingLevels
              .map((level) => `Level ${level.stepOrder}: ${level.stepName}`)
              .join(', ')
          : null,
    };
  }

  private getNextPendingStageLevel(stages: any[]) {
    for (const stage of stages || []) {
      const pendingLevel = stage?.stageApproval?.pendingLevels?.[0];
      if (pendingLevel) {
        return {
          stage,
          level: pendingLevel,
        };
      }
    }
    return null;
  }

  private getUnresolvedObservationStatuses() {
    return [
      ActivityObservationStatus.PENDING,
      ActivityObservationStatus.RECTIFIED,
      ActivityObservationStatus.RESOLVED,
    ];
  }

  private async ensureNoUnresolvedInspectionObservations(
    inspectionId: number,
    inspectionMessage: string,
    stageId?: number,
    stageMessage?: string,
  ) {
    const unresolvedInspectionObservations = await this.observationRepo.count({
      where: {
        inspectionId,
        status: In(this.getUnresolvedObservationStatuses()),
      } as any,
    });

    if (unresolvedInspectionObservations === 0) {
      return;
    }

    if (typeof stageId === 'number') {
      const unresolvedStageObservations = await this.observationRepo.count({
        where: {
          inspectionId,
          stageId,
          status: In(this.getUnresolvedObservationStatuses()),
        } as any,
      });

      if (unresolvedStageObservations > 0) {
        throw new BadRequestException(stageMessage || inspectionMessage);
      }
    }

    throw new BadRequestException(inspectionMessage);
  }

  private async attachWorkflowSummary<T extends { id: number; stages?: any[] }>(
    inspections: T[],
    viewerUserId?: number,
    viewerIsAdmin: boolean = false,
    includeSignatureData: boolean = false,
  ): Promise<(T & Record<string, any>)[]> {
    if (inspections.length === 0) return [];

    const inspectionIds = inspections.map((inspection) => inspection.id);
    const activityIds = Array.from(
      new Set(
        inspections
          .map((inspection: any) => inspection.activityId)
          .filter(
            (activityId): activityId is number =>
              typeof activityId === 'number',
          ),
      ),
    );

    const stageRecords = await this.stageRepo.find({
      where: { inspectionId: In(inspectionIds) } as any,
      relations: includeSignatureData
        ? ['stageTemplate', 'signatures']
        : ['stageTemplate'],
    });
    if (!includeSignatureData) {
      const stageIds = stageRecords
        .map((stage) => stage.id)
        .filter((id): id is number => Number.isInteger(Number(id)));
      if (stageIds.length > 0) {
        const stageSignatures = await this.signatureRepo.find({
          where: { stageId: In(stageIds) },
          select: {
            id: true,
            stageId: true,
            inspectionId: true,
            workflowStepId: true,
            approvalLevelOrder: true,
            approvalLevelName: true,
            approvalAssignedUserId: true,
            approvalAssignedRoleId: true,
            isAutoInherited: true,
            inheritedFromStepOrder: true,
            userId: true,
            actionType: true,
            role: true,
            signedBy: true,
            signedByUserId: true,
            signerDisplayName: true,
            signerCompany: true,
            signerRoleLabel: true,
            sourceType: true,
            lockHash: true,
            metadata: true,
            isReversed: true,
            reversedAt: true,
            reversedByUserId: true,
            reversalReason: true,
            createdAt: true,
          },
          order: { createdAt: 'ASC' },
        });
        const signaturesByStageId = new Map<number, any[]>();
        for (const signature of stageSignatures) {
          const bucket = signaturesByStageId.get(signature.stageId) || [];
          bucket.push(signature);
          signaturesByStageId.set(signature.stageId, bucket);
        }
        for (const stage of stageRecords as any[]) {
          stage.signatures = signaturesByStageId.get(stage.id) || [];
        }
      }
    }
    const stageMap = new Map<number, any[]>();
    for (const stage of stageRecords) {
      const bucket = stageMap.get(stage.inspectionId) || [];
      bucket.push(stage);
      stageMap.set(stage.inspectionId, bucket);
    }

    const runs = await this.workflowRunRepo.find({
      where: { inspectionId: In(inspectionIds) },
      relations: includeSignatureData
        ? ['steps', 'steps.signature']
        : ['steps'],
    });

    if (!includeSignatureData) {
      const steps = runs.flatMap((run) => run.steps || []);
      const stepIds = steps
        .map((step) => step.id)
        .filter((id): id is number => Number.isInteger(Number(id)));
      const signatureIds = steps
        .map((step) => step.signatureId)
        .filter((id): id is number => Number.isInteger(Number(id)));
      if (stepIds.length > 0 || signatureIds.length > 0) {
        const stepSignatures = await this.signatureRepo.find({
          where: [
            ...(stepIds.length ? [{ workflowStepId: In(stepIds) }] : []),
            ...(signatureIds.length ? [{ id: In(signatureIds) }] : []),
          ],
          select: {
            id: true,
            stageId: true,
            inspectionId: true,
            workflowStepId: true,
            approvalLevelOrder: true,
            approvalLevelName: true,
            approvalAssignedUserId: true,
            approvalAssignedRoleId: true,
            isAutoInherited: true,
            inheritedFromStepOrder: true,
            userId: true,
            actionType: true,
            role: true,
            signedBy: true,
            signedByUserId: true,
            signerDisplayName: true,
            signerCompany: true,
            signerRoleLabel: true,
            sourceType: true,
            lockHash: true,
            metadata: true,
            isReversed: true,
            reversedAt: true,
            reversedByUserId: true,
            reversalReason: true,
            createdAt: true,
          },
        });
        const signaturesByStepId = new Map<number, any>();
        const signaturesById = new Map<number, any>();
        for (const signature of stepSignatures) {
          signaturesById.set(signature.id, signature);
          if (signature.workflowStepId) {
            signaturesByStepId.set(signature.workflowStepId, signature);
          }
        }
        for (const step of steps as any[]) {
          step.signature =
            signaturesByStepId.get(step.id) ||
            (step.signatureId ? signaturesById.get(step.signatureId) : null) ||
            null;
        }
      }
    }

    const runMap = new Map<number, InspectionWorkflowRun>(
      runs.map((run) => [run.inspectionId, run]),
    );

    const [observationCountRows, legacyObservationCountRows] =
      await Promise.all([
        this.observationRepo
          .createQueryBuilder('observation')
          .select('observation.inspectionId', 'inspectionId')
          .addSelect('COUNT(*)', 'count')
          .where('observation.inspectionId IN (:...inspectionIds)', {
            inspectionIds,
          })
          .andWhere('observation.status IN (:...statuses)', {
            statuses: this.getUnresolvedObservationStatuses(),
          })
          .groupBy('observation.inspectionId')
          .getRawMany<{ inspectionId: string; count: string }>(),
        activityIds.length
          ? this.observationRepo
              .createQueryBuilder('observation')
              .select('observation.activityId', 'activityId')
              .addSelect('COUNT(*)', 'count')
              .where('observation.activityId IN (:...activityIds)', {
                activityIds,
              })
              .andWhere('observation.inspectionId IS NULL')
              .andWhere('observation.status IN (:...statuses)', {
                statuses: this.getUnresolvedObservationStatuses(),
              })
              .groupBy('observation.activityId')
              .getRawMany<{ activityId: string; count: string }>()
          : Promise.resolve([] as Array<{ activityId: string; count: string }>),
      ]);

    const observationCountByInspectionId = new Map<number, number>(
      observationCountRows.map((row) => [
        Number(row.inspectionId),
        Number(row.count),
      ]),
    );
    const legacyObservationCountByActivityId = new Map<number, number>(
      legacyObservationCountRows.map((row) => [
        Number(row.activityId),
        Number(row.count),
      ]),
    );

    const [pourCards, prePourClearanceCards] = await Promise.all([
      this.pourCardRepo.find({
        where: { inspectionId: In(inspectionIds) },
      }),
      this.prePourClearanceRepo.find({
        where: { inspectionId: In(inspectionIds) },
      }),
    ]);
    const pourCardByInspectionId = new Map(
      pourCards.map((card) => [card.inspectionId, card]),
    );
    const prePourClearanceByInspectionId = new Map(
      prePourClearanceCards.map((card) => [card.inspectionId, card]),
    );

    const actorMapByProject = new Map<number, Map<number, any>>();
    const roleMapByProject = new Map<number, Map<number, string>>();
    const viewerRoleIdsByProject = new Map<number, number[]>();
    const projectIds = Array.from(
      new Set(
        inspections
          .map((inspection: any) => inspection.projectId)
          .filter((projectId): projectId is number => !!projectId),
      ),
    );

    await Promise.all(
      projectIds.map(async (projectId) => {
        const actors =
          await this.approvalRuntimeService.getProjectActors(projectId);
        actorMapByProject.set(
          projectId,
          new Map(actors.map((actor) => [actor.userId, actor])),
        );
        roleMapByProject.set(
          projectId,
          await this.approvalRuntimeService.getProjectRoleNameMap(projectId),
        );
        if (viewerUserId) {
          viewerRoleIdsByProject.set(
            projectId,
            await this.approvalRuntimeService.getProjectRoleIds(
              projectId,
              viewerUserId,
            ),
          );
        }
      }),
    );

    return inspections.map((inspection) => {
      const projectId = (inspection as any).projectId;
      const run = runMap.get(inspection.id);
      const sortedSteps = [...(run?.steps || [])].sort(
        (a, b) => a.stepOrder - b.stepOrder,
      );
      const pendingStep =
        sortedSteps.find((step) => step.stepOrder === run?.currentStepOrder) ||
        null;
      const completedSteps = sortedSteps.filter(
        (step) => step.status === 'COMPLETED',
      );
      const stages = (
        inspection.stages ||
        stageMap.get(inspection.id) ||
        []
      )
        .sort(
          (a: any, b: any) =>
            this.getStageSequence(a, 0) - this.getStageSequence(b, 0),
        )
        .map((stage: any) => {
          const stageApproval = this.buildStageApprovalDetails(stage, run);
          const sequence = this.getStageSequence(stage, 0);
          return {
            ...stage,
            sequence,
            stageTemplate: stage.stageTemplate
              ? {
                  ...stage.stageTemplate,
                  sequence,
                }
              : stage.stageTemplate,
            stageApproval,
          };
        });
      const approvedStages =
        stages.filter((stage: any) => stage.stageApproval?.fullyApproved)
          .length || 0;
      const totalStages = stages.length || 0;
      const pourCard = pourCardByInspectionId.get(inspection.id) || null;
      const prePourClearance =
        prePourClearanceByInspectionId.get(inspection.id) || null;
      const cardGateSummary = this.buildCardGateSummary(
        (inspection as any).activity,
        stages,
        pourCard,
        prePourClearance,
        null,
      );
      const approvalBlockersByStageId = Object.fromEntries(
        stages.map((stage: any) => [
          stage.id,
          this.buildCardGateSummary(
            (inspection as any).activity,
            stages,
            pourCard,
            prePourClearance,
            stage,
          ).stageApprovalBlockers,
        ]),
      );

      let pendingApprovalDisplay: string | null = null;
      let pendingApproverNames: string[] = [];
      let stagePendingContext = this.getNextPendingStageLevel(stages);
      if (!stagePendingContext && pendingStep && projectId) {
        const actorMap =
          actorMapByProject.get(projectId) || new Map<number, any>();
        const roleMap =
          roleMapByProject.get(projectId) || new Map<number, string>();
        const assignedUserIds = pendingStep.assignedUserIds?.length
          ? pendingStep.assignedUserIds
          : pendingStep.assignedUserId
            ? [pendingStep.assignedUserId]
            : [];

        pendingApproverNames = assignedUserIds
          .map(
            (userId) => actorMap.get(userId)?.displayName || `User #${userId}`,
          )
          .filter(Boolean);

        if (pendingApproverNames.length === 0 && pendingStep.assignedRoleId) {
          const roleName =
            roleMap.get(pendingStep.assignedRoleId) ||
            pendingStep.stepName ||
            `Role ${pendingStep.assignedRoleId}`;
          pendingApproverNames = [roleName];
        }

        if (pendingStep.stepOrder) {
          pendingApprovalDisplay = `Level ${pendingStep.stepOrder} Pending: ${
            pendingApproverNames.join(', ') ||
            pendingStep.stepName ||
            'Approval Pending'
          }`;
        }
      } else if (stagePendingContext && projectId) {
        const actorMap =
          actorMapByProject.get(projectId) || new Map<number, any>();
        const roleMap =
          roleMapByProject.get(projectId) || new Map<number, string>();
        const assignedUserIds = stagePendingContext.level.assignedUserIds
          ?.length
          ? stagePendingContext.level.assignedUserIds
          : stagePendingContext.level.assignedUserId
            ? [stagePendingContext.level.assignedUserId]
            : [];
        pendingApproverNames = assignedUserIds
          .map(
            (userId: number) =>
              actorMap.get(userId)?.displayName || `User #${userId}`,
          )
          .filter(Boolean);
        if (
          pendingApproverNames.length === 0 &&
          stagePendingContext.level.assignedRoleId
        ) {
          const roleName =
            roleMap.get(stagePendingContext.level.assignedRoleId) ||
            stagePendingContext.level.stepName ||
            `Role ${stagePendingContext.level.assignedRoleId}`;
          pendingApproverNames = [roleName];
        }
        pendingApprovalDisplay = `Stage ${
          stagePendingContext.stage.stageTemplate?.name ||
          `#${stagePendingContext.stage.id}`
        } - Level ${stagePendingContext.level.stepOrder} Pending: ${
          pendingApproverNames.join(', ') ||
          stagePendingContext.level.stepName ||
          'Approval Pending'
        }`;
      }

      const currentUserContext = this.buildCurrentUserWorkflowContext(
        sortedSteps,
        pendingStep,
        pendingApproverNames,
        stagePendingContext,
        viewerUserId,
        viewerRoleIdsByProject.get(projectId) || [],
        viewerIsAdmin,
      );

      return {
        ...inspection,
        pendingObservationCount:
          observationCountByInspectionId.get(inspection.id) || 0,
        legacyActivityObservationCount:
          legacyObservationCountByActivityId.get(
            (inspection as any).activityId,
          ) || 0,
        stages,
        workflowCurrentLevel: run?.currentStepOrder || null,
        workflowTotalLevels: sortedSteps.length,
        pendingApprovalLevel: pendingStep?.stepOrder || null,
        pendingApprovalLabel:
          stagePendingContext?.level?.stepName ||
          pendingStep?.stepName ||
          pendingStep?.signerRole ||
          null,
        pendingApprovalDisplay,
        pendingApproverNames,
        pendingApprovalBy:
          stagePendingContext?.level?.assignedUserId ||
          stagePendingContext?.level?.assignedRoleId ||
          pendingStep?.assignedUserId ||
          pendingStep?.assignedRoleId ||
          null,
        workflowSummary: {
          runStatus: run?.status || null,
          releaseStrategyId: run?.releaseStrategyId || null,
          releaseStrategyVersion: run?.releaseStrategyVersion || null,
          strategyName: run?.strategyName || null,
          processCode:
            run?.processCode || (inspection as any).processCode || null,
          documentType:
            run?.documentType || (inspection as any).documentType || null,
          actorState: currentUserContext.actorState,
          currentUserCanApprove: currentUserContext.currentUserCanApprove,
          currentUserAssignedLevels:
            currentUserContext.currentUserAssignedLevels,
          currentUserFutureLevels: currentUserContext.currentUserFutureLevels,
          currentUserBlockedReason: currentUserContext.currentUserBlockedReason,
          currentUserActionHint: currentUserContext.currentUserActionHint,
          pendingStep: stagePendingContext
            ? {
                stepOrder: stagePendingContext.level.stepOrder,
                stepName: stagePendingContext.level.stepName,
                assignedUserId: stagePendingContext.level.assignedUserId,
                assignedUserIds:
                  stagePendingContext.level.assignedUserIds ||
                  (stagePendingContext.level.assignedUserId
                    ? [stagePendingContext.level.assignedUserId]
                    : []),
                assignedRoleId: stagePendingContext.level.assignedRoleId,
                pendingApproverNames,
                pendingApprovalDisplay,
                approverMode: null,
                status: 'PENDING',
                currentApprovalCount: 0,
                minApprovalsRequired: 1,
                approvedUserIds: [],
              }
            : pendingStep
              ? {
                  stepOrder: pendingStep.stepOrder,
                  stepName: pendingStep.stepName,
                  assignedUserId: pendingStep.assignedUserId,
                  assignedUserIds:
                    pendingStep.assignedUserIds ||
                    (pendingStep.assignedUserId
                      ? [pendingStep.assignedUserId]
                      : []),
                  assignedRoleId: pendingStep.assignedRoleId,
                  pendingApproverNames,
                  pendingApprovalDisplay,
                  approverMode: pendingStep.approverMode,
                  status: pendingStep.status,
                  currentApprovalCount: pendingStep.currentApprovalCount || 0,
                  minApprovalsRequired: pendingStep.minApprovalsRequired || 1,
                  approvedUserIds: pendingStep.approvedUserIds || [],
                }
              : null,
          completedSteps: completedSteps.map((step) => ({
            stepOrder: step.stepOrder,
            stepName: step.stepName,
            currentApprovalCount: step.currentApprovalCount || 0,
            minApprovalsRequired: step.minApprovalsRequired || 1,
            signedByUserId: step.signature?.signedByUserId || null,
            signerDisplayName:
              step.signerDisplayName ||
              step.signature?.signerDisplayName ||
              null,
            signerCompany:
              step.signerCompany || step.signature?.signerCompany || null,
            signerRole:
              step.signerRole || step.signature?.signerRoleLabel || null,
            completedAt: step.completedAt,
          })),
        },
        stageApprovalSummary: {
          approvedStages,
          totalStages,
          pendingFinalApproval:
            approvedStages > 0 &&
            approvedStages === totalStages &&
            (inspection as any).status !== InspectionStatus.APPROVED,
          currentUserCanApprove: currentUserContext.currentUserCanApprove,
          currentUserActionHint: currentUserContext.currentUserActionHint,
          currentUserBlockedReason: currentUserContext.currentUserBlockedReason,
          activeLevel:
            stagePendingContext?.level?.stepOrder ||
            pendingStep?.stepOrder ||
            null,
          pourClearanceTriggerStageTemplateId:
            cardGateSummary.prePourClearanceTriggerStageTemplateId,
          pourClearanceTriggerStageName:
            cardGateSummary.prePourClearanceTriggerStageName,
          pourClearanceTriggerApproved:
            cardGateSummary.prePourClearanceTriggerApproved,
          pourCardTriggerStageTemplateId:
            cardGateSummary.pourCardTriggerStageTemplateId,
          pourCardTriggerStageName:
            cardGateSummary.pourCardTriggerStageName,
          pourCardTriggerApproved:
            cardGateSummary.pourCardTriggerApproved,
        },
        cardSummary: {
          ...cardGateSummary,
          approvalBlockersByStageId,
        },
      };
    });
  }

  private buildEpsAncestry(
    nodeId: number | undefined,
    epsById: Map<number, EpsNode>,
  ): EpsNode[] {
    if (!nodeId) return [];

    const path: EpsNode[] = [];
    let currentId: number | undefined = nodeId;
    const seen = new Set<number>();

    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const node = epsById.get(currentId);
      if (!node) break;
      path.unshift(node);
      currentId = node.parentId;
    }

    return path;
  }

  private async loadEpsAncestryMap(nodeIds: number[]): Promise<Map<number, EpsNode>> {
    const epsById = new Map<number, EpsNode>();
    let pendingIds = Array.from(new Set(nodeIds.filter(Boolean)));

    while (pendingIds.length > 0) {
      const missingIds = pendingIds.filter((id) => !epsById.has(id));
      if (missingIds.length === 0) break;

      const nodes = await this.epsNodeRepo.find({
        where: { id: In(missingIds) },
      });
      if (nodes.length === 0) break;

      pendingIds = [];
      for (const node of nodes) {
        epsById.set(node.id, node);
        if (node.parentId && !epsById.has(node.parentId)) {
          pendingIds.push(node.parentId);
        }
      }
    }

    return epsById;
  }

  private async buildEpsLocationPath(nodeId: number | undefined) {
    if (!nodeId) return '';

    const names: string[] = [];
    let currentId: number | undefined = nodeId;
    const seen = new Set<number>();

    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const node = await this.epsNodeRepo.findOne({ where: { id: currentId } });
      if (!node) break;
      names.unshift(node.name);
      currentId = node.parentId || undefined;
    }

    return names.join(' > ');
  }

  private async checkPredecessor(
    prevActivityId: number,
    epsNodeId: number,
    floorScope?: {
      blockId?: number;
      towerId?: number;
      floorId?: number;
    } | null,
  ): Promise<{ approved: boolean; activityName: string }> {
    const prevActivity = await this.activityRepo.findOne({
      where: { id: prevActivityId },
    });
    if (!prevActivity) return { approved: true, activityName: 'Unknown' };

    if (
      floorScope &&
      !this.isActivityVisibleForFloorScope(
        prevActivity.floorVisibility,
        floorScope,
      )
    ) {
      return { approved: true, activityName: prevActivity.activityName };
    }

    // Find latest inspection for predecessor at this node
    const latestInspection = await this.inspectionRepo.findOne({
      where: {
        activityId: prevActivityId, // Searching by ID of previous activity
        epsNodeId: epsNodeId,
      },
      order: { createdAt: 'DESC' }, // Most recent first
    });

    // Current Logic: Only pass if LATEST inspection is APPROVED.
    if (
      latestInspection &&
      latestInspection.status === InspectionStatus.APPROVED
    ) {
      return { approved: true, activityName: prevActivity.activityName };
    }

    return { approved: false, activityName: prevActivity.activityName };
  }

  async deleteInspection(id: number, userId?: string) {
    const inspection = await this.inspectionRepo.findOne({
      where: { id },
    });
    if (!inspection) throw new NotFoundException('Inspection not found');

    const activityId = inspection.activityId;

    // Cascade delete linked observations
    try {
      await this.observationRepo.delete({ inspectionId: id });
      this.logger.log(`Cascade deleted observations for inspection #${id}`);
    } catch (e) {
      this.logger.warn(
        `No observations to cascade delete for inspection #${id}`,
      );
    }

    await this.cubeRegisterRepo.delete({ inspectionId: id });
    this.logger.log(
      `Cascade deleted cube test register rows for inspection #${id}`,
    );

    await this.attachmentService.purgeForInspection(id);
    await this.inspectionRepo.remove(inspection);

    const remaining = await this.inspectionRepo.count({
      where: { activityId },
    });
    if (remaining === 0) {
      await this.activityRepo.update(activityId, {
        status: QualityActivityStatus.NOT_STARTED,
      });
    }

    if (userId) {
      await this.auditService.log(
        parseInt(userId, 10),
        'QUALITY',
        'DELETE_RFI',
        String(id),
        inspection.epsNodeId,
        { activity: activityId },
      );
    }

    return { success: true };
  }
}
