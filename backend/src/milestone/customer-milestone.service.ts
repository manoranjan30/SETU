import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { QualityFloorStructure } from '../quality/entities/quality-floor-structure.entity';
import { QualityInspection } from '../quality/entities/quality-inspection.entity';
import { QualityUnit } from '../quality/entities/quality-unit.entity';
import { QuantityProgressRecord } from '../planning/entities/quantity-progress-record.entity';
import { WoActivityPlan } from '../planning/entities/wo-activity-plan.entity';
import { ScheduleVersion, ScheduleVersionType } from '../planning/entities/schedule-version.entity';
import { ActivityVersion } from '../planning/entities/activity-version.entity';
import { SnagRound } from '../snag/entities/snag-round.entity';
import {
  AddMilestoneTrancheDto,
  CloneTowerMilestoneTemplatesDto,
  ManualTriggerMilestoneDto,
  RaiseMilestoneInvoiceDto,
  UpdateMilestoneAchievementStatusDto,
  UpsertCustomerMilestoneTemplateDto,
  UpsertFlatSaleInfoDto,
} from './dto/customer-milestone.dto';
import {
  CustomerMilestoneAchievement,
  CustomerMilestoneAchievementStatus,
} from './entities/customer-milestone-achievement.entity';
import {
  CustomerMilestoneApplicability,
  CustomerMilestoneTemplate,
  CustomerMilestoneTriggerType,
} from './entities/customer-milestone-template.entity';
import { CustomerMilestoneTemplateActivityLink } from './entities/customer-milestone-template-activity-link.entity';
import { FlatSaleInfo } from './entities/flat-sale-info.entity';
import { MilestoneCollectionTranche } from './entities/milestone-collection-tranche.entity';

type UnitContext = {
  qualityUnitId: number;
  unitLabel: string;
  floorId: number;
  floorName: string;
  towerId: number;
  towerName: string;
};

type ScopeBlockNode = {
  blockId: number;
  blockName: string;
  towers: Array<{
    towerId: number;
    towerName: string;
    floors: Array<{
      floorId: number;
      floorName: string;
      units: Array<{
        unitId: number;
        unitName: string;
      }>;
    }>;
  }>;
};

@Injectable()
export class CustomerMilestoneService {
  private readonly logger = new Logger(CustomerMilestoneService.name);

  constructor(
    @InjectRepository(CustomerMilestoneTemplate)
    private readonly templateRepo: Repository<CustomerMilestoneTemplate>,
    @InjectRepository(CustomerMilestoneTemplateActivityLink)
    private readonly templateActivityLinkRepo: Repository<CustomerMilestoneTemplateActivityLink>,
    @InjectRepository(CustomerMilestoneAchievement)
    private readonly achievementRepo: Repository<CustomerMilestoneAchievement>,
    @InjectRepository(FlatSaleInfo)
    private readonly flatSaleRepo: Repository<FlatSaleInfo>,
    @InjectRepository(MilestoneCollectionTranche)
    private readonly trancheRepo: Repository<MilestoneCollectionTranche>,
    @InjectRepository(QualityFloorStructure)
    private readonly floorStructureRepo: Repository<QualityFloorStructure>,
    @InjectRepository(QualityUnit)
    private readonly qualityUnitRepo: Repository<QualityUnit>,
    @InjectRepository(QualityInspection)
    private readonly inspectionRepo: Repository<QualityInspection>,
    @InjectRepository(WoActivityPlan)
    private readonly planRepo: Repository<WoActivityPlan>,
    @InjectRepository(QuantityProgressRecord)
    private readonly quantityProgressRepo: Repository<QuantityProgressRecord>,
    @InjectRepository(SnagRound)
    private readonly snagRoundRepo: Repository<SnagRound>,
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
    @InjectRepository(ScheduleVersion)
    private readonly scheduleVersionRepo: Repository<ScheduleVersion>,
    @InjectRepository(ActivityVersion)
    private readonly activityVersionRepo: Repository<ActivityVersion>,
  ) {}

