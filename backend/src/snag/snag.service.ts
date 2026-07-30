import { randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve, sep } from 'path';
import { PassThrough } from 'stream';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import { EpsNodeType } from '../eps/eps.entity';
import { ProjectProfile } from '../eps/project-profile.entity';
import { QualityFloorStructure } from '../quality/entities/quality-floor-structure.entity';
import { QualityRoom } from '../quality/entities/quality-room.entity';
import { QualityUnit } from '../quality/entities/quality-unit.entity';
import { ReleaseStrategyApproverMode } from '../planning/entities/release-strategy-step.entity';
import { ReleaseStrategyService } from '../planning/release-strategy.service';
import { CustomerMilestoneService } from '../milestone/customer-milestone.service';
import {
  SnagCommonChecklistItem,
  SnagCommonChecklistStatus,
  SnagList,
  SnagListStatus,
} from './entities/snag-list.entity';
import {
  SnagRound,
  SnagRoundDesnagPhaseStatus,
  SnagRoundSnagPhaseStatus,
} from './entities/snag-round.entity';
import { SnagItem, SnagItemStatus } from './entities/snag-item.entity';
import { SnagPhoto, SnagPhotoType } from './entities/snag-photo.entity';
import {
  SnagReleaseApproval,
  SnagReleaseApprovalStatus,
} from './entities/snag-release-approval.entity';
import {
  SnagReleaseApprovalStep,
  SnagReleaseApprovalStepStatus,
} from './entities/snag-release-approval-step.entity';
import {
  AdvanceApprovalDto,
  BulkCloseSnagItemsDto,
  BulkRectifySnagItemsDto,
  CloseSnagItemDto,
  CreateSnagItemDto,
  CreateSnagListDto,
  FinalClosureSnagRoundDto,
  HoldSnagItemDto,
  RectifySnagItemDto,
  ResetSnagRoundDto,
  RejectSnagRectificationDto,
  SkipSnagRoundDto,
  SubmitDesnagApprovalDto,
  SubmitSnagPhaseDto,
  CreateSnagProcessActivityDto,
  MoveSnagProcessActivityDto,
  ReorderSnagProcessActivitiesDto,
  ReorderSnagProcessStepsDto,
  UpsertSnagCommonPointDto,
  UpsertSnagProcessStepDto,
  UpdateSnagCommonChecklistDto,
} from './dto/snag.dto';
import { SnagProcessStep } from './entities/snag-process-step.entity';
import { SnagProcessActivity } from './entities/snag-process-activity.entity';
import { SnagCommonPoint } from './entities/snag-common-point.entity';
import { User } from '../users/user.entity';

type SnagCarryForwardRepos = {
  snagRoundRepo: Repository<SnagRound>;
  snagItemRepo: Repository<SnagItem>;
  snagPhotoRepo: Repository<SnagPhoto>;
};

const DEFAULT_SNAG_PROCESS_STEPS = [
  { name: 'Snag 1 / De-snag 1', workflowSerialNo: 1 },
  { name: 'Snag 2 / De-snag 2', workflowSerialNo: 2 },
  { name: 'Snag 3 / De-snag 3', workflowSerialNo: 3 },
];

@Injectable()
export class SnagService {
  constructor(
    @InjectRepository(SnagList)
    private readonly snagListRepo: Repository<SnagList>,
    @InjectRepository(SnagRound)
    private readonly snagRoundRepo: Repository<SnagRound>,
    @InjectRepository(SnagItem)
    private readonly snagItemRepo: Repository<SnagItem>,
    @InjectRepository(SnagPhoto)
    private readonly snagPhotoRepo: Repository<SnagPhoto>,
    @InjectRepository(SnagReleaseApproval)
    private readonly approvalRepo: Repository<SnagReleaseApproval>,
    @InjectRepository(SnagReleaseApprovalStep)
    private readonly approvalStepRepo: Repository<SnagReleaseApprovalStep>,
    @InjectRepository(SnagProcessStep)
    private readonly processStepRepo: Repository<SnagProcessStep>,
    @InjectRepository(SnagProcessActivity)
    private readonly processActivityRepo: Repository<SnagProcessActivity>,
    @InjectRepository(SnagCommonPoint)
    private readonly commonPointRepo: Repository<SnagCommonPoint>,
    @InjectRepository(QualityFloorStructure)
    private readonly floorStructureRepo: Repository<QualityFloorStructure>,
    @InjectRepository(QualityUnit)
    private readonly qualityUnitRepo: Repository<QualityUnit>,
    @InjectRepository(QualityRoom)
    private readonly qualityRoomRepo: Repository<QualityRoom>,
    @InjectRepository(ProjectProfile)
    private readonly projectProfileRepo: Repository<ProjectProfile>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly releaseStrategyService: ReleaseStrategyService,
    private readonly milestoneService: CustomerMilestoneService,
  ) {}

  async listProcessSteps(projectId: number) {
    const steps = await this.processStepRepo.find({
      where: { projectId },
      relations: ['activities', 'activities.activity', 'activities.commonPoints'],
      order: {
        workflowSerialNo: 'ASC',
        activities: { sortOrder: 'ASC', commonPoints: { sortOrder: 'ASC' } },
      } as any,
    });
    if (steps.length > 0) return steps;

    const defaults = await this.processStepRepo.save(
      DEFAULT_SNAG_PROCESS_STEPS.map((step) =>
        this.processStepRepo.create({
          projectId,
          name: step.name,
          workflowSerialNo: step.workflowSerialNo,
          description: null,
          isActive: true,
        }),
      ),
    );

    return defaults.map((step) =>
      this.processStepRepo.create({
        ...step,
        activities: [],
      }),
    );
  }

  async saveProcessStep(
    projectId: number,
    dto: UpsertSnagProcessStepDto,
    stepId?: number,
  ) {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Process step name is required');
    if (!Number.isInteger(dto.workflowSerialNo) || dto.workflowSerialNo < 1) {
      throw new BadRequestException('Workflow serial number must be 1 or more');
    }

    const existing = stepId
      ? await this.processStepRepo.findOne({ where: { id: stepId, projectId } })
      : null;
    if (stepId && !existing) {
      throw new NotFoundException('Snag process step not found');
    }

    const duplicate = await this.processStepRepo.findOne({
      where: { projectId, workflowSerialNo: dto.workflowSerialNo },
    });
    if (duplicate && duplicate.id !== stepId) {
      throw new BadRequestException(
        'Workflow serial number is already used in this project',
      );
    }

    await this.processStepRepo.save(
      this.processStepRepo.create({
        ...(existing || {}),
        projectId,
        name,
        description: dto.description?.trim() || null,
        workflowSerialNo: dto.workflowSerialNo,
        isActive: dto.isActive ?? existing?.isActive ?? true,
        raisePhotoRequired:
          dto.raisePhotoRequired ?? existing?.raisePhotoRequired ?? false,
        rectificationPhotoRequired:
          dto.rectificationPhotoRequired ??
          existing?.rectificationPhotoRequired ??
          false,
        desnagCompletionPhotoRequired:
          dto.desnagCompletionPhotoRequired ??
          existing?.desnagCompletionPhotoRequired ??
          false,
      }),
    );
    return this.listProcessSteps(projectId);
  }

  async deleteProcessStep(projectId: number, stepId: number) {
    const step = await this.processStepRepo.findOne({
      where: { id: stepId, projectId },
    });
    if (!step) throw new NotFoundException('Snag process step not found');
    await this.processStepRepo.delete(step.id);
    return this.listProcessSteps(projectId);
  }

  async reorderProcessSteps(
    projectId: number,
    dto: ReorderSnagProcessStepsDto,
  ) {
    const rows = await this.processStepRepo.find({ where: { projectId } });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const changed = dto.steps.map((item) => {
      const row = byId.get(item.id);
      if (!row) throw new NotFoundException('Snag process step not found');
      row.workflowSerialNo = item.workflowSerialNo;
      return row;
    });
    await this.processStepRepo.save(changed);
    return this.listProcessSteps(projectId);
  }

  async listActivityMap(projectId: number) {
    return this.listProcessSteps(projectId);
  }

  async addProcessActivity(
    projectId: number,
    dto: CreateSnagProcessActivityDto,
  ) {
    const step = await this.processStepRepo.findOne({
      where: { id: dto.processStepId, projectId },
    });
    if (!step) throw new NotFoundException('Snag process step not found');

    const existing = await this.processActivityRepo.findOne({
      where: { projectId, activityId: dto.activityId },
    });
    if (existing) {
      throw new BadRequestException(
        'This activity is already mapped to a snag process step',
      );
    }

    await this.processActivityRepo.save(
      this.processActivityRepo.create({
        projectId,
        processStepId: step.id,
        activityId: dto.activityId,
        sortOrder: dto.sortOrder ?? 0,
        isActive: true,
      }),
    );
    return this.listProcessSteps(projectId);
  }

  async moveProcessActivity(
    projectId: number,
    mappingId: number,
    dto: MoveSnagProcessActivityDto,
  ) {
    const mapping = await this.processActivityRepo.findOne({
      where: { id: mappingId, projectId },
    });
    if (!mapping) throw new NotFoundException('Snag process activity not found');
    const step = await this.processStepRepo.findOne({
      where: { id: dto.processStepId, projectId },
    });
    if (!step) throw new NotFoundException('Snag process step not found');
    mapping.processStepId = step.id;
    mapping.sortOrder = dto.sortOrder ?? mapping.sortOrder;
    await this.processActivityRepo.save(mapping);
    return this.listProcessSteps(projectId);
  }

  async reorderProcessActivities(
    projectId: number,
    dto: ReorderSnagProcessActivitiesDto,
  ) {
    const rows = await this.processActivityRepo.find({ where: { projectId } });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const changed = dto.activities.map((item) => {
      const row = byId.get(item.id);
      if (!row) throw new NotFoundException('Snag process activity not found');
      row.sortOrder = item.sortOrder;
      return row;
    });
    await this.processActivityRepo.save(changed);
    return this.listProcessSteps(projectId);
  }

