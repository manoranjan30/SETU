import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  QualityInspection,
  InspectionStatus,
} from './entities/quality-inspection.entity';
import { QualityActivity } from './entities/quality-activity.entity';
import { QualityActivityList } from './entities/quality-activity-list.entity';

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

    // 3. SEQUENCE ENFORCEMENT
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

    // 4. Create Inspection
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

    return this.inspectionRepo.save(inspection);
  }

  async updateStatus(
    id: number,
    dto: UpdateInspectionStatusDto,
    userId?: string,
  ) {
    const inspection = await this.inspectionRepo.findOne({ where: { id } });
    if (!inspection) throw new NotFoundException('Inspection not found');

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

    return this.inspectionRepo.save(inspection);
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