  async listTemplates(projectId: number) {
    const templates = await this.templateRepo.find({
      where: { projectId },
      relations: ['activityLinks', 'activityLinks.activity'],
      order: { sequence: 'ASC', id: 'ASC', activityLinks: { sequence: 'ASC', id: 'ASC' } },
    });

    return templates.map((template) => ({
      ...template,
      linkedActivityIds: (template.activityLinks || []).map((link) => link.activityId),
      linkedActivities: (template.activityLinks || []).map((link) => ({
        id: link.activityId,
        activityCode: link.activity?.activityCode || '',
        activityName: link.activity?.activityName || '',
      })),
      triggerMode: (template.activityLinks || []).length > 0 ? 'schedule' : 'manual',
    }));
  }

  async listScopeOptions(projectId: number) {
    const [projectNodes, floors] = await Promise.all([
      this.getProjectEpsNodes(projectId),
      this.floorStructureRepo.find({
        where: { projectId },
        relations: ['units'],
        order: {
          units: { sequence: 'ASC', name: 'ASC' },
        },
      }),
    ]);

    return this.buildScopeTree(projectNodes, floors);
  }

  async listScheduleActivities(projectId: number) {
    const projectNodes = await this.getProjectEpsNodes(projectId);
    const nodesById = new Map(projectNodes.map((node) => [node.id, node]));
    const activeVersion = await this.scheduleVersionRepo.findOne({
      where: {
        projectId,
        versionType: ScheduleVersionType.WORKING,
        isActive: true,
      },
      order: { updatedOn: 'DESC', id: 'DESC' },
    });

    const activities = activeVersion
      ? await this.activityVersionRepo.find({
          where: { versionId: activeVersion.id },
          relations: ['activity', 'activity.wbsNode'],
          order: { finishDate: 'ASC', id: 'ASC' },
        })
      : [];

    const activityRows =
      activities.length > 0
        ? activities.map((item) => ({
            id: item.activityId,
            activityCode: item.activity?.activityCode || '',
            activityName: item.activity?.activityName || '',
            plannedFinish: item.finishDate,
            actualFinish: item.activity?.finishDateActual || null,
            status: item.activity?.status || null,
            wbsNodeId: item.activity?.wbsNode?.id ?? null,
            wbsNode: item.activity?.wbsNode
              ? {
                  id: item.activity.wbsNode.id,
                  wbsCode: item.activity.wbsNode.wbsCode,
                  wbsName: item.activity.wbsNode.wbsName,
                  parentId: item.activity.wbsNode.parentId,
                }
              : null,
          }))
        : (
            await this.activityRepo.find({
              where: { projectId },
              relations: ['wbsNode'],
              order: { finishDatePlanned: 'ASC', id: 'ASC' },
            })
          ).map((item) => ({
            id: item.id,
            activityCode: item.activityCode,
            activityName: item.activityName,
            plannedFinish: item.finishDatePlanned,
            actualFinish: item.finishDateActual,
            status: item.status,
            wbsNodeId: item.wbsNode?.id ?? null,
            wbsNode: item.wbsNode
              ? {
                  id: item.wbsNode.id,
                  wbsCode: item.wbsNode.wbsCode,
                  wbsName: item.wbsNode.wbsName,
                  parentId: item.wbsNode.parentId,
                }
              : null,
          }));

    const activityIds = activityRows.map((item) => item.id);
    const plans =
      activityIds.length > 0
        ? await this.planRepo.find({
            where: { projectId, activityId: In(activityIds) },
            relations: ['boqItem'],
          })
        : [];

    const locationsByActivityId = new Map<number, any[]>();
    for (const plan of plans) {
      const rawNodeId = plan.boqItem?.epsNodeId;
      if (!rawNodeId) continue;
      const location = this.resolveActivityLocation(rawNodeId, nodesById, projectId);
      if (!location) continue;
      const current = locationsByActivityId.get(plan.activityId) || [];
      if (!current.some((item) => item.epsNodeId === location.epsNodeId)) {
        current.push(location);
        current.sort((a, b) => a.pathLabel.localeCompare(b.pathLabel, undefined, { numeric: true }));
        locationsByActivityId.set(plan.activityId, current);
      }
    }

      return activityRows.map((item) => ({
        ...item,
        locations: locationsByActivityId.get(item.id) || [],
      }));
  }