  async deleteProcessActivity(projectId: number, mappingId: number) {
    const mapping = await this.processActivityRepo.findOne({
      where: { id: mappingId, projectId },
    });
    if (!mapping) throw new NotFoundException('Snag process activity not found');
    await this.processActivityRepo.delete(mapping.id);
    return this.listProcessSteps(projectId);
  }

  async saveCommonPoint(
    projectId: number,
    processActivityId: number,
    dto: UpsertSnagCommonPointDto,
    pointId?: number,
  ) {
    const mapping = await this.processActivityRepo.findOne({
      where: { id: processActivityId, projectId },
    });
    if (!mapping) throw new NotFoundException('Snag process activity not found');
    const title = dto.title?.trim();
    if (!title) throw new BadRequestException('Common snag point is required');
    const existing = pointId
      ? await this.commonPointRepo.findOne({ where: { id: pointId, projectId } })
      : null;
    if (pointId && !existing) {
      throw new NotFoundException('Common snag point not found');
    }

    await this.commonPointRepo.save(
      this.commonPointRepo.create({
        ...(existing || {}),
        projectId,
        processActivityId: mapping.id,
        activityId: mapping.activityId,
        title,
        description: dto.description?.trim() || null,
        severity: dto.severity?.trim() || 'medium',
        requiresEvidence: dto.requiresEvidence ?? existing?.requiresEvidence ?? false,
        sortOrder: dto.sortOrder ?? existing?.sortOrder ?? 0,
        isActive: dto.isActive ?? existing?.isActive ?? true,
      }),
    );
    return this.listProcessSteps(projectId);
  }

  async deleteCommonPoint(projectId: number, pointId: number) {
    const point = await this.commonPointRepo.findOne({
      where: { id: pointId, projectId },
    });
    if (!point) throw new NotFoundException('Common snag point not found');
    await this.commonPointRepo.delete(point.id);
    return this.listProcessSteps(projectId);
  }

  private async getMaxRoundNumber(projectId: number) {
    const configured = await this.processStepRepo.count({
      where: { projectId, isActive: true },
    });
    return configured > 0 ? configured : DEFAULT_SNAG_PROCESS_STEPS.length;
  }

  private async buildConfiguredCommonChecklist(projectId: number) {
    const points = await this.commonPointRepo.find({
      where: { projectId, isActive: true },
      relations: ['processActivity', 'processActivity.activity'],
      order: {
        sortOrder: 'ASC',
      } as any,
    });

    return points.map((point, index): SnagCommonChecklistItem => ({
      id: randomUUID(),
      title: point.title,
      qualityRoomId: null,
      roomLabel: null,
      trade:
        point.processActivity?.activity?.activityName || null,
      sequence: index,
      status: 'IDENTIFIED',
      remarks: point.description || null,
      linkedSnagItemId: null,
      updatedAt: null,
      updatedById: null,
    }));
  }

  async listUnits(projectId: number) {
    const floors = await this.floorStructureRepo.find({
      where: { projectId },
      relations: ['floor', 'tower', 'tower.parent', 'units', 'units.rooms'],
      order: {
        tower: { order: 'ASC' },
        floor: { order: 'ASC' },
        units: { sequence: 'ASC' },
      } as any,
    });

    const lists = await this.snagListRepo.find({
      where: { projectId },
    });
    const listByUnitId = new Map<number, SnagList>(
      lists.map((item) => [item.qualityUnitId, item]),
    );

    return floors.flatMap((floor) => {
      const tower = floor.tower;
      const block =
        tower?.parent && tower.parent.type === EpsNodeType.BLOCK
          ? tower.parent
          : null;

      return (floor.units || []).map((unit) => {
        const snagList = listByUnitId.get(unit.id);
        return {
          qualityUnitId: unit.id,
          unitLabel: unit.name,
          floorId: floor.floorId,
          floorLabel: floor.floor?.name || `Floor ${floor.floorId}`,
          towerId: floor.towerId,
          towerLabel: tower?.name || `Tower ${floor.towerId}`,
          blockId: block?.id ?? null,
          blockLabel: block?.name ?? null,
          roomCount: (unit.rooms || []).length,
          snagListId: snagList?.id ?? null,
          currentRound: snagList?.currentRound ?? 1,
          overallStatus: snagList?.overallStatus ?? 'unready',
          commonChecklistCount: snagList?.commonChecklist?.length ?? 0,
        };
      });
    });
  }

  async createOrGetList(
    projectId: number,
    dto: CreateSnagListDto,
    userId: number,
  ) {
    const unit = await this.qualityUnitRepo.findOne({
      where: { id: dto.qualityUnitId },
      relations: ['rooms'],
    });
    if (!unit) throw new NotFoundException('Quality unit not found');

    let snagList = await this.snagListRepo.findOne({
      where: { projectId, qualityUnitId: dto.qualityUnitId },
      relations: ['rounds'],
    });

    if (!snagList) {
      const commonChecklist = await this.buildConfiguredCommonChecklist(projectId);
      snagList = await this.snagListRepo.save(
        this.snagListRepo.create({
          projectId,
          epsNodeId: dto.epsNodeId ?? null,
          qualityUnitId: dto.qualityUnitId,
          unitLabel: unit.name,
          currentRound: 1,
          overallStatus: SnagListStatus.READY_FOR_SNAG,
          commonChecklist,
          createdById: userId,
        }),
      );

      await this.snagRoundRepo.save(
        this.snagRoundRepo.create({
          snagListId: snagList.id,
          roundNumber: 1,
          snagPhaseStatus: SnagRoundSnagPhaseStatus.OPEN,
          desnagPhaseStatus: SnagRoundDesnagPhaseStatus.LOCKED,
          initiatedById: userId,
        }),
      );
    }

    return this.getListDetail(projectId, snagList.id);
  }

  async resetReadyForSnag(projectId: number, listId: number) {
    const snagList = await this.requireList(projectId, listId);
    if (snagList.overallStatus !== SnagListStatus.READY_FOR_SNAG) {
      throw new BadRequestException(
        'Only ready-for-snag units can be reset to unready',
      );
    }

    const itemCount = await this.snagItemRepo.count({
      where: { snagListId: snagList.id },
    });
    if (itemCount > 0) {
      throw new BadRequestException(
        'Unit cannot be reset to unready after snag points are raised',
      );
    }

    await this.snagListRepo.delete(snagList.id);
    return { reset: true };
  }

  async getProjectAnalytics(projectId: number) {
    const [units, lists] = await Promise.all([
      this.listUnits(projectId),
      this.snagListRepo.find({
        where: { projectId },
        relations: [
          'qualityUnit',
          'qualityUnit.floorStructure',
          'qualityUnit.floorStructure.tower',
          'qualityUnit.floorStructure.floor',
          'rounds',
          'rounds.items',
        ],
      }),
    ]);

    const statusCounts = this.countBy(units, (unit) => unit.overallStatus);
    const processCounts = this.countBy(
      units.filter((unit) => unit.snagListId),
      (unit) => `Snag ${unit.currentRound}`,
    );
    const towerCounts = this.countBy(
      units.filter((unit) => unit.snagListId),
      (unit) => unit.towerLabel || 'Unassigned Tower',
    );
    const floorCounts = this.countBy(
      units.filter((unit) => unit.snagListId),
      (unit) => unit.floorLabel || 'Unassigned Floor',
    );

    const allItems = lists.flatMap((list) =>
      (list.rounds || []).flatMap((round) =>
        (round.items || []).map((item) => ({
          item,
          list,
          round,
          tower:
            list.qualityUnit?.floorStructure?.tower?.name || 'Unassigned Tower',
          floor:
            list.qualityUnit?.floorStructure?.floor?.name || 'Unassigned Floor',
        })),
      ),
    );
    const openItems = allItems.filter(({ item }) => item.status === SnagItemStatus.OPEN);
    const rectifiedItems = allItems.filter(
      ({ item }) => item.status === SnagItemStatus.RECTIFIED,
    );
    const closedItems = allItems.filter(({ item }) => item.status === SnagItemStatus.CLOSED);
    const rejectedItems = allItems.filter(
      ({ item }) => (item.notSatisfactoryCount || 0) > 0,
    );
    const now = Date.now();
    const ageInDays = (date?: Date | null) => {
      if (!date) return 0;
      const time = new Date(date).getTime();
      if (Number.isNaN(time)) return 0;
      return Math.max(0, Math.floor((now - time) / 86400000));
    };

    return {
      summary: {
        totalUnits: units.length,
        notReadyUnits: units.filter((unit) => unit.overallStatus === 'unready').length,
        readyUnits: units.filter((unit) => unit.overallStatus === 'ready_for_snag').length,
        snaggingUnits: units.filter((unit) => unit.overallStatus === 'snagging').length,
        desnaggingUnits: units.filter((unit) => unit.overallStatus === 'desnagging').length,
        customerInspectionReadyUnits: units.filter(
          (unit) => unit.overallStatus === 'handover_ready',
        ).length,
        totalSnagPoints: allItems.length,
        openSnagPoints: openItems.length,
        rectifiedPendingDesnag: rectifiedItems.length,
        closedSnagPoints: closedItems.length,
        notSatisfactoryPoints: rejectedItems.length,
        averageOpenAgeDays: openItems.length
          ? Number(
              (
                openItems.reduce(
                  (sum, entry) => sum + ageInDays(entry.item.raisedAt),
                  0,
                ) / openItems.length
              ).toFixed(1),
            )
          : 0,
      },
      byStatus: this.mapToRows(statusCounts),
      byProcessStep: this.mapToRows(processCounts),
      byTower: this.mapToRows(towerCounts),
      byFloor: this.mapToRows(floorCounts).slice(0, 12),
      byRoom: this.mapToRows(
        this.countBy(allItems, ({ item }) => item.roomLabel || 'Common Area'),
      ).slice(0, 12),
      byActivity: this.mapToRows(
        this.countBy(allItems, ({ item }) => item.trade || 'Others'),
      ).slice(0, 12),
      byPriority: this.mapToRows(
        this.countBy(allItems, ({ item }) => item.priority || 'medium'),
      ),
      agingBuckets: [
        { label: '0-3 days', count: openItems.filter(({ item }) => ageInDays(item.raisedAt) <= 3).length },
        { label: '4-7 days', count: openItems.filter(({ item }) => ageInDays(item.raisedAt) >= 4 && ageInDays(item.raisedAt) <= 7).length },
        { label: '8-14 days', count: openItems.filter(({ item }) => ageInDays(item.raisedAt) >= 8 && ageInDays(item.raisedAt) <= 14).length },
        { label: '15+ days', count: openItems.filter(({ item }) => ageInDays(item.raisedAt) >= 15).length },
      ],
      recurringSnags: this.mapToRows(
        this.countBy(allItems, ({ item }) => item.defectTitle || 'Untitled snag'),
      ).slice(0, 10),
      blockedUnits: lists
        .filter((list) =>
          (list.rounds || []).some((round) =>
            (round.items || []).some((item) => (item.notSatisfactoryCount || 0) > 0),
          ),
        )
        .slice(0, 10)
        .map((list) => ({
          listId: list.id,
          unitLabel: list.unitLabel,
          currentRound: list.currentRound,
          status: list.overallStatus,
        })),
    };
  }

