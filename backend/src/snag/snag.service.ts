import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { EpsNodeType } from '../eps/eps.entity';
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
  HoldSnagItemDto,
  RectifySnagItemDto,
  ResetSnagRoundDto,
  SkipSnagRoundDto,
  SubmitDesnagApprovalDto,
  SubmitSnagPhaseDto,
  UpdateSnagCommonChecklistDto,
} from './dto/snag.dto';

type SnagCarryForwardRepos = {
  snagRoundRepo: Repository<SnagRound>;
  snagItemRepo: Repository<SnagItem>;
  snagPhotoRepo: Repository<SnagPhoto>;
};

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
    @InjectRepository(QualityFloorStructure)
    private readonly floorStructureRepo: Repository<QualityFloorStructure>,
    @InjectRepository(QualityUnit)
    private readonly qualityUnitRepo: Repository<QualityUnit>,
    @InjectRepository(QualityRoom)
    private readonly qualityRoomRepo: Repository<QualityRoom>,
    private readonly releaseStrategyService: ReleaseStrategyService,
    private readonly milestoneService: CustomerMilestoneService,
  ) {}

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
          overallStatus: snagList?.overallStatus ?? SnagListStatus.SNAGGING,
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
      snagList = await this.snagListRepo.save(
        this.snagListRepo.create({
          projectId,
          epsNodeId: dto.epsNodeId ?? null,
          qualityUnitId: dto.qualityUnitId,
          unitLabel: unit.name,
          currentRound: 1,
          overallStatus: SnagListStatus.SNAGGING,
          commonChecklist: [],
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

  async getListDetail(projectId: number, listId: number) {
    const snagList = await this.snagListRepo.findOne({
      where: { id: listId, projectId },
      relations: [
        'rounds',
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
    if (!dto.beforePhotoUrls?.length) {
      throw new BadRequestException(
        'Before photos are required while raising a snag',
      );
    }

    const snagList = await this.requireList(projectId, listId);
    const round = await this.requireRound(snagList.id, roundNumber);
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

    await this.savePhotos(item.id, dto.beforePhotoUrls, SnagPhotoType.BEFORE);

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
    if (!dto.afterPhotoUrls?.length) {
      throw new BadRequestException(
        'After photos are required while rectifying snag items',
      );
    }

    const snagList = await this.requireList(projectId, listId);
    const round = await this.requireRound(snagList.id, roundNumber);
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
      await this.savePhotos(item.id, dto.afterPhotoUrls, SnagPhotoType.AFTER);
      await this.syncChecklistStatusForSnag(
        item.snagListId,
        item.id,
        'RECTIFIED',
        userId,
      );
    }

    return this.getListDetail(projectId, snagList.id);
  }

  async rectifyItem(
    projectId: number,
    itemId: number,
    dto: RectifySnagItemDto,
    userId: number,
  ) {
    if (!dto.afterPhotoUrls?.length) {
      throw new BadRequestException(
        'After photos are required while rectifying a snag',
      );
    }

    const item = await this.requireItem(projectId, itemId);
    if (item.status !== SnagItemStatus.OPEN) {
      throw new BadRequestException('Only open snag items can be rectified');
    }

    item.status = SnagItemStatus.RECTIFIED;
    item.rectifiedById = userId;
    item.rectifiedAt = new Date();
    item.rectificationNotes = dto.rectificationNotes?.trim() || null;
    await this.snagItemRepo.save(item);
    await this.savePhotos(item.id, dto.afterPhotoUrls, SnagPhotoType.AFTER);
    await this.syncChecklistStatusForSnag(
      item.snagListId,
      item.id,
      'RECTIFIED',
      userId,
    );

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

    return this.getListDetail(projectId, snagList.id);
  }

  async closeItem(
    projectId: number,
    itemId: number,
    dto: CloseSnagItemDto,
    userId: number,
  ) {
    const item = await this.requireItem(projectId, itemId);
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

    if (round.roundNumber >= 3) {
      snagList.overallStatus = SnagListStatus.HANDOVER_READY;
      snagList.currentRound = 3;
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
    if (approval.snagRound.roundNumber >= 3) {
      snagList.overallStatus = SnagListStatus.HANDOVER_READY;
      snagList.currentRound = 3;
    } else {
      snagList.currentRound = approval.snagRound.roundNumber + 1;
      snagList.overallStatus = SnagListStatus.RELEASED;
      await this.openNextRoundWithCarryForward(
        snagList,
        approval.snagRound.roundNumber + 1,
      );
    }

    await this.snagListRepo.save(snagList);
    this.triggerMilestoneRefresh(projectId);
    return this.getListDetail(projectId, snagList.id);
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
}