  async upsertTemplate(
    projectId: number,
    dto: UpsertCustomerMilestoneTemplateDto,
    userId?: number,
    id?: number,
  ) {
    const template =
      id != null
        ? await this.templateRepo.findOne({
            where: { id, projectId },
            relations: ['activityLinks'],
          })
        : this.templateRepo.create({ projectId, createdById: userId ?? null });

    if (!template) {
      throw new NotFoundException('Milestone template not found');
    }

    Object.assign(template, {
      name: dto.name,
      description: dto.description ?? null,
      sequence: dto.sequence,
      collectionPct: dto.collectionPct,
      triggerType: dto.triggerType ?? CustomerMilestoneTriggerType.MANUAL,
      triggerActivityId: dto.triggerActivityId ?? null,
      triggerQualityActivityId: dto.triggerQualityActivityId ?? null,
      triggerSnagRound: dto.triggerSnagRound ?? null,
      triggerProgressPct: dto.triggerProgressPct ?? null,
      applicableTo: dto.applicableTo ?? CustomerMilestoneApplicability.ALL_UNITS,
      applicableEpsIds: dto.applicableEpsIds?.length ? dto.applicableEpsIds : null,
      allowManualCompletion: dto.allowManualCompletion ?? true,
      isActive: dto.isActive ?? true,
    });

    const saved = await this.templateRepo.save(template);
    await this.templateActivityLinkRepo.delete({ templateId: saved.id });

    const linkedActivityIds = Array.from(new Set((dto.linkedActivityIds || []).filter(Boolean)));
    if (linkedActivityIds.length > 0) {
      const links = linkedActivityIds.map((activityId, index) =>
        this.templateActivityLinkRepo.create({
          templateId: saved.id,
          activityId,
          sequence: index,
        }),
      );
      await this.templateActivityLinkRepo.save(links);
    }

    await this.recomputeProjectAchievements(projectId);
    return this.templateRepo.findOne({
      where: { id: saved.id },
      relations: ['activityLinks', 'activityLinks.activity'],
    });
  }

  async deleteTemplate(projectId: number, id: number) {
    const template = await this.templateRepo.findOne({ where: { id, projectId } });
    if (!template) throw new NotFoundException('Milestone template not found');
    await this.templateRepo.remove(template);
    return { success: true };
  }