  async getListDetail(projectId: number, listId: number) {
    const snagList = await this.snagListRepo.findOne({
      where: { id: listId, projectId },
      relations: [
        'rounds',
        'rounds.finalClosureSignedBy',
        'rounds.items',
        'rounds.items.photos',
        'rounds.approvals',
        'rounds.approvals.steps',
      ],
    });
    if (!snagList) throw new NotFoundException('Snag list not found');

    const unit = await this.qualityUnitRepo.findOne({
      where: { id: snagList.qualityUnitId },
      relations: ['rooms'],
      order: { rooms: { sequence: 'ASC' } } as any,
    });

    return {
      ...snagList,
      commonChecklist: this.normalizeChecklistItems(snagList.commonChecklist),
      unit,
      processSteps: await this.listProcessSteps(projectId),
      rounds: [...(snagList.rounds || [])]
        .sort((a, b) => a.roundNumber - b.roundNumber)
        .map((round) => this.serializeRound(round)),
    };
  }

  async updateCommonChecklist(
    projectId: number,
    listId: number,
    dto: UpdateSnagCommonChecklistDto,
    userId: number,
  ) {
    const snagList = await this.requireList(projectId, listId);
    snagList.commonChecklist = await this.sanitizeChecklistItems(
      snagList,
      dto.items || [],
      userId,
    );
    await this.snagListRepo.save(snagList);

    return {
      commonChecklist: snagList.commonChecklist,
    };
  }

  async addSnagItem(
    projectId: number,
    listId: number,
    roundNumber: number,
    dto: CreateSnagItemDto,
    userId: number,
  ) {
    const snagList = await this.requireList(projectId, listId);
    const round = await this.requireRound(snagList.id, roundNumber);
    const photoConfig = await this.getPhotoRequirementConfig(
      projectId,
      round.roundNumber,
    );
    if (photoConfig.raisePhotoRequired && !dto.beforePhotoUrls?.length) {
      throw new BadRequestException(
        'Before photos are required while raising a snag',
      );
    }
    if (round.isSkipped) {
      throw new BadRequestException(
        'Skipped snag cycles cannot accept new snag items',
      );
    }
    if (round.snagPhaseStatus !== SnagRoundSnagPhaseStatus.OPEN) {
      throw new BadRequestException(
        'Snag phase is already submitted for this round',
      );
    }
    if (
      snagList.overallStatus === SnagListStatus.READY_FOR_SNAG ||
      snagList.overallStatus === SnagListStatus.RELEASED
    ) {
      snagList.overallStatus = SnagListStatus.SNAGGING;
      await this.snagListRepo.save(snagList);
    }

    const room = await this.resolveRoomForList(snagList, dto.qualityRoomId);
    const item = await this.snagItemRepo.save(
      this.snagItemRepo.create({
        snagListId: snagList.id,
        snagRoundId: round.id,
        qualityRoomId: room?.id ?? null,
        roomLabel: room?.name ?? dto.roomLabel?.trim() ?? null,
        defectTitle: dto.defectTitle,
        defectDescription: dto.defectDescription ?? null,
        trade: dto.trade ?? null,
        priority: dto.priority ?? 'medium',
        raisedById: userId,
        raisedAt: new Date(),
      }),
    );

    await this.savePhotos(item.id, dto.beforePhotoUrls || [], SnagPhotoType.BEFORE);

    if (dto.linkedChecklistItemId) {
      await this.attachChecklistItemToSnag(
        snagList.id,
        dto.linkedChecklistItemId,
        item.id,
        userId,
      );
    }

    return this.getListDetail(projectId, listId);
  }

  async bulkRectifyItems(
    projectId: number,
    listId: number,
    roundNumber: number,
    dto: BulkRectifySnagItemsDto,
    userId: number,
  ) {
    const snagList = await this.requireList(projectId, listId);
    const round = await this.requireRound(snagList.id, roundNumber);
    const photoConfig = await this.getPhotoRequirementConfig(
      projectId,
      round.roundNumber,
    );
    if (photoConfig.rectificationPhotoRequired && !dto.afterPhotoUrls?.length) {
      throw new BadRequestException(
        'After photos are required while rectifying snag items',
      );
    }
    const items = await this.requireBulkItems(projectId, dto.itemIds);

    for (const item of items) {
      if (item.snagListId !== snagList.id || item.snagRoundId !== round.id) {
        throw new BadRequestException(
          'Selected snag items must belong to the same unit round',
        );
      }
      if (item.status !== SnagItemStatus.OPEN) {
        throw new BadRequestException(
          'Only open snag items can be marked as rectified',
        );
      }
      item.status = SnagItemStatus.RECTIFIED;
      item.rectifiedById = userId;
      item.rectifiedAt = new Date();
      item.rectificationNotes = dto.rectificationNotes?.trim() || null;
    }

    await this.snagItemRepo.save(items);
    for (const item of items) {
      await this.savePhotos(item.id, dto.afterPhotoUrls || [], SnagPhotoType.AFTER);
      await this.syncChecklistStatusForSnag(
        item.snagListId,
        item.id,
        'RECTIFIED',
        userId,
      );
    }

    await this.openDesnagWhenAllRectified(projectId, snagList, round, userId);

    return this.getListDetail(projectId, snagList.id);
  }

  async rectifyItem(
    projectId: number,
    itemId: number,
    dto: RectifySnagItemDto,
    userId: number,
  ) {
    const item = await this.requireItem(projectId, itemId);
    const round = await this.requireRoundById(projectId, item.snagRoundId);
    const photoConfig = await this.getPhotoRequirementConfig(
      projectId,
      round.roundNumber,
    );
    if (photoConfig.rectificationPhotoRequired && !dto.afterPhotoUrls?.length) {
      throw new BadRequestException(
        'After photos are required while rectifying a snag',
      );
    }
    if (item.status !== SnagItemStatus.OPEN) {
      throw new BadRequestException('Only open snag items can be rectified');
    }

    item.status = SnagItemStatus.RECTIFIED;
    item.rectifiedById = userId;
    item.rectifiedAt = new Date();
    item.rectificationNotes = dto.rectificationNotes?.trim() || null;
    await this.snagItemRepo.save(item);
    await this.savePhotos(item.id, dto.afterPhotoUrls || [], SnagPhotoType.AFTER);
    await this.syncChecklistStatusForSnag(
      item.snagListId,
      item.id,
      'RECTIFIED',
      userId,
    );

    const snagList = await this.requireList(projectId, item.snagListId);
    await this.openDesnagWhenAllRectified(projectId, snagList, round, userId);

    return this.getListDetail(projectId, item.snagListId);
  }

  async bulkCloseItems(
    projectId: number,
    listId: number,
    roundNumber: number,
    dto: BulkCloseSnagItemsDto,
    userId: number,
  ) {
    const snagList = await this.requireList(projectId, listId);
    const round = await this.requireRound(snagList.id, roundNumber);
    const photoConfig = await this.getPhotoRequirementConfig(
      projectId,
      round.roundNumber,
    );
    if (
      photoConfig.desnagCompletionPhotoRequired &&
      !dto.closurePhotoUrls?.length
    ) {
      throw new BadRequestException(
        'Closure photos are required while marking de-snag completed',
      );
    }
    const items = await this.requireBulkItems(projectId, dto.itemIds);

    for (const item of items) {
      if (item.snagListId !== snagList.id || item.snagRoundId !== round.id) {
        throw new BadRequestException(
          'Selected snag items must belong to the same unit round',
        );
      }
      if (item.status !== SnagItemStatus.RECTIFIED) {
        throw new BadRequestException(
          'Only rectified snag items can be closed',
        );
      }
      item.status = SnagItemStatus.CLOSED;
      item.closedById = userId;
      item.closedAt = new Date();
      item.closureRemarks = dto.remarks?.trim() || null;
    }

    await this.snagItemRepo.save(items);
    for (const item of items) {
      await this.savePhotos(
        item.id,
        dto.closurePhotoUrls || [],
        SnagPhotoType.CLOSURE,
      );
      await this.syncChecklistStatusForSnag(
        item.snagListId,
        item.id,
        'RECTIFIED',
        userId,
      );
    }

    await this.advanceRoundIfAllDesnagCompleted(projectId, snagList, round);

    return this.getListDetail(projectId, snagList.id);
  }

