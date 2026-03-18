import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { ActivityObservation } from './entities/activity-observation.entity';
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
import { AuditService } from '../audit/audit.service';
import { ComplianceService } from './compliance.service';
import { InspectionWorkflowService } from './inspection-workflow.service';
import { PushNotificationService } from '../notifications/push-notification.service';
import {
  InspectionWorkflowRun,
  WorkflowRunStatus,
} from './entities/inspection-workflow-run.entity';
import { ApprovalRuntimeService } from '../common/approval-runtime.service';

export interface CreateInspectionDto {
  projectId: number;
  epsNodeId: number;
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
  goNo?: number;
  goLabel?: string;
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

@Injectable()
export class QualityInspectionService {
  private readonly logger = new Logger(QualityInspectionService.name);

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
    private readonly complianceService: ComplianceService,
    private readonly auditService: AuditService,
    private readonly inspectionWorkflowService: InspectionWorkflowService,
    private readonly pushService: PushNotificationService,
    private readonly approvalRuntimeService: ApprovalRuntimeService,
  ) {}

  private deriveInspectionProcessCode(dto: CreateInspectionDto): string {
    return (dto.processCode || 'QA_QC_APPROVAL').trim().toUpperCase();
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

  async getActiveVendors(projectId: number) {
    const workOrders = await this.workOrderRepo.find({
      where: [
        { projectId, status: 'ACTIVE' },
        { projectId, status: 'IN_PROGRESS' },
      ],
      relations: ['vendor'],
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validWOs = workOrders.filter((wo) => {
      if (!wo.orderValidityEnd) return false;
      const expiry = new Date(wo.orderValidityEnd);
      expiry.setHours(0, 0, 0, 0);
      return expiry >= today;
    });

    const vendorMap = new Map<number, Vendor>();
    for (const wo of validWOs) {
      if (wo.vendor && !vendorMap.has(wo.vendor.id)) {
        vendorMap.set(wo.vendor.id, wo.vendor);
      }
    }
    return Array.from(vendorMap.values());
  }

  async getInspections(projectId: number, epsNodeId?: number, listId?: number) {
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

    const inspections = await query.orderBy('i.createdAt', 'DESC').getMany();

    if (inspections.length === 0) return [];

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

    const [allEpsNodes, units, rooms] = await Promise.all([
      this.epsNodeRepo.find(),
      unitIds.length
        ? this.qualityUnitRepo.find({ where: { id: In(unitIds) } })
        : Promise.resolve([]),
      roomIds.length
        ? this.qualityRoomRepo.find({ where: { id: In(roomIds) } })
        : Promise.resolve([]),
    ]);

    const epsById = new Map<number, EpsNode>(allEpsNodes.map((n) => [n.id, n]));
    const unitsById = new Map<number, QualityUnit>(units.map((u) => [u.id, u]));
    const roomsById = new Map<number, QualityRoom>(rooms.map((r) => [r.id, r]));

    const inspectionsWithWorkflow = await this.attachWorkflowSummary(inspections);

    return inspectionsWithWorkflow.map((inspection) => {
      const ancestry = this.buildEpsAncestry(inspection.epsNodeId, epsById);
      const locationPath = ancestry.map((n) => n.name).join(' > ');

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

      return {
        ...inspection,
        locationPath,
        blockName,
        towerName,
        floorName,
        unitName: qualityUnit?.name || epsUnitName || null,
        roomName: qualityRoom?.name || epsRoomName || null,
      };
    });
  }

  async getMyPendingInspections(projectId: number, userId: number) {
    return this.inspectionRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.activity', 'activity')
      .leftJoinAndSelect('i.epsNode', 'eps')
      .where('i.projectId = :projectId', { projectId })
      .andWhere('i.requestedById = :userId', { userId })
      .andWhere('i.status NOT IN (:...closedStatuses)', {
        closedStatuses: ['APPROVED', 'CANCELED'],
      })
      .orderBy('i.createdAt', 'DESC')
      .getMany();
  }

  async getInspectionDetails(id: number) {
    const inspection = await this.inspectionRepo.findOne({
      where: { id },
      relations: [
        'activity',
        'stages',
        'stages.stageTemplate',
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
    if (!inspection) throw new NotFoundException('Inspection not found');
    const [withWorkflow] = await this.attachWorkflowSummary([inspection]);
    return withWorkflow;
  }

  async getApprovalDashboard(projectId: number, userId: number) {
    const inspections = (await this.getInspections(projectId)) as any[];
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

    const raisedUnitIds = Array.from(latestByUnit.keys()).sort((a, b) => a - b);
    const pendingUnitIds = unitIds.filter((id) => !latestByUnit.has(id));

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

    // 2. Check if there is already a PENDING inspection for this activity at this location
    const existingWhere: any = {
      activityId: dto.activityId,
      epsNodeId: dto.epsNodeId,
      status: InspectionStatus.PENDING,
      partNo: dto.partNo || 1,
    };
    if (typeof dto.qualityUnitId === 'number') {
      existingWhere.qualityUnitId = dto.qualityUnitId;
    }
    if (typeof dto.qualityRoomId === 'number') {
      existingWhere.qualityRoomId = dto.qualityRoomId;
    }
    const existingPending = await this.inspectionRepo.findOne({
      where: existingWhere,
    });

    if (existingPending) {
      throw new BadRequestException(
        'A pending inspection request already exists for this activity at this location.',
      );
    }

    // 3. CHECKLIST VERIFICATION (mandatory before RFI)
    if (
      !activity.assignedChecklistIds ||
      activity.assignedChecklistIds.length === 0
    ) {
      throw new BadRequestException(
        'At least one checklist must be assigned to the activity before raising an RFI.',
      );
    }

    // 4. SEQUENCE ENFORCEMENT
    if (activity.previousActivityId) {
      const allowed = await this.checkPredecessor(
        activity.previousActivityId,
        dto.epsNodeId,
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

    // 7. Create Inspection
    const inspection = this.inspectionRepo.create({
      projectId: dto.projectId,
      epsNodeId: dto.epsNodeId,
      listId: activity.listId,
      activityId: dto.activityId,
      sequence: activity.sequence,
      qualityUnitId: dto.qualityUnitId,
      qualityRoomId: dto.qualityRoomId,
      partNo: dto.partNo || 1,
      totalParts: dto.totalParts || 1,
      partLabel:
        dto.partLabel ||
        ((dto.totalParts || 1) > 1 ? `GO ${dto.partNo || 1}` : null),
      goNo,
      goLabel,
      comments: dto.comments,
      requestDate: dto.requestDate || new Date().toISOString().split('T')[0],
      status: InspectionStatus.PENDING,
      requestedById: userId,
      vendorId: finalVendorId,
      vendorName: finalVendorName,
      drawingNo: dto.drawingNo.trim(),
      contractorName: dto.contractorName ?? finalVendorName,
      processCode,
      documentType,
    });

    // Ensure listId matches activity
    inspection.listId = activity.listId;

    const savedInspection = await this.inspectionRepo.save(inspection);

    // 7. Initialize Stages from ALL assigned checklists
    if (
      activity.assignedChecklistIds &&
      activity.assignedChecklistIds.length > 0
    ) {
      const templates = await this.checklistTemplateRepo.find({
        where: { id: In(activity.assignedChecklistIds) },
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

    if ((data.signature || data.status === StageStatus.APPROVED) && data.userId) {
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

        // Update DB directly
        await this.executionItemRepo.update(itemUpdate.id, {
          value: itemUpdate.value,
          isOk: isOkParsed,
          remarks: itemUpdate.remarks,
          photos: itemUpdate.photos,
        });

        // Update in-memory item so that subsequent stageRepo.save(stage)
        // doesn't overwrite DB with stale values due to cascade: true.
        const memItem = stage.items.find((i) => i.id === itemUpdate.id);
        if (memItem) {
          memItem.value = itemUpdate.value ?? '';
          memItem.isOk = isOkParsed;
          memItem.remarks = itemUpdate.remarks ?? '';
          memItem.photos = itemUpdate.photos ?? [];
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

      if (
        requestedStatus !== StageStatus.APPROVED &&
        checkedItemsCount === 0
      ) {
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
        requestedStatus === StageStatus.APPROVED ? 'STAGE_APPROVE' : 'SAVE_PROGRESS';
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
            ? 'Approved ✓'
            : 'Rejected ✗';
        this.pushService
          .sendToUsers(
            [inspection.requestedById],
            `RFI ${resultLabel}`,
            dto.comments ||
              (dto.status === InspectionStatus.APPROVED
                ? 'Your inspection request has been approved.'
                : 'Your inspection request has been rejected.'),
            { inspectionId: String(id), type: dto.status },
          )
          .catch(() => {
            /* non-fatal */
          });
      }
    }

    return saved;
  }

  // ─── Stage-wise Approval Pipeline ─────────────────────────────────────────

  async approveStage(
    inspectionId: number,
    stageId: number,
    userId: number,
    signatureData?: string,
    comments?: string,
    isAdmin: boolean = false,
  ) {
    const stage = await this.stageRepo.findOne({
      where: { id: stageId, inspectionId },
      relations: ['inspection', 'stageTemplate', 'items', 'signatures'],
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
        item?.value !== 'YES' &&
        item?.value !== 'NA' &&
        item?.isOk !== true,
    );
    if (incompleteItems.length > 0) {
      throw new BadRequestException(
        'All checklist items in the stage must be checked before stage approval.',
      );
    }

    const openStageObservations = await this.observationRepo.count({
      where: {
        inspectionId,
        stageId,
      } as any,
    });
    if (openStageObservations > 0) {
      const unresolvedStageObservations = await this.observationRepo.count({
        where: {
          inspectionId,
          stageId,
          status: In(['PENDING', 'RECTIFIED', 'RESOLVED']),
        } as any,
      });
      if (unresolvedStageObservations > 0) {
        throw new BadRequestException(
          'Close all observations linked to this stage before approving it.',
        );
      }
    }

    const run = await this.inspectionWorkflowService.getOrStartWorkflowState(
      inspectionId,
      userId,
    );
    if (!run) {
      throw new NotFoundException('Workflow is not configured for this inspection');
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

    const sortedSteps = [...(run.steps || [])].sort(
      (a, b) => a.stepOrder - b.stepOrder,
    );
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

    const now = new Date();
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
          metadata: { timestamp: now },
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
    const approvedStages = inspection.stages.filter((inspectionStage: any) =>
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

    if (approvedStages === totalStages && totalStages > 0 && run) {
      run.status = WorkflowRunStatus.COMPLETED as any;
      await this.workflowRunRepo.save(run);
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
      const notifyUserIds = Array.from(new Set([...nextUserIds, ...nextRoleUserIds]));
      if (notifyUserIds.length > 0) {
        this.pushService
          .sendToUsers(
            notifyUserIds,
            'Stage Approval Required',
            `Stage "${stage.stageTemplate?.name}" is pending at Level ${nextPendingLevel.stepOrder}.`,
            {
              inspectionId: String(inspectionId),
              stageId: String(stageId),
              type: 'STAGE_LEVEL_PENDING',
            },
          )
          .catch(() => {
            /* non-fatal */
          });
      }
    }

    // Notify RFI raiser of progress
    if (inspection.requestedById) {
      this.pushService
        .sendToUsers(
          [inspection.requestedById],
          approvedStages === totalStages && totalStages > 0
            ? 'Checklist Approved ✓'
            : 'Stage Approved ✓',
          approvedStages === totalStages && totalStages > 0
            ? `All stages are approved for RFI #${inspectionId}. The checklist is now fully approved.`
            : `Stage "${stage.stageTemplate?.name}" approved for RFI #${inspectionId}. ${approvedStages}/${totalStages} complete.`,
          {
            inspectionId: String(inspectionId),
            stageId: String(stageId),
            type:
              approvedStages === totalStages && totalStages > 0
                ? 'APPROVED'
                : 'STAGE_APPROVED',
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
  ) {
    const inspection = await this.inspectionRepo.findOne({
      where: { id: inspectionId },
      relations: ['stages', 'stages.stageTemplate', 'stages.signatures'],
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

    const signer = await this.getApproverSnapshot(inspection.projectId, userId);

    const fingerprint = this.complianceService.generateFingerprint({
      stageId: 0,
      items: [],
      metadata: { timestamp: new Date(), user: String(userId) },
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
      metadata: { timestamp: new Date() },
    });
    await this.signatureRepo.save(signature);

    // Mark as APPROVED
    inspection.status = InspectionStatus.APPROVED;
    inspection.inspectionDate = new Date().toISOString().split('T')[0];
    inspection.inspectedBy = signer.displayName;
    inspection.isLocked = true;
    inspection.lockedAt = new Date();
    inspection.lockedByUserId = userId;
    if (comments) inspection.comments = comments;
    await this.inspectionRepo.save(inspection);

    // Audit
    await this.auditService.log(
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
    );

    // Notify the RFI raiser
    if (inspection.requestedById) {
      this.pushService
        .sendToUsers(
          [inspection.requestedById],
          'RFI Approved ✅',
          `Your RFI #${inspectionId} has received final approval.`,
          { inspectionId: String(inspectionId), type: 'APPROVED' },
        )
        .catch(() => {
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
    const remainingApprovals = this.buildStageApprovalDetails(refreshedStage, run);
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
    refreshedStage.lockedAt = remainingApprovals.fullyApproved ? new Date() : null;
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
      const approvedStages = (inspection.stages || []).filter((inspectionStage: any) =>
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

  private buildStageApprovalDetails(stage: any, run?: InspectionWorkflowRun | null) {
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
      if (Number.isFinite(levelOrder) && levelOrder > 0 && !approvalsByLevel.has(levelOrder)) {
        approvalsByLevel.set(levelOrder, signature);
      }
    }

    const levels = sortedSteps.map((step: any) => {
      const signature = approvalsByLevel.get(step.stepOrder) || legacyApproval || null;
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
        signerDisplayName: signature?.signerDisplayName || signature?.signedBy || null,
        signerCompany: signature?.signerCompany || null,
        signerRoleLabel:
          signature?.signerRoleLabel || signature?.role || step.stepName || null,
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

  private async attachWorkflowSummary<T extends { id: number; stages?: any[] }>(
    inspections: T[],
  ): Promise<(T & Record<string, any>)[]> {
    if (inspections.length === 0) return [];

    const stageRecords = await this.stageRepo.find({
      where: { inspectionId: In(inspections.map((inspection) => inspection.id)) } as any,
      relations: ['signatures'],
    });
    const stageMap = new Map<number, any[]>();
    for (const stage of stageRecords) {
      const bucket = stageMap.get(stage.inspectionId) || [];
      bucket.push(stage);
      stageMap.set(stage.inspectionId, bucket);
    }

    const runs = await this.workflowRunRepo.find({
      where: { inspectionId: In(inspections.map((inspection) => inspection.id)) },
      relations: ['steps', 'steps.signature'],
    });

    const runMap = new Map<number, InspectionWorkflowRun>(
      runs.map((run) => [run.inspectionId, run]),
    );

    const actorMapByProject = new Map<number, Map<number, any>>();
    const roleMapByProject = new Map<number, Map<number, string>>();
    const projectIds = Array.from(
      new Set(
        inspections
          .map((inspection: any) => inspection.projectId)
          .filter((projectId): projectId is number => !!projectId),
      ),
    );

    await Promise.all(
      projectIds.map(async (projectId) => {
        const actors = await this.approvalRuntimeService.getProjectActors(projectId);
        actorMapByProject.set(
          projectId,
          new Map(actors.map((actor) => [actor.userId, actor])),
        );
        roleMapByProject.set(
          projectId,
          await this.approvalRuntimeService.getProjectRoleNameMap(projectId),
        );
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
      const stages = (inspection.stages || stageMap.get(inspection.id) || []).map(
        (stage: any) => {
          const stageApproval = this.buildStageApprovalDetails(stage, run);
          return {
            ...stage,
            stageApproval,
          };
        },
      );
      const approvedStages =
        stages.filter((stage: any) => stage.stageApproval?.fullyApproved).length || 0;
      const totalStages = stages.length || 0;

      let pendingApprovalDisplay: string | null = null;
      let pendingApproverNames: string[] = [];
      let stagePendingContext = this.getNextPendingStageLevel(stages);
      if (!stagePendingContext && pendingStep && projectId) {
        const actorMap = actorMapByProject.get(projectId) || new Map<number, any>();
        const roleMap = roleMapByProject.get(projectId) || new Map<number, string>();
        const assignedUserIds = pendingStep.assignedUserIds?.length
          ? pendingStep.assignedUserIds
          : pendingStep.assignedUserId
            ? [pendingStep.assignedUserId]
            : [];

        pendingApproverNames = assignedUserIds
          .map((userId) => actorMap.get(userId)?.displayName || `User #${userId}`)
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
        const actorMap = actorMapByProject.get(projectId) || new Map<number, any>();
        const roleMap = roleMapByProject.get(projectId) || new Map<number, string>();
        const assignedUserIds = stagePendingContext.level.assignedUserIds?.length
          ? stagePendingContext.level.assignedUserIds
          : stagePendingContext.level.assignedUserId
            ? [stagePendingContext.level.assignedUserId]
            : [];
        pendingApproverNames = assignedUserIds
          .map((userId: number) => actorMap.get(userId)?.displayName || `User #${userId}`)
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
          stagePendingContext.stage.stageTemplate?.name || `#${stagePendingContext.stage.id}`
        } - Level ${stagePendingContext.level.stepOrder} Pending: ${
          pendingApproverNames.join(', ') || stagePendingContext.level.stepName || 'Approval Pending'
        }`;
      }

      return {
        ...inspection,
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
              step.signerDisplayName || step.signature?.signerDisplayName || null,
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

  private async checkPredecessor(
    prevActivityId: number,
    epsNodeId: number,
  ): Promise<{ approved: boolean; activityName: string }> {
    const prevActivity = await this.activityRepo.findOne({
      where: { id: prevActivityId },
    });
    if (!prevActivity) return { approved: true, activityName: 'Unknown' };

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