  async cloneTowerTemplates(
    projectId: number,
    dto: CloneTowerMilestoneTemplatesDto,
    userId?: number,
  ) {
    const sourceStructures = await this.floorStructureRepo.find({
      where: { projectId, towerId: dto.sourceTowerId },
      relations: ['floor', 'units'],
    });
    if (sourceStructures.length === 0) {
      throw new NotFoundException('Source tower floor structure not found');
    }

    const sourceFloorIds = sourceStructures.map((item) => item.floorId);
    const sourceUnitIds = sourceStructures.flatMap((item) => (item.units || []).map((unit) => unit.id));
    const templates = await this.templateRepo.find({
      where: { projectId },
      relations: ['activityLinks'],
      order: { sequence: 'ASC', id: 'ASC' },
    });

    const candidates = templates.filter((template) => {
      const ids = template.applicableEpsIds || [];
      if (template.applicableTo === CustomerMilestoneApplicability.TOWER) {
        return ids.includes(dto.sourceTowerId);
      }
      if (template.applicableTo === CustomerMilestoneApplicability.FLOOR) {
        return ids.some((id) => sourceFloorIds.includes(id));
      }
      if (template.applicableTo === CustomerMilestoneApplicability.UNIT) {
        return ids.some((id) => sourceUnitIds.includes(id));
      }
      return false;
    });

    const created: CustomerMilestoneTemplate[] = [];

    for (const targetTowerId of dto.targetTowerIds) {
      const targetStructures = await this.floorStructureRepo.find({
        where: { projectId, towerId: targetTowerId },
        relations: ['floor', 'units'],
      });
      const targetByFloorName = new Map(
        targetStructures.map((item) => [item.floor?.name || `Floor ${item.floorId}`, item]),
      );

      for (const sourceTemplate of candidates) {
        let applicableIds: number[] | null = null;

        if (sourceTemplate.applicableTo === CustomerMilestoneApplicability.TOWER) {
          applicableIds = [targetTowerId];
        } else if (sourceTemplate.applicableTo === CustomerMilestoneApplicability.FLOOR) {
          applicableIds = sourceStructures
            .filter((item) => (sourceTemplate.applicableEpsIds || []).includes(item.floorId))
            .map((item) => targetByFloorName.get(item.floor?.name || `Floor ${item.floorId}`)?.floorId)
            .filter((value): value is number => Boolean(value));
        } else if (sourceTemplate.applicableTo === CustomerMilestoneApplicability.UNIT) {
          applicableIds = sourceStructures
            .flatMap((sourceFloor) => {
              const targetFloor = targetByFloorName.get(
                sourceFloor.floor?.name || `Floor ${sourceFloor.floorId}`,
              );
              if (!targetFloor) return [];
              return (sourceFloor.units || [])
                .filter((unit) => (sourceTemplate.applicableEpsIds || []).includes(unit.id))
                .map(
                  (unit) =>
                    (targetFloor.units || []).find((candidate) => candidate.name === unit.name)?.id,
                );
            })
            .filter((value): value is number => Boolean(value));
        }

        const clone = this.templateRepo.create({
          projectId,
          name: sourceTemplate.name,
          description: sourceTemplate.description,
          sequence: sourceTemplate.sequence,
          collectionPct: sourceTemplate.collectionPct,
          triggerType: CustomerMilestoneTriggerType.MANUAL,
          triggerActivityId: null,
          triggerQualityActivityId: null,
          triggerSnagRound: null,
          triggerProgressPct: null,
          applicableTo: sourceTemplate.applicableTo,
          applicableEpsIds: applicableIds,
          allowManualCompletion: sourceTemplate.allowManualCompletion,
          isActive: sourceTemplate.isActive,
          createdById: userId ?? null,
        });
        created.push(await this.templateRepo.save(clone));
      }
    }

    await this.recomputeProjectAchievements(projectId);
    return {
      createdCount: created.length,
      templates: created,
    };
  }

  async listFlatSales(projectId: number) {
    return this.flatSaleRepo.find({
      where: { projectId },
      order: { unitLabel: 'ASC' },
    });
  }

  async upsertFlatSale(
    projectId: number,
    dto: UpsertFlatSaleInfoDto,
    userId?: number,
    id?: number,
  ) {
    let record =
      id != null
        ? await this.flatSaleRepo.findOne({ where: { id, projectId } })
        : null;
    if (!record && dto.qualityUnitId) {
      record = await this.flatSaleRepo.findOne({
        where: { projectId, qualityUnitId: dto.qualityUnitId },
      });
    }
    const entity = record ?? this.flatSaleRepo.create({ projectId, createdById: userId ?? null });
    Object.assign(entity, { ...dto, projectId });
    const saved = await this.flatSaleRepo.save(entity);
    await this.recomputeProjectAchievements(projectId);
    return saved;
  }