  async closeItem(
    projectId: number,
    itemId: number,
    dto: CloseSnagItemDto,
    userId: number,
  ) {
    const item = await this.requireItem(projectId, itemId);
    const round = await this.requireRoundById(projectId, item.snagRoundId);
    const photoConfig = await this.getPhotoRequirementConfig(
      projectId,
      round.roundNumber,
    );
    if (
      photoConfig.desnagCompletionPhotoRequired &&
      !dto.closurePhotoUrls?.length
    ) {
      throw new BadRequestException(
        'Closure photos are required while marking de-snag completed',
      );
    }
    if (item.status !== SnagItemStatus.RECTIFIED) {
      throw new BadRequestException('Only rectified snag items can be closed');
    }

    item.status = SnagItemStatus.CLOSED;
    item.closedById = userId;
    item.closedAt = new Date();
    item.closureRemarks = dto.remarks?.trim() || null;
    await this.snagItemRepo.save(item);
    await this.savePhotos(
      item.id,
      dto.closurePhotoUrls || [],
      SnagPhotoType.CLOSURE,
    );
    await this.syncChecklistStatusForSnag(
      item.snagListId,
      item.id,
      'RECTIFIED',
      userId,
    );

    const snagList = await this.requireList(projectId, item.snagListId);
    await this.advanceRoundIfAllDesnagCompleted(projectId, snagList, round);

    return this.getListDetail(projectId, item.snagListId);
  }

  async rejectRectification(
    projectId: number,
    itemId: number,
    dto: RejectSnagRectificationDto,
    userId: number,
  ) {
    const item = await this.requireItem(projectId, itemId);
    if (item.status !== SnagItemStatus.RECTIFIED) {
      throw new BadRequestException(
        'Only rectified snag items can be marked not satisfactory',
      );
    }

    item.status = SnagItemStatus.OPEN;
    item.notSatisfactoryCount = (item.notSatisfactoryCount || 0) + 1;
    item.lastNotSatisfactoryRemarks = dto.remarks?.trim() || null;
    item.lastNotSatisfactoryAt = new Date();
    item.lastNotSatisfactoryById = userId;
    item.rectifiedAt = null;
    item.rectifiedById = null;
    await this.snagItemRepo.save(item);
    await this.syncChecklistStatusForSnag(
      item.snagListId,
      item.id,
      'IDENTIFIED',
      userId,
    );
    await this.snagListRepo.update(item.snagListId, {
      overallStatus: SnagListStatus.SNAGGING,
    });

    return this.getListDetail(projectId, item.snagListId);
  }

  async holdItem(projectId: number, itemId: number, dto: HoldSnagItemDto) {
    const item = await this.requireItem(projectId, itemId);
    if (item.status === SnagItemStatus.CLOSED) {
      throw new BadRequestException('Closed snag items cannot be put on hold');
    }

    item.status = SnagItemStatus.ON_HOLD;
    item.holdReason = dto.holdReason;
    await this.snagItemRepo.save(item);
    await this.syncChecklistStatusForSnag(
      item.snagListId,
      item.id,
      'IDENTIFIED',
      null,
    );

    return this.getListDetail(projectId, item.snagListId);
  }

  async deleteItem(
    projectId: number,
    itemId: number,
    currentUser: {
      id?: number;
      roles?: string[];
      permissions?: string[];
    } | null,
  ) {
    const item = await this.snagItemRepo.findOne({
      where: { id: itemId },
      relations: ['snagList', 'snagRound'],
    });
    if (!item || item.snagList?.projectId !== projectId) {
      throw new NotFoundException('Snag item not found');
    }

    const isDeleteAdmin = this.userHasExactPermission(
      currentUser,
      'QUALITY.SNAG.DELETE',
    );

    if (!isDeleteAdmin) {
      throw new ForbiddenException(
        'Only authorized admins can permanently delete snag items',
      );
    }

    await this.snagItemRepo.manager.transaction(async (manager) => {
      const txListRepo = manager.getRepository(SnagList);
      const txItemRepo = manager.getRepository(SnagItem);

      const snagList = await txListRepo.findOne({
        where: { id: item.snagListId, projectId },
      });
      if (!snagList) {
        throw new NotFoundException('Snag list not found');
      }

      this.clearChecklistLinksForDeletedItems(
        snagList,
        new Set([item.id]),
        currentUser?.id ?? null,
      );

      await txListRepo.save(snagList);
      await txItemRepo.delete(item.id);
    });

    return this.getListDetail(projectId, item.snagListId);
  }

  async submitSnagPhase(
    projectId: number,
    roundId: number,
    dto: SubmitSnagPhaseDto,
    userId: number,
  ) {
    const round = await this.requireRoundById(projectId, roundId);
    if (round.isSkipped) {
      throw new BadRequestException(
        'Skipped snag cycles are already released to the next stage',
      );
    }
    round.snagPhaseStatus = SnagRoundSnagPhaseStatus.SUBMITTED;
    round.snagSubmittedAt = new Date();
    round.snagSubmittedById = userId;
    round.snagSubmittedComments = dto.comments ?? null;
    round.desnagPhaseStatus = SnagRoundDesnagPhaseStatus.OPEN;
    await this.snagRoundRepo.save(round);
    await this.snagListRepo.update(round.snagListId, {
      overallStatus: SnagListStatus.DESNAGGING,
    });
    return this.getListDetail(projectId, round.snagListId);
  }

  async submitDesnagForApproval(
    projectId: number,
    roundId: number,
    dto: SubmitDesnagApprovalDto,
    userId: number,
  ) {
    const round = await this.requireRoundById(projectId, roundId);
    if (round.isSkipped) {
      throw new BadRequestException(
        'Skipped snag cycles do not need release approval',
      );
    }
    const items = await this.snagItemRepo.find({
      where: { snagRoundId: round.id },
    });
    const unresolved = items.filter(
      (item) =>
        item.status !== SnagItemStatus.CLOSED &&
        item.status !== SnagItemStatus.ON_HOLD,
    );
    if (unresolved.length > 0) {
      throw new BadRequestException(
        'All snag items must be closed or held before release approval',
      );
    }

    round.desnagPhaseStatus = SnagRoundDesnagPhaseStatus.APPROVAL_PENDING;
    round.desnagReleaseComments = dto.comments ?? null;
    await this.snagRoundRepo.save(round);

    let approval = await this.approvalRepo.findOne({
      where: { snagRoundId: round.id },
      relations: ['steps'],
    });

    if (!approval) {
      const resolution = await this.releaseStrategyService.resolveStrategy(
        projectId,
        {
          projectId,
          moduleCode: 'QUALITY',
          processCode: 'SNAG_RELEASE_APPROVAL',
          documentType: 'SNAG_ROUND_RELEASE',
          amount: 0,
        } as any,
      );

      const resolvedSteps = (
        resolution.matchedStrategy?.resolvedSteps?.length
          ? resolution.matchedStrategy.resolvedSteps
          : [
              {
                levelNo: 1,
                stepName: 'De-snag Release Approval',
                approverMode: ReleaseStrategyApproverMode.USER,
                userId,
                userIds: [userId],
                roleId: null,
              },
            ]
      ).slice(0, 1);

      approval = await this.approvalRepo.save(
        this.approvalRepo.create({
          snagRoundId: round.id,
          projectId,
          currentStepOrder: 1,
          status: SnagReleaseApprovalStatus.PENDING,
          releaseStrategyId: resolution.matchedStrategy?.id ?? null,
          processCode:
            resolution.matchedStrategy?.processCode ??
            'SNAG_RELEASE_APPROVAL',
        }),
      );

      await this.approvalStepRepo.save(
        resolvedSteps.map((step: any, index: number) =>
          this.approvalStepRepo.create({
            approvalId: approval!.id,
            stepOrder: step.levelNo ?? index + 1,
            stepName: step.stepName,
            assignedRoleId: step.roleId ?? null,
            assignedUserId: step.userId ?? null,
            assignedUserIds:
              step.userIds || (step.userId ? [step.userId] : null),
            status:
              (step.levelNo ?? index + 1) === 1
                ? SnagReleaseApprovalStepStatus.PENDING
                : SnagReleaseApprovalStepStatus.WAITING,
          }),
        ),
      );
    }

    return this.getListDetail(projectId, round.snagListId);
  }

  async finalClosureRound(
    projectId: number,
    roundId: number,
    dto: FinalClosureSnagRoundDto,
    userId: number,
  ) {
    const round = await this.requireRoundById(projectId, roundId);
    const snagList = round.snagList || (await this.requireList(projectId, round.snagListId));
    if (snagList.currentRound !== round.roundNumber) {
      throw new BadRequestException(
        'Only the current snag cycle can be finally closed',
      );
    }
    if (round.isSkipped) {
      throw new BadRequestException('Skipped snag cycles do not need final closure');
    }

    const items = await this.snagItemRepo.find({
      where: { snagRoundId: round.id },
    });
    if (!items.length) {
      throw new BadRequestException(
        'At least one snag point is required before final closure',
      );
    }
    const unresolved = items.filter(
      (item) => item.status !== SnagItemStatus.CLOSED,
    );
    if (unresolved.length > 0) {
      throw new BadRequestException(
        'All snag points must be closed before final closure',
      );
    }

    const signer = userId
      ? await this.userRepo.findOne({ where: { id: userId } })
      : null;

    round.snagPhaseStatus = SnagRoundSnagPhaseStatus.SUBMITTED;
    round.desnagPhaseStatus = SnagRoundDesnagPhaseStatus.APPROVED;
    round.desnagReleasedAt = round.desnagReleasedAt ?? new Date();
    round.desnagReleaseComments =
      round.desnagReleaseComments ?? 'All de-snag points completed';
    round.finalClosureSignedAt = new Date();
    round.finalClosureSignedById = userId || null;
    round.finalClosureSignatureData =
      dto.signatureData?.trim() ||
      signer?.signatureData ||
      signer?.signatureImageUrl ||
      null;
    round.finalClosureRemarks = dto.remarks?.trim() || null;
    await this.snagRoundRepo.save(round);

    const maxRoundNumber = await this.getMaxRoundNumber(projectId);
    if (round.roundNumber >= maxRoundNumber) {
      snagList.overallStatus = SnagListStatus.HANDOVER_READY;
      snagList.currentRound = maxRoundNumber;
    } else {
      snagList.currentRound = round.roundNumber + 1;
      snagList.overallStatus = SnagListStatus.READY_FOR_SNAG;
      await this.openNextRoundWithCarryForward(
        snagList,
        round.roundNumber + 1,
      );
    }

    await this.snagListRepo.save(snagList);
    this.triggerMilestoneRefresh(projectId);
    return this.getListDetail(projectId, snagList.id);
  }

