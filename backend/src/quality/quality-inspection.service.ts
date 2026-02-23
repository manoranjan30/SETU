import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  QualityInspection,
  InspectionStatus,
} from './entities/quality-inspection.entity';
import { QualityActivity } from './entities/quality-activity.entity';
import { QualityActivityList } from './entities/quality-activity-list.entity';
import { QualityChecklistTemplate } from './entities/quality-checklist-template.entity';
import { QualityInspectionStage, StageStatus } from './entities/quality-inspection-stage.entity';
import { QualityExecutionItem } from './entities/quality-execution-item.entity';
import { QualitySignature } from './entities/quality-signature.entity';
import { QualitySequenceEdge } from './entities/quality-sequence-edge.entity';
import { QualityActivityStatus } from './entities/quality-activity.entity';
import { AuditService } from '../audit/audit.service';
import { ComplianceService } from './compliance.service';

export interface CreateInspectionDto {
  projectId: number;
  epsNodeId: number;
  listId: number;
  activityId: number;
  comments?: string;
  requestDate?: string;
}

export interface UpdateInspectionStatusDto {
  status: InspectionStatus; // APPROVED, REJECTED
  comments?: string;
  inspectedBy?: string;
  inspectionDate?: string;
}

@Injectable()
export class QualityInspectionService {
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
    private readonly complianceService: ComplianceService,
    private readonly auditService: AuditService,
  ) { }

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
          items: { itemTemplate: { sequence: 'ASC' } }
        }
      }
    });
    if (!inspection) throw new NotFoundException('Inspection not found');
    return inspection;
  }

  async create(dto: CreateInspectionDto, userId?: string) {
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
    if (!activity.assignedChecklistIds || activity.assignedChecklistIds.length === 0) {
      throw new BadRequestException('At least one checklist must be assigned to the activity before raising an RFI.');
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
      // inspectedBy: userId // Requestor
    });

    // Ensure listId matches activity
    inspection.listId = activity.listId;

    const savedInspection = await this.inspectionRepo.save(inspection);

    // 7. Initialize Stages from ALL assigned checklists
    if (activity.assignedChecklistIds && activity.assignedChecklistIds.length > 0) {
      const templates = await this.checklistTemplateRepo.find({
        where: { id: In(activity.assignedChecklistIds) },
        relations: ['stages', 'stages.items'],
      });

      for (const template of templates) {
        if (!template.stages) continue;

        for (const stageTemplate of template.stages) {
          const stage = this.stageRepo.create({
            inspectionId: savedInspection.id,
            stageTemplateId: stageTemplate.id,
            status: StageStatus.PENDING,
          });
          const savedStage = await this.stageRepo.save(stage);

          // Initialize items for each stage
          if (stageTemplate.items) {
            for (const itemTemplate of stageTemplate.items) {
              const item = this.executionItemRepo.create({
                stageId: savedStage.id,
                itemTemplateId: itemTemplate.id,
                isOk: false,
              });
              await this.executionItemRepo.save(item);
            }
          }
        }
      }
    }

    // 8. Transition Activity to UNDER_INSPECTION once stages are ready
    await this.activityRepo.update(activity.id, { status: QualityActivityStatus.UNDER_INSPECTION });

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
      items?: { id: number; value: string; isOk: boolean; remarks?: string; photos?: string[] }[];
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
    if (data.items) {
      for (const itemUpdate of data.items) {
        await this.executionItemRepo.update(itemUpdate.id, {
          value: itemUpdate.value,
          isOk: itemUpdate.isOk,
          remarks: itemUpdate.remarks,
          photos: itemUpdate.photos,
        });
      }
    }

    // 2. Update Stage
    stage.status = data.status;
    if (data.status === StageStatus.COMPLETED || data.status === StageStatus.APPROVED) {
      stage.completedAt = new Date();
      stage.completedBy = data.userId;
    }

    // 3. Handle Signature & Digital Locking
    if (data.signature) {
      const updatedItems = await this.executionItemRepo.find({ where: { stageId } });
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

    return this.stageRepo.save(stage);
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
                failingItems.push({ itemId: item.id, itemText: item.itemTemplate?.itemText });
              }
            }
          }
        }
      }

      if (hasItems && !allItemsChecked) {
        console.error('Approval validation failed for inspection', id, 'Failing items:', failingItems);
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
    }

    return saved;
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
}