  async listUnitMilestones(projectId: number) {
    await this.recomputeProjectAchievements(projectId);
    const achievements = await this.achievementRepo.find({
      where: { projectId },
      relations: ['template', 'template.activityLinks', 'template.activityLinks.activity', 'tranches'],
      order: { unitLabel: 'ASC', template: { sequence: 'ASC', id: 'ASC' } },
    });

    const grouped = new Map<string, any>();
    for (const achievement of achievements) {
      const key = `${achievement.qualityUnitId ?? 'na'}:${achievement.unitLabel}`;
      const current =
        grouped.get(key) ||
        {
          unitLabel: achievement.unitLabel,
          qualityUnitId: achievement.qualityUnitId,
          saleValue: Number(achievement.flatSaleValue || 0),
          milestones: [],
          collectedAmount: 0,
        };
      const trancheTotal = (achievement.tranches || []).reduce(
        (sum, tranche) => sum + Number(tranche.amount || 0),
        0,
      );
      current.collectedAmount += trancheTotal;
      current.saleValue = Math.max(current.saleValue, Number(achievement.flatSaleValue || 0));
      current.milestones.push({
        ...achievement,
        collectionPct: Number(achievement.collectionPct || 0),
        collectionAmount: Number(achievement.collectionAmount || 0),
        amountReceived: Number(achievement.amountReceived || 0),
        trancheTotal,
        linkedActivities: (achievement.template?.activityLinks || []).map((link) => ({
          id: link.activityId,
          activityCode: link.activity?.activityCode || '',
          activityName: link.activity?.activityName || '',
        })),
      });
      grouped.set(key, current);
    }
    return Array.from(grouped.values());
  }

  async manualTrigger(
    projectId: number,
    achievementId: number,
    userId: number,
    dto: ManualTriggerMilestoneDto,
  ) {
    const achievement = await this.getAchievement(projectId, achievementId);
    if (!achievement.template.allowManualCompletion) {
      throw new BadRequestException('Manual completion is disabled for this milestone');
    }
    achievement.status = CustomerMilestoneAchievementStatus.TRIGGERED;
    achievement.triggeredAt = dto.completionDate ? new Date(dto.completionDate) : new Date();
    achievement.actualCompletionDate = achievement.triggeredAt.toISOString().slice(0, 10);
    achievement.completionSource = 'MANUAL';
    achievement.triggeredBy = `user:${userId}`;
    achievement.triggerReference = dto.remarks || 'manual';
    achievement.remarks = dto.remarks ?? achievement.remarks;
    return this.achievementRepo.save(achievement);
  }

  async raiseInvoice(
    projectId: number,
    achievementId: number,
    userId: number,
    dto: RaiseMilestoneInvoiceDto,
  ) {
    const achievement = await this.getAchievement(projectId, achievementId);
    if (
      achievement.status !== CustomerMilestoneAchievementStatus.TRIGGERED &&
      achievement.status !== CustomerMilestoneAchievementStatus.PARTIALLY_COLLECTED
    ) {
      throw new BadRequestException('Milestone must be triggered before invoice can be raised');
    }
    achievement.status = CustomerMilestoneAchievementStatus.INVOICE_RAISED;
    achievement.invoiceNumber = dto.invoiceNumber;
    achievement.invoiceDate = dto.invoiceDate;
    achievement.invoiceRaisedById = userId;
    achievement.remarks = dto.remarks ?? achievement.remarks;
    return this.achievementRepo.save(achievement);
  }

  async addTranche(
    projectId: number,
    achievementId: number,
    userId: number,
    dto: AddMilestoneTrancheDto,
  ) {
    const achievement = await this.getAchievement(projectId, achievementId);
    const tranche = await this.trancheRepo.save(
      this.trancheRepo.create({
        achievementId,
        amount: dto.amount,
        receivedDate: dto.receivedDate,
        paymentMode: dto.paymentMode,
        referenceNumber: dto.referenceNumber,
        bankName: dto.bankName ?? null,
        remarks: dto.remarks ?? null,
        collectedById: userId,
      }),
    );
    const allTranches = await this.trancheRepo.find({ where: { achievementId } });
    const totalReceived = allTranches.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    achievement.amountReceived = totalReceived.toFixed(2);
    achievement.receivedById = userId;
    achievement.receivedDate = dto.receivedDate;
    const target = Number(achievement.collectionAmount || 0);
    achievement.status =
      target > 0 && totalReceived + 0.0001 >= target
        ? CustomerMilestoneAchievementStatus.COLLECTED
        : CustomerMilestoneAchievementStatus.PARTIALLY_COLLECTED;
    await this.achievementRepo.save(achievement);
    return tranche;
  }