  async skipRound(
    projectId: number,
    roundId: number,
    dto: SkipSnagRoundDto,
    userId: number,
  ) {
    const round = await this.requireRoundById(projectId, roundId);
    const snagList = round.snagList || (await this.requireList(projectId, round.snagListId));

    if (snagList.currentRound !== round.roundNumber) {
      throw new BadRequestException(
        'Only the current snag cycle can be skipped',
      );
    }
    if (round.isSkipped) {
      throw new BadRequestException('This snag cycle is already skipped');
    }
    if (
      round.snagPhaseStatus !== SnagRoundSnagPhaseStatus.OPEN ||
      round.desnagPhaseStatus !== SnagRoundDesnagPhaseStatus.LOCKED
    ) {
      throw new BadRequestException(
        'Only a fresh snag cycle can be skipped',
      );
    }

    const existingItemCount = await this.snagItemRepo.count({
      where: { snagRoundId: round.id },
    });
    if (existingItemCount > 0) {
      throw new BadRequestException(
        'Snag cycle cannot be skipped after snag items have been raised',
      );
    }

    const approvalCount = await this.approvalRepo.count({
      where: { snagRoundId: round.id },
    });
    if (approvalCount > 0) {
      throw new BadRequestException(
        'Snag cycle cannot be skipped after release approval has started',
      );
    }

    const now = new Date();
    const reason = dto.reason?.trim() || null;
    round.isSkipped = true;
    round.skippedAt = now;
    round.skippedById = userId;
    round.skipReason = reason;
    round.snagPhaseStatus = SnagRoundSnagPhaseStatus.SUBMITTED;
    round.snagSubmittedAt = now;
    round.snagSubmittedById = userId;
    round.snagSubmittedComments = reason ?? 'Snag cycle skipped';
    round.desnagPhaseStatus = SnagRoundDesnagPhaseStatus.APPROVED;
    round.desnagReleasedAt = now;
    round.desnagReleaseComments = reason ?? 'Snag cycle skipped';
    await this.snagRoundRepo.save(round);

    const maxRoundNumber = await this.getMaxRoundNumber(projectId);
    if (round.roundNumber >= maxRoundNumber) {
      snagList.overallStatus = SnagListStatus.HANDOVER_READY;
      snagList.currentRound = maxRoundNumber;
    } else {
      snagList.currentRound = round.roundNumber + 1;
      snagList.overallStatus = SnagListStatus.RELEASED;
      await this.openNextRoundWithCarryForward(
        snagList,
        round.roundNumber + 1,
      );
    }

    await this.snagListRepo.save(snagList);
    this.triggerMilestoneRefresh(projectId);
    return this.getListDetail(projectId, snagList.id);
  }

  async resetRound(
    projectId: number,
    roundId: number,
    dto: ResetSnagRoundDto,
    userId: number,
  ) {
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException('Reset reason is required');
    }

    const round = await this.requireRoundById(projectId, roundId);

    await this.snagListRepo.manager.transaction(async (manager) => {
      const txListRepo = manager.getRepository(SnagList);
      const txRoundRepo = manager.getRepository(SnagRound);
      const txItemRepo = manager.getRepository(SnagItem);
      const txPhotoRepo = manager.getRepository(SnagPhoto);

      const snagList = await txListRepo.findOne({
        where: { id: round.snagListId, projectId },
      });
      if (!snagList) {
        throw new NotFoundException('Snag list not found');
      }

      const roundsToDelete = await txRoundRepo.find({
        where: {
          snagListId: snagList.id,
          roundNumber: MoreThanOrEqual(round.roundNumber),
        },
        order: { roundNumber: 'ASC' },
      });
      if (!roundsToDelete.length) {
        throw new NotFoundException('Snag round not found');
      }

      const roundIdsToDelete = roundsToDelete.map((entry) => entry.id);
      const itemsToDelete = roundIdsToDelete.length
        ? await txItemRepo.find({
            where: { snagRoundId: In(roundIdsToDelete) },
          })
        : [];
      const deletedItemIds = new Set(itemsToDelete.map((item) => item.id));

      this.clearChecklistLinksForDeletedItems(snagList, deletedItemIds, userId);

      await txRoundRepo.delete(roundIdsToDelete);

      await txRoundRepo.save(
        txRoundRepo.create({
          snagListId: snagList.id,
          roundNumber: round.roundNumber,
          snagPhaseStatus: SnagRoundSnagPhaseStatus.OPEN,
          desnagPhaseStatus: SnagRoundDesnagPhaseStatus.LOCKED,
          initiatedById: userId,
          snagSubmittedAt: null,
          snagSubmittedById: null,
          snagSubmittedComments: null,
          desnagReleasedAt: null,
          desnagReleaseComments: null,
          isSkipped: false,
          skippedAt: null,
          skippedById: null,
          skipReason: null,
        }),
      );

      snagList.currentRound = round.roundNumber;
      snagList.overallStatus = SnagListStatus.SNAGGING;

      await this.openNextRoundWithCarryForwardUsingRepos(
        snagList,
        round.roundNumber,
        {
          snagRoundRepo: txRoundRepo,
          snagItemRepo: txItemRepo,
          snagPhotoRepo: txPhotoRepo,
        },
      );

      await txListRepo.save(snagList);
    });

