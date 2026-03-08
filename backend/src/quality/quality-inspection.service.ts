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
import { QualityActivity } from './entities/quality-activity.entity';
import { QualityActivityList } from './entities/quality-activity-list.entity';
import { QualityChecklistTemplate } from './entities/quality-checklist-template.entity';
import {
  QualityInspectionStage,
  StageStatus,
} from './entities/quality-inspection-stage.entity';
import { QualityExecutionItem } from './entities/quality-execution-item.entity';
import { QualitySignature } from './entities/quality-signature.entity';
import { QualitySequenceEdge } from './entities/quality-sequence-edge.entity';
import { QualityActivityStatus } from './entities/quality-activity.entity';
import { AuditService } from '../audit/audit.service';
import { ComplianceService } from './compliance.service';
import { InspectionWorkflowService } from './inspection-workflow.service';
import { PushNotificationService } from '../notifications/push-notification.service';

export interface CreateInspectionDto {
  projectId: number;
  epsNodeId: number;
  listId: number;
  activityId: number;
  comments?: string;
  requestDate?: string;
  signature?: { data: string; role: string; signedBy: string };
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
    private readonly complianceService: ComplianceService,
    private readonly auditService: AuditService,
    private readonly inspectionWorkflowService: InspectionWorkflowService,
    private readonly pushService: PushNotificationService,
  ) {}

  async getInspections(projectId: number, epsNodeId?: number, listId?: number) {
    const query = this.inspectionRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.activity', 'activity')
      .where('i.projectId = :projectId', { projectId });

    if (epsNodeId) {
      query.andWhere('i.epsNodeId = :epsNodeId', { epsNodeId });
    }
    if (listId) {
      query.andWhere('i.listId = :listId', { listId });
    }

    return query.orderBy('i.createdAt', 'DESC').getMany();
  }

  async getMyPendingInspections(projectId: number, userId: number) {
    return this.inspectionRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.activity', 'activity')
      .leftJoinAndSelect('i.epsNode', 'eps')
      .where('i.projectId = :projectId', { projectId })
      .andWhere('i.requestedById = :userId', { userId })
      .andWhere('i.status NOT IN (:...closedStatuses)', {
        closedStatuses: ['APPROVED', 'CANCELED', 'CLOSED'],
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
    return inspection;
  }

  async create(dto: CreateInspectionDto, userId?: string) {
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

    // 2. Check if there is already a PENDING inspection for this activity at this location
    // Actually, we should check if there is an OPEN inspection (PENDING/IN_PROGRESS)
    // Or check if latest is NOT Rejected/Canceled?
    // Let's stick to checking PENDING for now.
    const existingPending = await this.inspectionRepo.findOne({
      where: {
        activityId: dto.activityId,
        epsNodeId: dto.epsNodeId,
        status: InspectionStatus.PENDING,
      },
    });

    if (existingPending) {
      // Check if user is trying to update/re-request?
      // If so, update logic is needed. But for "Create", throwing error is safer.
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

    // 6. Create Inspection
    const inspection = this.inspectionRepo.create({
      projectId: dto.projectId,
      epsNodeId: dto.epsNodeId,
      listId: dto.listId, // We trust frontend passed correct listId matching activity? Or fetch from activity?
      // Better to use activity.listId for consistency
      activityId: dto.activityId,
      sequence: activity.sequence,
      comments: dto.comments,
      requestDate: dto.requestDate || new Date().toISOString().split('T')[0],
      status: InspectionStatus.PENDING,
      requestedById: userId ? parseInt(userId, 10) : undefined,
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
                user: dto.signature.signedBy || userId || 'Unknown',
              },
            });
            const signature = this.signatureRepo.create({
              stageId: savedStage.id,
              role: dto.signature.role || 'Site Engineer',
              signedBy: dto.signature.signedBy || userId || 'Unknown',
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
      userId ? parseInt(userId, 10) : 0,
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
      userId: string;
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

    // 2. Update Stage
    stage.status = data.status;
    if (
      data.status === StageStatus.COMPLETED ||
      data.status === StageStatus.APPROVED
    ) {
      stage.completedAt = new Date();
      stage.completedBy = data.userId;
    }

    // 3. Handle Signature & Digital Locking
    if (data.signature) {
      const updatedItems = await this.executionItemRepo.find({
        where: { stageId },
      });
      const fingerprint = this.complianceService.generateFingerprint({
        stageId,
        items: updatedItems,
        metadata: {
          timestamp: new Date(),
          user: data.userId,
          gps: data.metadata?.gps,
        },
      });

      const signature = this.signatureRepo.create({
        stageId,
        role: data.signature.role,
        signedBy: data.userId,
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
  ) {
    const stage = await this.stageRepo.findOne({
      where: { id: stageId, inspectionId },
      relations: ['inspection', 'stageTemplate', 'items'],
    });
    if (!stage)
      throw new NotFoundException('Stage not found for this inspection');

    if (stage.status === StageStatus.APPROVED) {
      throw new BadRequestException('Stage is already approved');
    }

    // Mark stage as APPROVED
    stage.status = StageStatus.APPROVED;
    stage.completedAt = new Date();
    stage.completedBy = String(userId);
    await this.stageRepo.save(stage);

    // Save signature if provided
    if (signatureData) {
      const fingerprint = this.complianceService.generateFingerprint({
        stageId,
        items: stage.items || [],
        metadata: { timestamp: new Date(), user: String(userId) },
      });
      const signature = this.signatureRepo.create({
        stageId,
        role: 'Approver',
        signedBy: String(userId),
        signatureData,
        lockHash: fingerprint,
        metadata: { timestamp: new Date() },
      });
      await this.signatureRepo.save(signature);
    }

    // Recount stages and update parent inspection status
    const inspection = await this.inspectionRepo.findOne({
      where: { id: inspectionId },
      relations: ['stages'],
    });
    if (!inspection) throw new NotFoundException('Inspection not found');

    const totalStages = inspection.stages.length;
    const approvedStages = inspection.stages.filter(
      (s) =>
        s.status === StageStatus.APPROVED || s.status === StageStatus.COMPLETED,
    ).length;

    if (approvedStages > 0 && approvedStages < totalStages) {
      inspection.status = InspectionStatus.PARTIALLY_APPROVED;
    } else if (approvedStages === totalStages) {
      // All stages done — still set PARTIALLY_APPROVED until final approval
      inspection.status = InspectionStatus.PARTIALLY_APPROVED;
    }
    await this.inspectionRepo.save(inspection);

    // Audit
    await this.auditService.log(
      userId,
      'QUALITY',
      'STAGE_APPROVE',
      String(inspectionId),
      inspection.epsNodeId,
      { stageId, stageName: stage.stageTemplate?.name, comments },
    );

    // Notify RFI raiser of progress
    if (inspection.requestedById) {
      this.pushService
        .sendToUsers(
          [inspection.requestedById],
          'Stage Approved ✓',
          `Stage "${stage.stageTemplate?.name}" approved for RFI #${inspectionId}. ${approvedStages}/${totalStages} complete.`,
          { inspectionId: String(inspectionId), type: 'STAGE_APPROVED' },
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
    };
  }

  async finalApprove(
    inspectionId: number,
    userId: number,
    signatureData?: string,
    comments?: string,
  ) {
    const inspection = await this.inspectionRepo.findOne({
      where: { id: inspectionId },
      relations: ['stages', 'stages.stageTemplate'],
    });
    if (!inspection) throw new NotFoundException('Inspection not found');

    // Guard: All stages must be APPROVED or COMPLETED
    const pendingStages = inspection.stages.filter(
      (s) =>
        s.status !== StageStatus.APPROVED && s.status !== StageStatus.COMPLETED,
    );
    if (pendingStages.length > 0) {
      const pendingNames = pendingStages
        .map((s) => s.stageTemplate?.name || `Stage #${s.id}`)
        .join(', ');
      throw new BadRequestException(
        `Cannot give final approval. The following stages are not yet approved: ${pendingNames}`,
      );
    }

    // Already approved
    if (inspection.status === InspectionStatus.APPROVED) {
      throw new BadRequestException('Inspection is already fully approved');
    }

    // Save final signature if provided
    if (signatureData) {
      const fingerprint = this.complianceService.generateFingerprint({
        stageId: 0,
        items: [],
        metadata: { timestamp: new Date(), user: String(userId) },
      });
      const signature = this.signatureRepo.create({
        role: 'Final Authority',
        signedBy: String(userId),
        signatureData,
        lockHash: fingerprint,
        metadata: { timestamp: new Date() },
      });
      await this.signatureRepo.save(signature);
    }

    // Mark as APPROVED
    inspection.status = InspectionStatus.APPROVED;
    inspection.inspectionDate = new Date().toISOString().split('T')[0];
    inspection.inspectedBy = String(userId);
    if (comments) inspection.comments = comments;
    await this.inspectionRepo.save(inspection);

    // Audit
    await this.auditService.log(
      userId,
      'QUALITY',
      'FINAL_APPROVE_RFI',
      String(inspectionId),
      inspection.epsNodeId,
      { comments },
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