  async updateAchievementStatus(
    projectId: number,
    achievementId: number,
    dto: UpdateMilestoneAchievementStatusDto,
  ) {
    const achievement = await this.getAchievement(projectId, achievementId);
    achievement.status = dto.status;
    achievement.remarks = dto.remarks ?? achievement.remarks;
    return this.achievementRepo.save(achievement);
  }

  async recomputeProjectAchievements(projectId: number) {
    const [templates, units, sales, latestWorkingVersion] = await Promise.all([
      this.templateRepo.find({
        where: { projectId, isActive: true },
        relations: ['activityLinks', 'activityLinks.activity'],
        order: { sequence: 'ASC', id: 'ASC' },
      }),
      this.getUnitContexts(projectId),
      this.flatSaleRepo.find({ where: { projectId } }),
      this.scheduleVersionRepo.findOne({
        where: {
          projectId,
          versionType: ScheduleVersionType.WORKING,
          isActive: true,
        },
        order: { updatedOn: 'DESC', id: 'DESC' },
      }),
    ]);

    if (!templates.length) return [];

    const saleByUnit = new Map<number, FlatSaleInfo>();
    sales.forEach((item) => {
      if (item.qualityUnitId) saleByUnit.set(item.qualityUnitId, item);
    });

    const linkedActivityIds = Array.from(
      new Set(
        templates.flatMap((template) => this.resolveTemplateActivityIds(template)),
      ),
    );
    const masterActivities = linkedActivityIds.length
      ? await this.activityRepo.find({ where: { id: In(linkedActivityIds) } })
      : [];
    const masterActivityById = new Map(masterActivities.map((item) => [item.id, item]));

    const workingActivityVersions =
      latestWorkingVersion && linkedActivityIds.length
        ? await this.activityVersionRepo.find({
            where: { versionId: latestWorkingVersion.id, activityId: In(linkedActivityIds) },
          })
        : [];
    const versionByActivityId = new Map(workingActivityVersions.map((item) => [item.activityId, item]));

    const existingAchievements = await this.achievementRepo.find({
      where: { projectId, templateId: In(templates.map((template) => template.id)) },
    });
    const existingByKey = new Map(
      existingAchievements.map((item) => [`${item.templateId}:${item.qualityUnitId}`, item]),
    );
    const validKeys = new Set<string>();

    for (const template of templates) {
      const applicableUnits = units.filter((unit) => this.isTemplateApplicable(template, unit));
      const activityIds = this.resolveTemplateActivityIds(template);
      const plannedDates = activityIds
        .map((activityId) => versionByActivityId.get(activityId)?.finishDate)
        .filter((value): value is Date => Boolean(value))
        .map((value) => new Date(value).toISOString().slice(0, 10));
      const actualDates = activityIds
        .map((activityId) => masterActivityById.get(activityId)?.finishDateActual)
        .filter((value): value is Date => Boolean(value))
        .map((value) => new Date(value).toISOString().slice(0, 10));
      const allActivitiesCompleted =
        activityIds.length > 0 &&
        activityIds.every((activityId) => Boolean(masterActivityById.get(activityId)?.finishDateActual));

      for (const unit of applicableUnits) {
        const key = `${template.id}:${unit.qualityUnitId}`;
        validKeys.add(key);
        const existing = existingByKey.get(key);
        const sale = saleByUnit.get(unit.qualityUnitId);
        const achievement =
          existing ||
          this.achievementRepo.create({
            projectId,
            templateId: template.id,
            qualityUnitId: unit.qualityUnitId,
            unitLabel: sale?.unitLabel || unit.unitLabel,
          });

        achievement.epsNodeId =
          template.applicableTo === CustomerMilestoneApplicability.TOWER
            ? unit.towerId
            : template.applicableTo === CustomerMilestoneApplicability.FLOOR
              ? unit.floorId
              : null;
        achievement.unitLabel = sale?.unitLabel || unit.unitLabel;
        achievement.collectionPct = String(template.collectionPct);
        achievement.flatSaleValue = sale ? String(sale.totalSaleValue) : null;
        achievement.collectionAmount = sale
          ? ((Number(sale.totalSaleValue || 0) * Number(template.collectionPct || 0)) / 100).toFixed(2)
          : null;
        achievement.plannedCompletionDate =
          plannedDates.length > 0 ? plannedDates.sort().slice(-1)[0] : achievement.plannedCompletionDate;

        if (
          allActivitiesCompleted &&
          achievement.status === CustomerMilestoneAchievementStatus.NOT_TRIGGERED
        ) {
          achievement.status = CustomerMilestoneAchievementStatus.TRIGGERED;
          achievement.triggeredAt = actualDates.length
            ? new Date(actualDates.sort().slice(-1)[0])
            : new Date();
          achievement.actualCompletionDate =
            actualDates.length > 0 ? actualDates.sort().slice(-1)[0] : achievement.actualCompletionDate;
          achievement.completionSource = 'SCHEDULE';
          achievement.triggeredBy = 'system';
          achievement.triggerReference = `activities:${activityIds.join(',')}`;
        }

        await this.achievementRepo.save(achievement);
      }
    }

    const staleAchievements = existingAchievements.filter(
      (item) =>
        !validKeys.has(`${item.templateId}:${item.qualityUnitId}`) &&
        [
          CustomerMilestoneAchievementStatus.NOT_TRIGGERED,
          CustomerMilestoneAchievementStatus.TRIGGERED,
        ].includes(item.status),
    );
    if (staleAchievements.length > 0) {
      await this.achievementRepo.remove(staleAchievements);
    }

    return this.listUnitMilestones(projectId);
  }