    this.triggerMilestoneRefresh(projectId);
    return this.getListDetail(projectId, round.snagListId);
  }

  async advanceApproval(
    projectId: number,
    approvalId: number,
    dto: AdvanceApprovalDto,
    userId: number,
  ) {
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, projectId },
      relations: ['steps', 'snagRound', 'snagRound.snagList'],
    });
    if (!approval) throw new NotFoundException('Approval not found');

    const currentStep = (approval.steps || []).find(
      (step) => step.stepOrder === approval.currentStepOrder,
    );
    if (!currentStep) {
      throw new BadRequestException('No pending approval step found');
    }

    const canAct = await this.canUserActOnStep(projectId, userId, currentStep);
    if (!canAct) {
      throw new BadRequestException(
        'You are not assigned to this snag release step',
      );
    }

    currentStep.actedByUserId = userId;
    currentStep.actedAt = new Date();
    currentStep.comments = dto.comments ?? null;

    if (dto.action === 'REJECT') {
      currentStep.status = SnagReleaseApprovalStepStatus.REJECTED;
      approval.status = SnagReleaseApprovalStatus.REJECTED;
      approval.snagRound.desnagPhaseStatus = SnagRoundDesnagPhaseStatus.REJECTED;
      await this.approvalStepRepo.save(currentStep);
      await this.snagRoundRepo.save(approval.snagRound);
      await this.approvalRepo.save(approval);
      return this.getListDetail(projectId, approval.snagRound.snagListId);
    }

    currentStep.status = SnagReleaseApprovalStepStatus.APPROVED;
    await this.approvalStepRepo.save(currentStep);

    const nextStep = (approval.steps || []).find(
      (step) => step.stepOrder === approval.currentStepOrder + 1,
    );
    if (nextStep) {
      nextStep.status = SnagReleaseApprovalStepStatus.PENDING;
      approval.currentStepOrder = nextStep.stepOrder;
      await this.approvalStepRepo.save(nextStep);
      await this.approvalRepo.save(approval);
      return this.getListDetail(projectId, approval.snagRound.snagListId);
    }

    approval.status = SnagReleaseApprovalStatus.APPROVED;
    approval.snagRound.desnagPhaseStatus = SnagRoundDesnagPhaseStatus.APPROVED;
    approval.snagRound.desnagReleasedAt = new Date();
    await this.approvalRepo.save(approval);
    await this.snagRoundRepo.save(approval.snagRound);

    const snagList = approval.snagRound.snagList;
    snagList.currentRound = approval.snagRound.roundNumber;
    snagList.overallStatus = SnagListStatus.DESNAGGING;
    await this.snagListRepo.save(snagList);
    this.triggerMilestoneRefresh(projectId);
    return this.getListDetail(projectId, snagList.id);
  }

  async generateStatusReportPdf(
    projectId: number,
    listId: number,
    roundNumber: number,
  ): Promise<Buffer> {
    const snagList = await this.snagListRepo.findOne({
      where: { id: listId, projectId },
      relations: [
        'qualityUnit',
        'rounds',
        'rounds.items',
        'rounds.finalClosureSignedBy',
      ],
    });
    if (!snagList) throw new NotFoundException('Snag list not found');

    const round = (snagList.rounds || []).find(
      (item) => item.roundNumber === roundNumber,
    );
    if (!round) throw new NotFoundException('Snag round not found');

    const unit = await this.qualityUnitRepo.findOne({
      where: { id: snagList.qualityUnitId },
      relations: ['floorStructure', 'floorStructure.floor', 'floorStructure.tower', 'rooms'],
    } as any);
    const projectProfile = await this.projectProfileRepo.findOne({
      where: { epsNode: { id: projectId } },
    });
    const logoPath =
      this.resolveUploadPath(projectProfile?.companyLogoUrl) ||
      this.resolveUploadPath(projectProfile?.projectLogoUrl);

    return this.buildPdfBuffer((doc) => {
      this.writeSnagStatusHeader(doc, {
        projectName: projectProfile?.projectName || `Project ${projectId}`,
        location: [
          (unit as any)?.floorStructure?.tower?.name,
          (unit as any)?.floorStructure?.floor?.name,
          snagList.unitLabel,
        ]
          .filter(Boolean)
          .join(' / '),
        contractor: '-',
        date: this.formatDate(new Date()),
        logoPath,
      });
      this.writeSnagStatusTable(doc, round);
      this.writeSnagFinalClosure(doc, round);
    });
  }

  private buildPdfBuffer(
    writer: (doc: PDFKit.PDFDocument) => void,
  ): Promise<Buffer> {
    return new Promise((resolvePromise, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const buffers: Buffer[] = [];
      const stream = new PassThrough();

      stream.on('data', (chunk) => buffers.push(chunk));
      stream.on('end', () => resolvePromise(Buffer.concat(buffers)));
      stream.on('error', (error) => reject(error));

      doc.pipe(stream);
      writer(doc);
      doc.end();
    });
  }

  private resolveUploadPath(url?: string | null): string | null {
    if (!url) return null;
    if (!url.startsWith('/uploads/') && !url.startsWith('uploads/')) {
      return null;
    }
    const uploadsRoot = resolve(process.cwd(), 'uploads');
    const relative = url.replace(/^\/?uploads\//, '');
    const candidate = resolve(uploadsRoot, relative);
    if (candidate !== uploadsRoot && !candidate.startsWith(uploadsRoot + sep)) {
      return null;
    }
    return existsSync(candidate) ? candidate : null;
  }

  private formatPdfValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '-';
    return String(value);
  }

  private formatDate(value?: Date | string | null): string {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toISOString().slice(0, 10);
  }

  private writeSnagStatusHeader(
    doc: PDFKit.PDFDocument,
    meta: {
      projectName: string;
      location: string;
      contractor: string;
      date: string;
      logoPath: string | null;
    },
  ) {
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const top = 30;

    doc.rect(left, top, width, 116).stroke('#111827');
    doc.rect(left, top, 92, 58).stroke('#111827');
    if (meta.logoPath) {
      try {
        doc.image(readFileSync(meta.logoPath), left + 8, top + 8, {
          fit: [76, 42],
          align: 'center',
          valign: 'center',
        });
      } catch {
        doc.font('Helvetica-Bold').fontSize(7).text('PROJECT LOGO', left + 12, top + 24);
      }
    } else {
      doc.font('Helvetica-Bold').fontSize(7).text('PROJECT LOGO', left + 12, top + 24);
    }

    doc.rect(left + 92, top, width - 184, 58).stroke('#111827');
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('PURAVANKARA LIMITED/PROVIDENT HOUSING LIMITED', left + 100, top + 9, {
        width: width - 200,
        align: 'center',
      })
      .fontSize(9)
      .text('FORMAT FOR UNIT & COMMON AREA CLEARANCE', left + 100, top + 27, {
        width: width - 200,
        align: 'center',
      })
      .fontSize(8)
      .text('ACTIVITY :SNAGGING & HANDOVER', left + 100, top + 43, {
        width: width - 200,
        align: 'center',
      });

    doc.rect(left + width - 92, top, 92, 58).stroke('#111827');
    doc.font('Helvetica-Bold').fontSize(9).text('F-QA-09', left + width - 84, top + 13, {
      width: 76,
      align: 'center',
    });
    doc.font('Helvetica').fontSize(8).text('Rev. No:01', left + width - 84, top + 32, {
      width: 76,
      align: 'center',
    });

    const metaTop = top + 58;
    const rowHeight = 19.33;
    const labelWidth = 72;
    const rightLabelX = left + width - 142;
    [
      ['Project :', meta.projectName, '', ''],
      ['Location :', meta.location || '-', 'Date:', meta.date],
      ['Contractor :', meta.contractor, '', ''],
    ].forEach((row, index) => {
      const y = metaTop + rowHeight * index;
      doc.rect(left, y, width, rowHeight).stroke('#111827');
      doc.font('Helvetica-Bold').fontSize(7.5).text(row[0], left + 5, y + 6);
      doc.font('Helvetica').fontSize(7.5).text(row[1], left + labelWidth, y + 6, {
        width: rightLabelX - left - labelWidth - 8,
      });
      if (row[2]) {
        doc.font('Helvetica-Bold').text(row[2], rightLabelX, y + 6);
        doc.font('Helvetica').text(row[3], rightLabelX + 36, y + 6, {
          width: 96,
        });
      }
    });

    doc.y = top + 124;
    doc.font('Helvetica').fontSize(7.5).text('Note : Please tick appropriate box as per requirements');
    doc.moveDown(0.3);
  }

  private writeSnagStatusTable(doc: PDFKit.PDFDocument, round: SnagRound) {
    const left = doc.page.margins.left;
    const widths = [30, 235, 54, 36, 36, 36, 36, 92];
    const totalWidth = widths.reduce((sum, width) => sum + width, 0);
    const bottom = doc.page.height - doc.page.margins.bottom;
    const drawHeader = () => {
      const y = doc.y;
      doc.rect(left, y, totalWidth, 44).stroke('#111827');
      const xs = widths.reduce<number[]>((acc, width, index) => {
        acc.push(index === 0 ? left : acc[index - 1] + widths[index - 1]);
        return acc;
      }, []);
      xs.slice(1).forEach((x) => doc.moveTo(x, y).lineTo(x, y + 44).stroke('#111827'));
      doc
        .font('Helvetica-Bold')
        .fontSize(7)
        .text('Sl No', xs[0] + 3, y + 15, { width: widths[0] - 6, align: 'center' })
        .text('Clearance Points/Rectification Points', xs[1] + 4, y + 15, {
          width: widths[1] - 8,
          align: 'center',
        })
        .text('Rectification Points attended to', xs[2], y + 5, {
          width: widths[2] + widths[3] + widths[4],
          align: 'center',
        })
        .text('PL/PHL QA & QC', xs[5], y + 5, {
          width: widths[5] + widths[6],
          align: 'center',
        })
        .text('Remarks', xs[7] + 4, y + 15, { width: widths[7] - 8, align: 'center' });
      doc.text('Contractor Engineer', xs[2] + 2, y + 19, {
        width: widths[2] + widths[3] + widths[4] - 4,
        align: 'center',
      });
      doc.fontSize(6.8);
      ['Yes', 'No', '', 'Yes', 'No'].forEach((label, index) => {
        if (!label) return;
        doc.text(label, xs[index + 2] + 2, y + 33, {
          width: widths[index + 2] - 4,
          align: 'center',
        });
      });
      doc.y = y + 44;
    };

    const rows = this.buildSnagStatusRows(round);
    drawHeader();
    rows.forEach((row) => {
      const minHeight = row.kind === 'item' ? 26 : 20;
      const textHeight = doc.heightOfString(row.text, {
        width: widths[1] - 14,
      });
      const height = Math.max(minHeight, textHeight + 12);
      if (doc.y + height > bottom) {
        doc.addPage();
        drawHeader();
      }
      this.drawSnagStatusRow(doc, left, widths, row, height);
    });
  }

  private buildSnagStatusRows(round: SnagRound) {
    const items = [...(round.items || [])].sort((a, b) => {
      const trade = this.formatPdfValue(a.trade).localeCompare(
        this.formatPdfValue(b.trade),
        undefined,
        { numeric: true, sensitivity: 'base' },
      );
      if (trade !== 0) return trade;
      const room = this.formatPdfValue(a.roomLabel).localeCompare(
        this.formatPdfValue(b.roomLabel),
        undefined,
        { numeric: true, sensitivity: 'base' },
      );
      if (room !== 0) return room;
      return a.id - b.id;
    });

    const rows: Array<{
      kind: 'group' | 'room' | 'item';
      serial?: number;
      text: string;
      item?: SnagItem;
    }> = [];
    let currentTrade = '';
    let currentRoom = '';
    let serial = 1;

    for (const item of items) {
      const trade = this.formatPdfValue(item.trade || 'Others');
      const room = this.formatPdfValue(item.roomLabel || 'Common Area');
      if (trade !== currentTrade) {
        currentTrade = trade;
        currentRoom = '';
        rows.push({ kind: 'group', text: trade });
      }
      if (room !== currentRoom) {
        currentRoom = room;
        rows.push({ kind: 'room', text: room });
      }
      rows.push({
        kind: 'item',
        serial,
        text: item.defectDescription
          ? `${item.defectTitle} - ${item.defectDescription}`
          : item.defectTitle,
        item,
      });
      serial += 1;
    }

    if (!rows.length) {
      rows.push({ kind: 'item', serial: 1, text: 'No snag points raised' });
    }
    return rows;
  }

  private drawSnagStatusRow(
    doc: PDFKit.PDFDocument,
    left: number,
    widths: number[],
    row: {
      kind: 'group' | 'room' | 'item';
      serial?: number;
      text: string;
      item?: SnagItem;
    },
    height: number,
  ) {
    const y = doc.y;
    const totalWidth = widths.reduce((sum, width) => sum + width, 0);
    const xs = widths.reduce<number[]>((acc, width, index) => {
      acc.push(index === 0 ? left : acc[index - 1] + widths[index - 1]);
      return acc;
    }, []);

    if (row.kind !== 'item') {
      doc.rect(left, y, totalWidth, height).fillAndStroke('#f3f4f6', '#9ca3af');
      doc
        .fillColor('#111827')
        .font(row.kind === 'group' ? 'Helvetica-Bold' : 'Helvetica-Oblique')
        .fontSize(7.5)
        .text(row.kind === 'group' ? row.text : `  ${row.text}`, xs[1] + 4, y + 6, {
          width: totalWidth - widths[0] - 8,
        });
      doc.fillColor('#000000');
      doc.y = y + height;
      return;
    }

    doc.rect(left, y, totalWidth, height).stroke('#9ca3af');
    xs.slice(1).forEach((x) => doc.moveTo(x, y).lineTo(x, y + height).stroke('#9ca3af'));
    const item = row.item;
    const rectifiedYes =
      item?.status === SnagItemStatus.RECTIFIED ||
      item?.status === SnagItemStatus.CLOSED ||
      item?.status === SnagItemStatus.ON_HOLD;
    const rectifiedNo =
      item?.status === SnagItemStatus.OPEN &&
      (item.notSatisfactoryCount || 0) > 0;
    const qaYes = item?.status === SnagItemStatus.CLOSED;
    const qaNo = item?.status === SnagItemStatus.RECTIFIED && !qaYes;
    const remarks =
      item?.lastNotSatisfactoryRemarks ||
      item?.closureRemarks ||
      item?.rectificationNotes ||
      item?.holdReason ||
      '';

    doc
      .font('Helvetica')
      .fontSize(7)
      .text(String(row.serial ?? ''), xs[0] + 3, y + 8, {
        width: widths[0] - 6,
        align: 'center',
      })
      .text(`    ${row.text}`, xs[1] + 4, y + 6, {
        width: widths[1] - 8,
      })
      .text(this.formatPdfValue(remarks), xs[7] + 4, y + 6, {
        width: widths[7] - 8,
      });
    this.drawPdfCheckbox(doc, xs[2], y, widths[2], rectifiedYes);
    this.drawPdfCheckbox(doc, xs[3], y, widths[3], rectifiedNo);
    this.drawPdfCheckbox(doc, xs[5], y, widths[5], qaYes);
    this.drawPdfCheckbox(doc, xs[6], y, widths[6], qaNo);
    doc.y = y + height;
  }

  private drawPdfCheckbox(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    checked: boolean,
  ) {
    const boxSize = 9;
    const boxX = x + (width - boxSize) / 2;
    const boxY = y + 8;
    doc.rect(boxX, boxY, boxSize, boxSize).stroke('#111827');
    if (checked) {
      doc
        .lineWidth(1.2)
        .moveTo(boxX + 1.8, boxY + 4.8)
        .lineTo(boxX + 3.8, boxY + 7)
        .lineTo(boxX + 7.5, boxY + 2.2)
        .stroke('#111827')
        .lineWidth(1);
    }
  }

  private writeSnagFinalClosure(doc: PDFKit.PDFDocument, round: SnagRound) {
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const height = 88;
    if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
    const y = doc.y + 12;
    doc.rect(left, y, width, height).stroke('#111827');
    doc.font('Helvetica-Bold').fontSize(8).text(
      `Final Closure and Sign Off - Snag ${round.roundNumber}`,
      left + 8,
      y + 8,
      { width: width - 16 },
    );
    doc.font('Helvetica').fontSize(7.5).text(
      `Closure Status: ${round.finalClosureSignedAt ? 'Signed by Checker' : 'Pending Checker Signoff'}`,
      left + 8,
      y + 26,
      { width: width / 2 - 16 },
    );
    doc.text(`Date: ${this.formatDate(round.finalClosureSignedAt)}`, left + width / 2, y + 26, {
      width: width / 2 - 8,
    });
    doc.text(
      `Checker: ${this.getUserDisplayName(round.finalClosureSignedBy)}`,
      left + 8,
      y + 42,
      { width: width / 2 - 16 },
    );
    doc.text(`Remarks: ${this.formatPdfValue(round.finalClosureRemarks)}`, left + width / 2, y + 42, {
      width: width / 2 - 8,
    });

    const signature = round.finalClosureSignatureData;
    const signaturePath = this.resolveUploadPath(signature);
    if (signature?.startsWith('data:image/')) {
      try {
        const data = signature.split(',')[1];
        doc.image(Buffer.from(data, 'base64'), left + width - 150, y + 54, {
          fit: [130, 26],
        });
      } catch {
        doc.font('Helvetica-Oblique').text('Digital signature recorded', left + width - 150, y + 62);
      }
    } else if (signaturePath) {
      try {
        doc.image(readFileSync(signaturePath), left + width - 150, y + 54, {
          fit: [130, 26],
        });
      } catch {
        doc.font('Helvetica-Oblique').text('Digital signature recorded', left + width - 150, y + 62);
      }
    } else if (round.finalClosureSignedAt) {
      doc.font('Helvetica-Oblique').text('Digital signature recorded', left + width - 150, y + 62);
    }
  }

  private getUserDisplayName(user?: User | null) {
    return user?.displayName || user?.username || '-';
  }

  private serializeRound(round: SnagRound) {
    return {
      ...round,
      items: [...(round.items || [])]
        .sort((a, b) => this.getStatusSortOrder(a.status) - this.getStatusSortOrder(b.status))
        .map((item) => this.serializeItem(item)),
      approvals: [...(round.approvals || [])].map((approval) => ({
        ...approval,
        steps: [...(approval.steps || [])].sort(
          (a, b) => a.stepOrder - b.stepOrder,
        ),
      })),
    };
  }

  private serializeItem(item: SnagItem) {
    const photos = item.photos || [];
    return {
      ...item,
      beforePhotos: photos.filter((photo) => photo.type === SnagPhotoType.BEFORE),
      afterPhotos: photos.filter((photo) => photo.type === SnagPhotoType.AFTER),
      closurePhotos: photos.filter(
        (photo) => photo.type === SnagPhotoType.CLOSURE,
      ),
    };
  }

  private getStatusSortOrder(status: SnagItemStatus) {
    switch (status) {
      case SnagItemStatus.OPEN:
        return 0;
      case SnagItemStatus.ON_HOLD:
        return 1;
      case SnagItemStatus.RECTIFIED:
        return 2;
      case SnagItemStatus.CLOSED:
        return 3;
      default:
        return 4;
    }
  }

  private async getPhotoRequirementConfig(
    projectId: number,
    roundNumber: number,
  ) {
    const step = await this.processStepRepo.findOne({
      where: { projectId, workflowSerialNo: roundNumber },
    });

    return {
      raisePhotoRequired: step?.raisePhotoRequired ?? false,
      rectificationPhotoRequired: step?.rectificationPhotoRequired ?? false,
      desnagCompletionPhotoRequired:
        step?.desnagCompletionPhotoRequired ?? false,
    };
  }

  private async openDesnagWhenAllRectified(
    projectId: number,
    snagList: SnagList,
    round: SnagRound,
    userId: number,
  ) {
    const items = await this.snagItemRepo.find({
      where: { snagRoundId: round.id },
    });
    if (!items.length) return;

    const allReadyForChecker = items.every(
      (item) =>
        item.status === SnagItemStatus.RECTIFIED ||
        item.status === SnagItemStatus.CLOSED ||
        item.status === SnagItemStatus.ON_HOLD,
    );
    if (!allReadyForChecker) return;

    round.snagPhaseStatus = SnagRoundSnagPhaseStatus.SUBMITTED;
    round.snagSubmittedAt = round.snagSubmittedAt ?? new Date();
    round.snagSubmittedById = round.snagSubmittedById ?? userId;
    round.snagSubmittedComments =
      round.snagSubmittedComments ?? 'All snag points rectified';
    round.desnagPhaseStatus = SnagRoundDesnagPhaseStatus.OPEN;
    await this.snagRoundRepo.save(round);

    snagList.overallStatus = SnagListStatus.DESNAGGING;
    await this.snagListRepo.save(snagList);
  }

  private async advanceRoundIfAllDesnagCompleted(
    projectId: number,
    snagList: SnagList,
    round: SnagRound,
  ) {
    const items = await this.snagItemRepo.find({
      where: { snagRoundId: round.id },
    });
    if (!items.length) return;

    const allCompleted = items.every(
      (item) => item.status === SnagItemStatus.CLOSED,
    );
    if (!allCompleted) return;

    round.snagPhaseStatus = SnagRoundSnagPhaseStatus.SUBMITTED;
    round.desnagPhaseStatus = SnagRoundDesnagPhaseStatus.APPROVED;
    round.desnagReleasedAt = new Date();
    round.desnagReleaseComments =
      round.desnagReleaseComments ?? 'All de-snag points completed';
    await this.snagRoundRepo.save(round);

    snagList.currentRound = round.roundNumber;
    snagList.overallStatus = SnagListStatus.DESNAGGING;
    await this.snagListRepo.save(snagList);
    this.triggerMilestoneRefresh(projectId);
  }

  private async openNextRoundWithCarryForward(
    snagList: SnagList,
    nextRoundNumber: number,
  ) {
    await this.openNextRoundWithCarryForwardUsingRepos(
      snagList,
      nextRoundNumber,
      {
        snagRoundRepo: this.snagRoundRepo,
        snagItemRepo: this.snagItemRepo,
        snagPhotoRepo: this.snagPhotoRepo,
      },
    );
  }

  private async attachChecklistItemToSnag(
    snagListId: number,
    checklistItemId: string,
    snagItemId: number,
    userId: number,
  ) {
    const snagList = await this.snagListRepo.findOne({
      where: { id: snagListId },
    });
    if (!snagList) return;

    let changed = false;
    snagList.commonChecklist = this.normalizeChecklistItems(
      snagList.commonChecklist,
    ).map((item) => {
      if (item.id !== checklistItemId) return item;
      changed = true;
      return {
        ...item,
        status: 'IDENTIFIED',
        linkedSnagItemId: snagItemId,
        updatedAt: new Date().toISOString(),
        updatedById: userId,
      };
    });

    if (changed) {
      await this.snagListRepo.save(snagList);
    }
  }

  private async syncChecklistStatusForSnag(
    snagListId: number,
    snagItemId: number,
    status: SnagCommonChecklistStatus,
    userId: number | null,
  ) {
    const snagList = await this.snagListRepo.findOne({
      where: { id: snagListId },
    });
    if (!snagList) return;

    let changed = false;
    snagList.commonChecklist = this.normalizeChecklistItems(
      snagList.commonChecklist,
    ).map((item) => {
      if (item.linkedSnagItemId !== snagItemId) return item;
      changed = true;
      return {
        ...item,
        status,
        updatedAt: new Date().toISOString(),
        updatedById: userId,
      };
    });

    if (changed) {
      await this.snagListRepo.save(snagList);
    }
  }

  private async sanitizeChecklistItems(
    snagList: SnagList,
    items: UpdateSnagCommonChecklistDto['items'],
    userId: number,
  ): Promise<SnagCommonChecklistItem[]> {
    const rooms = await this.qualityRoomRepo.find({
      where: { unitId: snagList.qualityUnitId },
    });
    const roomById = new Map<number, QualityRoom>(rooms.map((room) => [room.id, room]));
    const now = new Date().toISOString();
    const sanitized: SnagCommonChecklistItem[] = [];

    for (const [index, item] of (items || []).entries()) {
      const title = item.title?.trim();
      if (!title) continue;

      const room =
        item.qualityRoomId != null
          ? roomById.get(Number(item.qualityRoomId))
          : null;
      if (item.qualityRoomId != null && !room) {
        throw new BadRequestException(
          `Checklist room ${item.qualityRoomId} does not belong to this unit`,
        );
      }

      const rawStatus = (item.status || 'NA').toUpperCase();
      const status: SnagCommonChecklistStatus =
        rawStatus === 'IDENTIFIED' ||
        rawStatus === 'RECTIFIED' ||
        rawStatus === 'NA'
          ? (rawStatus as SnagCommonChecklistStatus)
          : 'NA';

      sanitized.push({
        id: item.id?.trim() || randomUUID(),
        title,
        qualityRoomId: room?.id ?? null,
        roomLabel: room?.name ?? item.roomLabel?.trim() ?? null,
        trade: item.trade?.trim() || null,
        sequence:
          typeof item.sequence === 'number' && Number.isFinite(item.sequence)
            ? item.sequence
            : index,
        status,
        remarks: item.remarks?.trim() || null,
        linkedSnagItemId:
          typeof item.linkedSnagItemId === 'number' &&
          Number.isFinite(item.linkedSnagItemId)
            ? item.linkedSnagItemId
            : null,
        updatedAt: now,
        updatedById: userId,
      });
    }

    return sanitized
      .sort((a, b) => a.sequence - b.sequence)
      .map((item, index) => ({
        ...item,
        sequence: index,
      }));
  }

  private normalizeChecklistItems(
    items: SnagCommonChecklistItem[] | null | undefined,
  ) {
    return [...(items || [])]
      .filter((item) => item && typeof item.title === 'string' && item.title.trim())
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
      .map((item, index) => ({
        id: item.id || randomUUID(),
        title: item.title.trim(),
        qualityRoomId:
          typeof item.qualityRoomId === 'number' ? item.qualityRoomId : null,
        roomLabel: item.roomLabel?.trim() || null,
        trade: item.trade?.trim() || null,
        sequence: typeof item.sequence === 'number' ? item.sequence : index,
        status:
          item.status === 'IDENTIFIED' ||
          item.status === 'RECTIFIED' ||
          item.status === 'NA'
            ? item.status
            : 'NA',
        remarks: item.remarks?.trim() || null,
        linkedSnagItemId:
          typeof item.linkedSnagItemId === 'number'
            ? item.linkedSnagItemId
            : null,
        updatedAt: item.updatedAt || null,
        updatedById:
          typeof item.updatedById === 'number' ? item.updatedById : null,
      }));
  }

  private async savePhotos(
    snagItemId: number,
    urls: string[],
    type: SnagPhotoType,
  ) {
    if (!urls.length) return;
    await this.snagPhotoRepo.save(
      urls.map((url) =>
        this.snagPhotoRepo.create({
          snagItemId,
          type,
          fileUrl: url,
        }),
      ),
    );
  }

  private async resolveRoomForList(
    snagList: SnagList,
    roomId?: number | null,
  ) {
    if (!roomId) return null;
    const room = await this.qualityRoomRepo.findOne({
      where: { id: roomId, unitId: snagList.qualityUnitId },
    });
    if (!room) {
      throw new BadRequestException('Selected room does not belong to this unit');
    }
    return room;
  }

  private async requireBulkItems(projectId: number, itemIds: number[]) {
    const items = await this.snagItemRepo.find({
      where: { id: In(itemIds) },
      relations: ['snagList'],
    });
    if (items.length !== itemIds.length) {
      throw new NotFoundException('One or more snag items were not found');
    }
    const invalid = items.find((item) => item.snagList?.projectId !== projectId);
    if (invalid) {
      throw new BadRequestException(
        'One or more snag items do not belong to this project',
      );
    }
    return items;
  }

  private async requireList(projectId: number, listId: number) {
    const snagList = await this.snagListRepo.findOne({
      where: { id: listId, projectId },
    });
    if (!snagList) throw new NotFoundException('Snag list not found');
    return snagList;
  }

  private async requireRound(snagListId: number, roundNumber: number) {
    const round = await this.snagRoundRepo.findOne({
      where: { snagListId, roundNumber },
    });
    if (!round) throw new NotFoundException('Snag round not found');
    return round;
  }

  private async requireRoundById(projectId: number, roundId: number) {
    const round = await this.snagRoundRepo.findOne({
      where: { id: roundId },
      relations: ['snagList'],
    });
    if (!round || round.snagList?.projectId !== projectId) {
      throw new NotFoundException('Snag round not found');
    }
    return round;
  }

  private async requireItem(projectId: number, itemId: number) {
    const item = await this.snagItemRepo.findOne({
      where: { id: itemId },
      relations: ['snagList'],
    });
    if (!item || item.snagList?.projectId !== projectId) {
      throw new NotFoundException('Snag item not found');
    }
    return item;
  }

  private async canUserActOnStep(
    projectId: number,
    userId: number,
    step: SnagReleaseApprovalStep,
  ) {
    if (step.assignedUserId && step.assignedUserId === userId) return true;
    if ((step.assignedUserIds || []).includes(userId)) return true;

    if (step.assignedRoleId) {
      const actors = await this.releaseStrategyService.getEligibleActors(
        projectId,
      );
      return actors.some(
        (actor: any) =>
          actor.userId === userId && actor.roleId === step.assignedRoleId,
      );
    }

    return false;
  }

  private async openNextRoundWithCarryForwardUsingRepos(
    snagList: SnagList,
    nextRoundNumber: number,
    repos: SnagCarryForwardRepos,
  ) {
    let nextRound = await repos.snagRoundRepo.findOne({
      where: { snagListId: snagList.id, roundNumber: nextRoundNumber },
    });

    if (!nextRound) {
      nextRound = await repos.snagRoundRepo.save(
        repos.snagRoundRepo.create({
          snagListId: snagList.id,
          roundNumber: nextRoundNumber,
          snagPhaseStatus: SnagRoundSnagPhaseStatus.OPEN,
          desnagPhaseStatus: SnagRoundDesnagPhaseStatus.LOCKED,
        }),
      );
    }

    const previousRoundItems = await repos.snagItemRepo.find({
      where: { snagListId: snagList.id, status: SnagItemStatus.ON_HOLD },
    });
    const sourceItems = previousRoundItems.filter(
      (item) => item.snagRoundId !== nextRound!.id,
    );

    let checklistChanged = false;
    const checklist = this.normalizeChecklistItems(snagList.commonChecklist);

    for (const item of sourceItems) {
      const clone = await repos.snagItemRepo.save(
        repos.snagItemRepo.create({
          snagListId: snagList.id,
          snagRoundId: nextRound.id,
          qualityRoomId: item.qualityRoomId,
          roomLabel: item.roomLabel,
          defectTitle: item.defectTitle,
          defectDescription: item.defectDescription,
          trade: item.trade,
          priority: item.priority,
          status: SnagItemStatus.OPEN,
          holdReason: null,
        }),
      );

      const photos = await repos.snagPhotoRepo.find({
        where: { snagItemId: item.id },
      });
      const beforePhotos = photos
        .filter((photo) => photo.type === SnagPhotoType.BEFORE)
        .map((photo) =>
          repos.snagPhotoRepo.create({
            snagItemId: clone.id,
            type: SnagPhotoType.BEFORE,
            fileUrl: photo.fileUrl,
          }),
        );
      if (beforePhotos.length) {
        await repos.snagPhotoRepo.save(beforePhotos);
      }

      for (const checklistItem of checklist) {
        if (checklistItem.linkedSnagItemId === item.id) {
          checklistItem.linkedSnagItemId = clone.id;
          checklistItem.status = 'IDENTIFIED';
          checklistChanged = true;
        }
      }
    }

    if (checklistChanged) {
      snagList.commonChecklist = checklist;
    }
  }

  private clearChecklistLinksForDeletedItems(
    snagList: SnagList,
    deletedItemIds: Set<number>,
    userId: number | null,
  ) {
    if (!deletedItemIds.size) {
      return;
    }

    const now = new Date().toISOString();
    snagList.commonChecklist = this.normalizeChecklistItems(
      snagList.commonChecklist,
    ).map((item) => {
      if (
        item.linkedSnagItemId == null ||
        !deletedItemIds.has(item.linkedSnagItemId)
      ) {
        return item;
      }

      return {
        ...item,
        linkedSnagItemId: null,
        status: 'IDENTIFIED',
        updatedAt: now,
        updatedById: userId,
      };
    });
  }

  private userHasExactPermission(
    user:
      | {
          roles?: string[];
          permissions?: string[];
        }
      | null
      | undefined,
    permission: string,
  ) {
    if (!user) return false;
    if (user.roles?.includes('Admin')) return true;
    return (user.permissions || []).includes(permission);
  }

  private triggerMilestoneRefresh(projectId: number) {
    if (!projectId) {
      return;
    }

    void this.milestoneService.handleProgressRefresh(projectId);
  }

  private countBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
    return items.reduce((map, item) => {
      const key = getKey(item)?.trim() || 'Unassigned';
      map.set(key, (map.get(key) || 0) + 1);
      return map;
    }, new Map<string, number>());
  }

  private mapToRows(map: Map<string, number>) {
    return [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }
}