  async handleQualityApproval(inspection: QualityInspection) {
    if (!inspection?.projectId) return;
    await this.safeRecompute(inspection.projectId, 'quality approval');
  }

  async handleProgressRefresh(projectId: number) {
    if (!projectId) return;
    await this.safeRecompute(projectId, 'progress refresh');
  }

  private async safeRecompute(projectId: number, source: string) {
    try {
      await this.recomputeProjectAchievements(projectId);
    } catch (error: any) {
      this.logger.warn(
        `Milestone recompute after ${source} failed: ${error?.message || error}`,
      );
    }
  }

  private async getAchievement(projectId: number, achievementId: number) {
    const achievement = await this.achievementRepo.findOne({
      where: { id: achievementId, projectId },
      relations: ['template', 'template.activityLinks', 'template.activityLinks.activity', 'tranches'],
    });
    if (!achievement) throw new NotFoundException('Milestone achievement not found');
    return achievement;
  }

  private async getUnitContexts(projectId: number): Promise<UnitContext[]> {
    const floors = await this.floorStructureRepo.find({
      where: { projectId },
      relations: ['floor', 'tower', 'units'],
      order: {
        tower: { order: 'ASC', name: 'ASC' },
        floor: { order: 'ASC', name: 'ASC' },
        units: { sequence: 'ASC', name: 'ASC' },
      },
    });

    return floors.flatMap((floor) =>
      (floor.units || []).map((unit) => ({
        qualityUnitId: unit.id,
        unitLabel: unit.name,
        floorId: floor.floorId,
        floorName: floor.floor?.name || `Floor ${floor.floorId}`,
        towerId: floor.towerId,
        towerName: floor.tower?.name || `Tower ${floor.towerId}`,
      })),
    );
  }

  private async getProjectEpsNodes(projectId: number) {
    const allNodes = await this.epsRepo.find({
      order: { order: 'ASC', id: 'ASC' },
    });
    const allowedIds = new Set<number>();
    const queue = [projectId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (allowedIds.has(currentId)) continue;
      allowedIds.add(currentId);
      allNodes
        .filter((node) => node.parentId === currentId)
        .forEach((node) => queue.push(node.id));
    }

    return allNodes.filter((node) => allowedIds.has(node.id));
  }

  private buildScopeTree(
    projectNodes: EpsNode[],
    floorStructures: QualityFloorStructure[],
  ): ScopeBlockNode[] {
    const nodesById = new Map(projectNodes.map((node) => [node.id, node]));
    const unitsByFloorId = new Map<number, Array<{ unitId: number; unitName: string }>>();

    for (const floor of floorStructures) {
      unitsByFloorId.set(
        floor.floorId,
        (floor.units || [])
          .map((unit) => ({
            unitId: unit.id,
            unitName: unit.name,
          }))
          .sort((a, b) => a.unitName.localeCompare(b.unitName, undefined, { numeric: true })),
      );
    }

    const sortNodes = (a: EpsNode, b: EpsNode) =>
      (a.order ?? 0) - (b.order ?? 0) ||
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

    const blockNodes = projectNodes
      .filter((node) => node.type === EpsNodeType.BLOCK)
      .sort(sortNodes);

    return blockNodes.map((block) => {
      const towerNodes = projectNodes
        .filter((node) => node.parentId === block.id && node.type === EpsNodeType.TOWER)
        .sort(sortNodes);

      return {
        blockId: block.id,
        blockName: block.name,
        towers: towerNodes.map((tower) => {
          const floorNodes = projectNodes
            .filter((node) => node.parentId === tower.id && node.type === EpsNodeType.FLOOR)
            .sort(sortNodes);

          return {
            towerId: tower.id,
            towerName: tower.name,
            floors: floorNodes.map((floor) => ({
              floorId: floor.id,
              floorName: floor.name,
              units: unitsByFloorId.get(floor.id) || [],
            })),
          };
        }),
      };
    });
  }

  private resolveActivityLocation(
    epsNodeId: number,
    nodesById: Map<number, EpsNode>,
    projectId: number,
  ) {
    let current = nodesById.get(epsNodeId);
    let block: EpsNode | null = null;
    let tower: EpsNode | null = null;
    let floor: EpsNode | null = null;

    while (current) {
      if (current.type === EpsNodeType.FLOOR && !floor) floor = current;
      if (current.type === EpsNodeType.TOWER && !tower) tower = current;
      if (current.type === EpsNodeType.BLOCK && !block) block = current;
      if (current.id === projectId || current.type === EpsNodeType.PROJECT) break;
      current = current.parentId ? nodesById.get(current.parentId) : undefined;
    }

    if (!tower && !block && !floor) {
      return null;
    }

    const pathParts = [block?.name, tower?.name, floor?.name].filter(Boolean);
    return {
      epsNodeId,
      blockId: block?.id ?? null,
      blockName: block?.name ?? null,
      towerId: tower?.id ?? null,
      towerName: tower?.name ?? null,
      floorId: floor?.id ?? null,
      floorName: floor?.name ?? null,
      pathLabel: pathParts.length > 0 ? pathParts.join(' / ') : 'General',
    };
  }

  private isTemplateApplicable(template: CustomerMilestoneTemplate, unit: UnitContext) {
    const ids = template.applicableEpsIds || [];
    if (!ids.length || template.applicableTo === CustomerMilestoneApplicability.ALL_UNITS) {
      return true;
    }
    if (template.applicableTo === CustomerMilestoneApplicability.TOWER) {
      return ids.includes(unit.towerId);
    }
    if (template.applicableTo === CustomerMilestoneApplicability.FLOOR) {
      return ids.includes(unit.floorId);
    }
    if (template.applicableTo === CustomerMilestoneApplicability.UNIT) {
      return ids.includes(unit.qualityUnitId);
    }
    return true;
  }

  private resolveTemplateActivityIds(template: CustomerMilestoneTemplate) {
    const linked = (template.activityLinks || []).map((link) => link.activityId);
    if (linked.length > 0) return linked;
    if (template.triggerActivityId) return [template.triggerActivityId];
    return [];
  }
}
