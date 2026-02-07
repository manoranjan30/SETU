import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like, IsNull, Brackets } from 'typeorm';
import {
  BoqActivityPlan,
  PlanningBasis,
  MappingType,
} from './entities/boq-activity-plan.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { BoqSubItem } from '../boq/entities/boq-sub-item.entity';
import { MeasurementElement } from '../boq/entities/measurement-element.entity';
import { Activity, ActivityStatus } from '../wbs/entities/activity.entity';
import { ActivityRelationship } from '../wbs/entities/activity-relationship.entity';
import { RecoveryPlan } from './entities/recovery-plan.entity';
import {
  QuantityProgressRecord,
  ProgressStatus,
} from './entities/quantity-progress-record.entity';
import { WbsNode } from '../wbs/entities/wbs.entity';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { CpmService } from '../wbs/cpm.service';

@Injectable()
export class PlanningService {
  constructor(
    @InjectRepository(BoqActivityPlan)
    private planRepo: Repository<BoqActivityPlan>,
    @InjectRepository(RecoveryPlan)
    private recoveryRepo: Repository<RecoveryPlan>,
    @InjectRepository(BoqItem)
    private boqRepo: Repository<BoqItem>,
    @InjectRepository(Activity)
    private activityRepo: Repository<Activity>,
    @InjectRepository(QuantityProgressRecord)
    private progressRepo: Repository<QuantityProgressRecord>,
    @InjectRepository(BoqSubItem)
    private subItemRepo: Repository<BoqSubItem>,
    @InjectRepository(MeasurementElement)
    private measurementRepo: Repository<MeasurementElement>,
    @InjectRepository(WbsNode)
    private wbsRepo: Repository<WbsNode>,
    @InjectRepository(EpsNode)
    private epsRepo: Repository<EpsNode>,
    @InjectRepository(ActivityRelationship)
    private relRepo: Repository<ActivityRelationship>,
    private cpmService: CpmService,
  ) {}

  async unlinkBoq(
    boqItemId: number,
    boqSubItemId?: number,
    measurementId?: number,
  ): Promise<void> {
    const whereClause: any = { boqItemId };

    if (measurementId) {
      whereClause.measurementId = measurementId;
    } else if (boqSubItemId) {
      whereClause.boqSubItemId = boqSubItemId;
      whereClause.measurementId = IsNull();
    } else {
      whereClause.boqSubItemId = IsNull();
      whereClause.measurementId = IsNull();
    }

    // Capture affected activities before deletion
    const affectedPlans = await this.planRepo.find({
      where: whereClause,
      select: ['activityId'],
    });
    const activityIds = [...new Set(affectedPlans.map((p) => p.activityId))];
    const projectId = affectedPlans[0]?.activityId
      ? (
          await this.activityRepo.findOne({
            where: { id: affectedPlans[0].activityId },
          })
        )?.projectId
      : null;

    const result = await this.planRepo.delete(whereClause);
    console.log(
      `[PlanningService] Unlinked Query: ${JSON.stringify(whereClause)} -> Deleted ${result.affected} rows`,
    );

    // Trigger updates
    for (const id of activityIds) {
      await this.updateActivityFinancials(id);
    }
    if (projectId) {
      await this.cpmService.triggerWbsRollup(projectId);
    }
  }

  async distributeBoqToActivity(
    boqItemId: number,
    activityId: number,
    quantity: number,
    basis: PlanningBasis = PlanningBasis.INITIAL,
    mappingType: MappingType = MappingType.DIRECT,
    mappingRules?: any,
    boqSubItemId?: number,
    measurementId?: number,
  ): Promise<BoqActivityPlan> {
    const boqItem = await this.boqRepo.findOne({ where: { id: boqItemId } });
    if (!boqItem) throw new NotFoundException('BOQ Item not found');

    const activity = await this.activityRepo.findOne({
      where: { id: activityId },
    });
    if (!activity) throw new NotFoundException('Activity not found');

    // Logic for Full Mapping (if quantity is -1)
    if (quantity === -1) {
      if (measurementId) {
        // Fetch Measurement Qty
        const meas = await this.measurementRepo.findOne({
          where: { id: measurementId },
        });
        if (!meas) throw new NotFoundException('Measurement not found');
        quantity = meas.qty || 0;
      } else if (boqSubItemId) {
        // Fetch SubItem Qty
        const sub = await this.subItemRepo.findOne({
          where: { id: boqSubItemId },
        });
        if (!sub) throw new NotFoundException('SubItem not found');
        quantity = sub.qty || 0;
      } else {
        // Main Item: Map Remaining
        // Check existing links to calculate remaining
        const existingLinks = await this.planRepo.find({
          where: { boqItemId },
        });
        const mappedTotal = existingLinks.reduce(
          (sum, l) => sum + Number(l.plannedQuantity),
          0,
        );
        const remaining = boqItem.qty - mappedTotal;
        quantity = remaining > 0 ? remaining : 0;
      }
    }

    // One Measurement can only link to ONE activity
    if (measurementId) {
      const existingOther = await this.planRepo.findOne({
        where: { measurementId },
      });
      if (existingOther && existingOther.activityId !== activityId) {
        throw new BadRequestException(
          'This measurement is already linked to another activity',
        );
      }
    }

    // Check for existing link with specific granularity
    let plan = await this.planRepo.findOne({
      where: {
        boqItemId,
        activityId,
        planningBasis: basis,
        // Use IsNull() for explicit null check, handle undefined by defaulting to IsNull()
        boqSubItemId: boqSubItemId ? boqSubItemId : IsNull(),
        measurementId: measurementId ? measurementId : IsNull(),
      },
    });

    if (plan) {
      // Update existing link
      if (quantity === -1) {
        // Add remaining to current (or just set to remaining if it's a new calc?)
        // If I click "Link" again on the same item, I expect it update to full available.
        plan.plannedQuantity = Number(plan.plannedQuantity) + quantity;
      } else {
        plan.plannedQuantity = quantity;
      }
      plan.mappingType = mappingType;
      plan.mappingRules = mappingRules;
    } else {
      plan = this.planRepo.create({
        projectId: boqItem.projectId,
        boqItemId,
        activityId,
        plannedQuantity: quantity,
        planningBasis: basis,
        mappingType,
        mappingRules,
        boqSubItemId, // Can be undefined, better than null for DeepPartial
        measurementId, // Can be undefined
      });
    }

    // Auto-inherit dates from schedule if not manually specified (for INITIAL basis)
    if (basis === PlanningBasis.INITIAL) {
      plan.plannedStart = activity.startDatePlanned;
      plan.plannedFinish = activity.finishDatePlanned;
    }

    const savedPlan = await this.planRepo.save(plan);

    // Trigger Financial Update and WBS Rollup
    await this.updateActivityFinancials(activityId);
    await this.cpmService.triggerWbsRollup(activity.projectId);

    return savedPlan;
  }

  async getProjectPlanningMatrix(
    projectId: number,
  ): Promise<BoqActivityPlan[]> {
    return this.planRepo.find({
      where: { projectId },
      relations: ['boqItem', 'activity'],
    });
  }

  async getProjectRelationships(
    projectId: number,
  ): Promise<ActivityRelationship[]> {
    return this.relRepo.find({
      where: { projectId },
      relations: ['predecessor', 'successor'],
    });
  }

  // --- Mapper Logic ---
  async getUnmappedBoqItems(projectId: number): Promise<any[]> {
    const boqItems = await this.boqRepo.find({
      where: { projectId },
      relations: [
        'subItems',
        'subItems.measurements',
        'epsNode',
        'subItems.measurements.epsNode',
      ],
    });
    const allLinks = await this.planRepo
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.activity', 'activity')
      .leftJoinAndSelect('activity.wbsNode', 'wbs')
      .leftJoinAndSelect('wbs.parent', 'parent')
      .leftJoinAndSelect('parent.parent', 'grandparent')
      .where('plan.projectId = :projectId', { projectId })
      .where('plan.projectId = :projectId', { projectId })
      .getMany();

    console.log(
      `[PlanningService] getUnmappedBoqItems Debug: Found ${boqItems.length} BOQ Items and ${allLinks.length} existing Plan Links.`,
    );

    // Helper to formatting Activity Path
    const formatActivityPath = (l: BoqActivityPlan) => {
      if (!l.activity) return `[ID:${l.activityId}]`; // Fallback to ID for debugging
      const parts: string[] = [];
      // Traverse up to 2 levels
      let current = l.activity.wbsNode;
      let depth = 2;
      while (current && depth > 0) {
        if (current.parent) {
          parts.unshift(current.parent.wbsName);
        }
        current = current.parent;
        depth--;
      }
      parts.push(l.activity.activityName);
      return parts.join(' > ');
    };

    return boqItems.map((item) => {
      // 1. Calculate Main Item Status (Aggregate)
      const links = allLinks.filter((l) => l.boqItemId === item.id);
      const mappedTotal = links.reduce(
        (sum, l) => sum + Number(l.plannedQuantity),
        0,
      );
      const remaining = item.qty - mappedTotal;

      let status = 'UNMAPPED';
      if (mappedTotal > 0 && remaining > 0.01) status = 'PARTIAL';
      if (mappedTotal >= item.qty - 0.01) status = 'MAPPED';
      const mappedActivities = [
        ...new Set(links.map((l) => formatActivityPath(l)).filter(Boolean)),
      ].join(', ');

      // 2. Process Sub-Items (Granular Status)
      const enrichedSubItems = item.subItems?.map((sub) => {
        // Filter links relevant to this sub-item
        const directSubLinks = links.filter((l) => l.boqSubItemId === sub.id);
        const subMapped = directSubLinks.reduce(
          (sum, l) => sum + Number(l.plannedQuantity),
          0,
        );

        const genericLinks = links.filter(
          (l) => !l.boqSubItemId && !l.measurementId,
        );
        const genericTotal = genericLinks.reduce(
          (sum, l) => sum + Number(l.plannedQuantity),
          0,
        );

        let subStatus = 'UNMAPPED';
        if (genericTotal >= item.qty - 0.01) subStatus = 'MAPPED';
        else {
          if (subMapped >= sub.qty - 0.001) subStatus = 'MAPPED';
          else if (subMapped > 0) subStatus = 'PARTIAL';
        }

        // Linked Activity Logic (Calculated)
        const relevantSubLinks = [...directSubLinks, ...genericLinks];
        const subMappedActivities = [
          ...new Set(
            relevantSubLinks.map((l) => formatActivityPath(l)).filter(Boolean),
          ),
        ].join(', ');

        // 3. Process Measurements
        const enrichedMeasurements = sub.measurements?.map((meas) => {
          const directMeasLinks = links.filter(
            (l) => l.measurementId === meas.id,
          );
          const measMapped = directMeasLinks.reduce(
            (sum, l) => sum + Number(l.plannedQuantity),
            0,
          );

          let measStatus = 'UNMAPPED';
          if (subStatus === 'MAPPED') measStatus = 'MAPPED';
          else {
            if (measMapped >= meas.qty - 0.001) measStatus = 'MAPPED';
            else if (measMapped > 0) measStatus = 'PARTIAL';
          }

          const linksInheritedFromSub = links.filter(
            (l) => l.boqSubItemId === sub.id && !l.measurementId,
          );
          const relevantMeasLinks = [
            ...directMeasLinks,
            ...linksInheritedFromSub,
            ...genericLinks,
          ];
          const measMappedActivities = [
            ...new Set(
              relevantMeasLinks
                .map((l) => formatActivityPath(l))
                .filter(Boolean),
            ),
          ].join(', ');

          return {
            ...meas,
            mappingStatus: measStatus,
            mappedActivities: measMappedActivities,
          };
        });

        return {
          ...sub,
          mappingStatus: subStatus,
          measurements: enrichedMeasurements,
          mappedActivities: subMappedActivities,
        };
      });

      return {
        ...item,
        mappedTotal,
        remaining,
        mappingStatus: status,
        mappedActivities,
        subItems: enrichedSubItems, // Functionality Overwrite
      };
    });
  }

  async getActivityAllocations(activityId: number): Promise<BoqActivityPlan[]> {
    return this.planRepo.find({
      where: { activityId },
      relations: ['boqItem'],
    });
  }

  async createRecoveryPlan(data: Partial<RecoveryPlan>): Promise<RecoveryPlan> {
    const plan = this.recoveryRepo.create(data);
    return this.recoveryRepo.save(plan);
  }

  async getRecoveryPlans(projectId: number): Promise<RecoveryPlan[]> {
    return this.recoveryRepo.find({
      where: { projectId },
      relations: ['activity'],
    });
  }

  // --- Progress Logic ---

  async recordProgress(
    data: Partial<QuantityProgressRecord>,
  ): Promise<QuantityProgressRecord> {
    // 1. Create Record
    const record = this.progressRepo.create({
      ...data,
      measureDate: new Date(),
      status: ProgressStatus.APPROVED, // Auto-approve for now (or make configurable)
    });
    const savedRecord = await this.progressRepo.save(record);

    // 2. Trigger Schedule Recalculation for affected activities
    await this.recalculateScheduleFromBoq(savedRecord.boqItemId);

    return savedRecord;
  }

  async recalculateScheduleFromBoq(boqItemId: number): Promise<void> {
    // Find all activities linked to this BOQ item
    const links = await this.planRepo.find({
      where: { boqItemId },
      relations: ['activity'],
    });

    const affectedActivityIds = [...new Set(links.map((l) => l.activityId))];

    for (const activityId of affectedActivityIds) {
      await this.updateActivityProgress(activityId);
    }
  }

  private async updateActivityProgress(activityId: number): Promise<void> {
    // 1. Get all mapped BOQ items for this activity
    const mappings = await this.planRepo.find({
      where: { activityId, planningBasis: PlanningBasis.INITIAL },
      relations: ['boqItem'],
    });

    if (mappings.length === 0) return;

    let totalEarnedWeight = 0;
    let totalPlannedWeight = 0;
    let totalBudgetedValue = 0;
    let totalActualValue = 0;
    let allLinksComplete = true; // Strict Check

    for (const mapping of mappings) {
      const item = mapping.boqItem;
      const rate = Number(item.rate || 0);

      // FIXED: Filter by Location (EPS Node) to prevent cross-floor progress polution
      const locationIdStr = String(mapping.projectId);
      const progressRecords = await this.progressRepo.find({
        where: {
          boqItemId: mapping.boqItemId,
          status: ProgressStatus.APPROVED,
          locationId: locationIdStr, // Constrain by Location
        },
      });
      const totalMeasured = progressRecords.reduce(
        (sum, r) => sum + Number(r.measuredQty),
        0,
      );

      // BOQ % Complete
      const boqTotal = mapping.boqItem.qty || 1; // Avoid divide by zero
      const boqPercentCheck = totalMeasured / boqTotal;
      const boqPercent = Math.min(1, Math.max(0, boqPercentCheck)); // Clamp 0-1

      // Strict Finish Verification
      if (totalMeasured < mapping.plannedQuantity) {
        allLinksComplete = false;
      }

      // Financials
      totalBudgetedValue += mapping.plannedQuantity * rate;
      totalActualValue += totalMeasured * rate;

      // This mapping's contribution to Activity
      // Weighted by the Mapped Quantity
      const earnedPayload = mapping.plannedQuantity * boqPercent;

      totalEarnedWeight += earnedPayload;
      totalPlannedWeight += Number(mapping.plannedQuantity);
    }

    if (totalPlannedWeight === 0) return;

    // Calculate Activity % Complete
    const activityPercent = (totalEarnedWeight / totalPlannedWeight) * 100;
    const finalPercent = parseFloat(activityPercent.toFixed(2));

    // Update Activity
    const activity = await this.activityRepo.findOne({
      where: { id: activityId },
    });
    if (activity) {
      const oldStatus = activity.status;
      activity.percentComplete = finalPercent;
      activity.budgetedValue = Number(totalBudgetedValue.toFixed(2));
      activity.actualValue = Number(totalActualValue.toFixed(2));

      // AUTO-START Logic
      // If progress > 0 and no actual start date, set it.
      if (finalPercent > 0 && !activity.startDateActual) {
        console.log(
          `[Auto - Start] Activity ${activity.id} (${activity.activityCode}) started.Progress: ${finalPercent}% `,
        );
        activity.startDateActual = new Date();
        if (activity.status === ActivityStatus.NOT_STARTED) {
          activity.status = ActivityStatus.IN_PROGRESS;
        }
      }

      // AUTO-FINISH Logic (Strict: All links must be >= 100%)
      if (finalPercent >= 100 && allLinksComplete) {
        if (!activity.finishDateActual) {
          console.log(`[Auto - Finish] Activity ${activity.id} finished.`);
          activity.finishDateActual = new Date();
        }
        activity.status = ActivityStatus.COMPLETED;
      } else if (
        finalPercent > 0 &&
        activity.status === ActivityStatus.NOT_STARTED
      ) {
        activity.status = ActivityStatus.IN_PROGRESS;
      }

      // REVERSAL Logic (If user unbinds or clears date)
      if (
        (finalPercent < 100 || !allLinksComplete) &&
        activity.status === ActivityStatus.COMPLETED
      ) {
        activity.status = ActivityStatus.IN_PROGRESS;
        activity.finishDateActual = null;
      }

      await this.activityRepo.save(activity);
      console.log(
        `[UpdateActivity] ${activity.activityCode}: ${oldStatus} -> ${activity.status}, %=${finalPercent}, Start = ${activity.startDateActual} - AllLinksComplete: ${allLinksComplete} `,
      );
    }
  }

  async completeActivity(activityId: number): Promise<Activity> {
    const activity = await this.activityRepo.findOne({
      where: { id: activityId },
    });
    if (!activity) throw new Error('Activity not found');

    activity.status = ActivityStatus.COMPLETED;
    activity.finishDateActual = new Date();

    // If never started, assume started now too (duration 0)
    if (!activity.startDateActual) {
      activity.startDateActual = new Date();
    }

    // Force 100% to ensure consistency
    activity.percentComplete = 100;

    return this.activityRepo.save(activity);
  }

  // --- GAP ANALYSIS / DASHBOARD STATS ---

  async getPlanningStats(projectId: number): Promise<any> {
    // 1. BOQ Stats
    const boqItems = await this.boqRepo.find({ where: { projectId } });
    const totalBoqItems = boqItems.length;

    // Find items that have at least one link
    // Efficient way: Query PlanRepo for distinct boqItemId
    // Note: This matches "Main Items" only if we query boqItemId directly.
    // For accurate gap analysis, we should check if the item is "Fully Mapped" which is costly.
    // For MVP: "Items with at least one execution link"
    const plannedBoqIds = await this.planRepo
      .createQueryBuilder('plan')
      .select('DISTINCT plan.boq_item_id', 'id')
      .where('plan.projectId = :projectId', { projectId })
      .getRawMany();

    const mappedBoqCount = plannedBoqIds.length;

    // 2. Activity Stats (Leaf nodes only usually?)
    // Let's count all Activities (that are not purely structural folders if possible, but schema doesn't distinguish easily yet unless type=task)
    // Assuming all Activities in this repo are execution tasks
    const activities = await this.activityRepo.find({ where: { projectId } });
    const totalActivities = activities.length;

    const plannedActivityIds = await this.planRepo
      .createQueryBuilder('plan')
      .select('DISTINCT plan.activity_id', 'id')
      .where('plan.projectId = :projectId', { projectId })
      .getRawMany();

    const linkedActivityCount = plannedActivityIds.length;

    return {
      boq: {
        total: totalBoqItems,
        mapped: mappedBoqCount,
        unmapped: totalBoqItems - mappedBoqCount,
        coverage: totalBoqItems
          ? Math.round((mappedBoqCount / totalBoqItems) * 100)
          : 0,
      },
      schedule: {
        total: totalActivities,
        linked: linkedActivityCount,
        unlinked: totalActivities - linkedActivityCount,
        coverage: totalActivities
          ? Math.round((linkedActivityCount / totalActivities) * 100)
          : 0,
      },
    };
  }

  async getUnlinkedActivities(projectId: number): Promise<Activity[]> {
    // Find activities that exist but are NOT in the plan table
    // Use QueryBuilder with NOT EXISTS or LEFT JOIN WHERE NULL
    return this.activityRepo
      .createQueryBuilder('activity')
      .leftJoin('boq_activity_plan', 'plan', 'plan.activity_id = activity.id')
      .where('activity.projectId = :projectId', { projectId })
      .andWhere('plan.id IS NULL')
      .getMany();
  }

  async getGapAnalysis(projectId: number): Promise<any[]> {
    // Integrity Matrix: Activity | Path | BOQ Linked? | Execution Started? | Missing What?
    const rows = await this.activityRepo
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.wbsNode', 'wbs')
      .leftJoinAndSelect('wbs.parent', 'parent')
      .leftJoinAndSelect('parent.parent', 'grandparent')
      .leftJoinAndSelect('grandparent.parent', 'greatgrandparent')
      .leftJoin('boq_activity_plan', 'plan', 'plan.activity_id = activity.id')
      .select([
        'activity.id',
        'activity.activityName',
        'activity.activityCode',
        'activity.percentComplete',
        'activity.status',
        'wbs.wbsName',
        'parent.wbsName',
        'grandparent.wbsName',
        'greatgrandparent.wbsName',
        'COUNT(plan.id) as link_count',
      ])
      .where('activity.projectId = :projectId', { projectId })
      .groupBy(
        'activity.id, wbs.id, parent.id, grandparent.id, greatgrandparent.id',
      )
      .getRawMany();

    return rows.map((r) => {
      const pathParts = [
        r.greatgrandparent_wbsName,
        r.grandparent_wbsName,
        r.parent_wbsName,
        r.wbs_wbsName,
      ].filter(Boolean);

      const isLinked = Number(r.link_count) > 0;
      const executionStarted = Number(r.activity_percentComplete) > 0;

      let gapStatus = 'OK';
      if (!isLinked && !executionStarted) gapStatus = 'MISSING_BOQ'; // Just planned, no BOQ
      if (!isLinked && executionStarted)
        gapStatus = 'CRITICAL_UNLINKED_EXECUTION'; // Executing without BOQ?!
      if (isLinked && !executionStarted) gapStatus = 'READY';

      return {
        id: r.activity_id,
        activityName: r.activity_activityName,
        activityCode: r.activity_activityCode,
        wbsPath: pathParts.join(' > '),
        isLinked,
        linkCount: Number(r.link_count),
        percentComplete: Number(r.activity_percentComplete),
        status: r.activity_status,
        gapStatus,
      };
    });
  }

  // --- Schedule Distribution Logic ---
  async distributeActivitiesToEps(
    activityIds: number[],
    targetEpsIds: number[],
    user: any,
  ): Promise<any> {
    try {
      let createdCount = 0;
      let skippedCount = 0;

      // 1. Fetch Source Activities with full WBS context
      const sourceActivities = await this.activityRepo.find({
        where: activityIds.map((id) => ({ id })),
        relations: [
          'wbsNode',
          'wbsNode.parent',
          'wbsNode.parent.parent',
          'wbsNode.parent.parent.parent',
        ], // Fetch up to 3 levels? Recursive would've been better but tree query is complex here.
        // Assumption: WbsNode has `project` which is the Source EPS.
      });

      console.log(
        `Distributing ${sourceActivities.length} activities to ${targetEpsIds.length} targets`,
      );

      // 2. Resolve Targets (Recursive for Blocks/Towers)
      const resolvedTargetIds: number[] = [];

      for (const targetId of targetEpsIds) {
        const node = await this.epsRepo.findOne({
          where: { id: targetId },
          relations: ['children', 'children.children'],
        }); // Simple depth assumption or use descendent query
        if (!node) continue;

        // Assumption: "Project" can be at any level, but typically distinct from purely generic "Block" wrapper?
        // Or do we treat ANY node as a potential project if it's selected?
        // Per requirement: "Default all child will linked to that child node"
        // This implies if I select Block A, I want it distributed to Tower 1/2/3 => Floor 1/2...
        // So we want LEAF nodes (or nodes that effectively act as projects).
        // Let's assume nodes of type PROJECT, UNIT, ROOM? Or simply "Bottom-most" nodes?
        // Or simpler: Find all descendants of type PROJECT/TOWER/FLOOR/UNIT depending on where WBS lives.
        // Assuming "WBS lives at Project ID" -> we need IDs of nodes that serve as Projects.
        // Let's recurse to find all descendant nodes that are LEAVES or specifically designated.

        // For now: Simple Recursion to find all descendants.
        // If it's a leaf, add it. If it has children, add children?
        // Wait, if I add Block A, do I want Block A to *also* have a schedule? Or just its children?
        // User said: "divide the master schedule into block wise tower wise".
        // Often, schedule exists at Lowest Level.
        // Let's assume: If children exist, distribute to children. If no children (Leaf), distribute to self.

        const getLeaves = async (n: EpsNode) => {
          const children = await this.epsRepo.find({
            where: { parentId: n.id },
          });
          if (children.length === 0) {
            resolvedTargetIds.push(n.id);
          } else {
            for (const child of children) {
              await getLeaves(child);
            }
          }
        };

        await getLeaves(node);
      }

      // Deduplicate
      const uniqueTargets = [...new Set(resolvedTargetIds)];
      console.log(
        `Resolved ${targetEpsIds.length} inputs to ${uniqueTargets.length} leaf targets`,
      );

      for (const targetEpsId of uniqueTargets) {
        // Validate if target exists or is valid project?
        // Assuming valid for now.

        for (const sourceAct of sourceActivities) {
          // Check if already distributed?
          // Logic: Does an activity exist in Target EPS with masterActivityId = sourceAct.id?
          // Need to query across projects... Activity has projectId.
          // But wait, Activity doesn't link directly to EPS except via WbsNode -> Project.
          // We need to assume Target EPS is a "Project" in WBS terms.
          // Yes, WbsNode.projectId refers to EpsNode ID in this system (based on WbsNode entity).

          const existingLink = await this.activityRepo.findOne({
            where: { masterActivityId: sourceAct.id, projectId: targetEpsId },
          });

          if (existingLink) {
            skippedCount++;
            continue; // Skip duplicates for now
          }

          // 3. Replicate WBS Path
          // Path relative to Source Project Root
          // We need to walk up from sourceAct.wbsNode until we hit the root (parentId null) OR until we hit the project ID boundary.
          const pathStack: WbsNode[] = [];
          let current = sourceAct.wbsNode;
          while (current) {
            pathStack.unshift(current);
            if (!current.parent) break; // Reached root
            current = current.parent;
          }

          // Now we have [Root, Level1, Level2, ParentOfActivity]
          // We need to ensure [TargetRoot, Level1, Level2, ParentOfActivity] exists in Target Project.
          // Wait, sourceAct.wbsNode might be deep.
          // We need corresponding structure in Target.

          let targetParentId: number | null = null; // Root

          // Find or Create Root in Target
          // Actually, the "Root" of the WBS for a project usually has parentId = null.
          // We can't just blindly copy everything.
          // Usually, we want to match by NAME?
          // Let's match by `wbsCode` or `wbsName` at each level.

          for (const sourceNode of pathStack) {
            // Check if node exists in Target with same ID? No, different IDs.
            // Same Code?
            let targetNode = await this.wbsRepo.findOne({
              where: {
                projectId: targetEpsId,
                wbsCode: sourceNode.wbsCode,
                parentId: targetParentId ? targetParentId : IsNull(), // Scope to parent to ensure tree structure matches
              },
            });

            if (!targetNode) {
              // Create it
              targetNode = this.wbsRepo.create({
                projectId: targetEpsId,
                wbsCode: sourceNode.wbsCode,
                wbsName: sourceNode.wbsName,
                parentId: targetParentId,
                wbsLevel: sourceNode.wbsLevel, // Might need adjustment if target root is different level? Assuming similar structure.
                sequenceNo: sourceNode.sequenceNo,
                isControlAccount: sourceNode.isControlAccount,
                createdBy: user?.username || 'SYSTEM',
              });
              targetNode = await this.wbsRepo.save(targetNode);
            }
            targetParentId = targetNode.id;
          }

          // 4. Create Activity in Target
          if (targetParentId) {
            const newActivity = this.activityRepo.create({
              projectId: targetEpsId, // Target Project
              wbsNode: { id: targetParentId }, // Last node from the stack
              activityCode: sourceAct.activityCode, // Maintain code or suffix?
              activityName: sourceAct.activityName,
              durationPlanned: sourceAct.durationPlanned,
              startDatePlanned: sourceAct.startDatePlanned,
              finishDatePlanned: sourceAct.finishDatePlanned,
              masterActivityId: sourceAct.id,
              status: ActivityStatus.NOT_STARTED,
              createdBy: user?.username || 'SYSTEM',
            });
            const savedActivity = await this.activityRepo.save(newActivity);
            createdCount++;

            // 5. Copy BOQ Links (Smart Linking)
            const sourcePlans = await this.planRepo.find({
              where: { activityId: sourceAct.id },
            });
            if (sourcePlans.length > 0) {
              const newPlans: BoqActivityPlan[] = [];

              for (const sp of sourcePlans) {
                let detailedMeasurements: MeasurementElement[] = [];

                // Strategy: Check if this BOQ Item/Sub-Item has measurements specific to the Target EPS Location
                if (sp.boqSubItemId) {
                  detailedMeasurements = await this.measurementRepo.find({
                    where: {
                      boqSubItemId: sp.boqSubItemId,
                      epsNodeId: targetEpsId,
                    },
                  });
                } else if (sp.boqItemId) {
                  // Less common, but check if main item has measurements directly linked to this EPS
                  detailedMeasurements = await this.measurementRepo.find({
                    where: { boqItemId: sp.boqItemId, epsNodeId: targetEpsId },
                  });
                }

                if (detailedMeasurements.length > 0) {
                  // Found specific measurements for this location! Map them individually.
                  for (const meas of detailedMeasurements) {
                    const plan = this.planRepo.create({
                      activityId: savedActivity.id,
                      projectId: targetEpsId,
                      boqItemId: sp.boqItemId,
                      boqSubItemId: sp.boqSubItemId,
                      measurementId: meas.id, // Precise Link
                      planningBasis: sp.planningBasis,
                      mappingType: MappingType.DIRECT, // Forced direct mapping
                      plannedQuantity: meas.qty, // Auto-set Planned Qty to Measurement Qty (Budget for this Loc)
                      createdBy: user?.username || 'SYSTEM_DISTRIBUTOR',
                    });
                    newPlans.push(plan);
                  }
                } else {
                  // No specific measurements found for this location.
                  // Fallback to Generic Link (clone original scope)
                  // But set Qty to 0 as we don't know the split.
                  const plan = this.planRepo.create({
                    activityId: savedActivity.id,
                    projectId: targetEpsId,
                    boqItemId: sp.boqItemId,
                    boqSubItemId: sp.boqSubItemId,
                    planningBasis: sp.planningBasis,
                    mappingType: sp.mappingType,
                    plannedQuantity: 0,
                    createdBy: user?.username || 'SYSTEM',
                  });
                  newPlans.push(plan);
                }
              }

              if (newPlans.length > 0) {
                await this.planRepo.save(newPlans);
              }
            }
          }
        }
      }

      return { created: createdCount, skipped: skippedCount };
    } catch (error) {
      console.error('Distribution Error:', error);
      throw error;
    }
  }

  async repairDistributedActivities(): Promise<any> {
    const results = {
      brokenFixed: 0,
      linksRefined: 0,
      errors: [] as any[],
    };

    // Step 1: Fix Missing Plans (Broken Activities)
    try {
      const brokenActivities = await this.activityRepo
        .createQueryBuilder('activity')
        .leftJoin('boq_activity_plan', 'plan', 'plan.activity_id = activity.id')
        .where('activity.masterActivityId IS NOT NULL')
        .andWhere('plan.id IS NULL')
        .getMany();

      console.log(
        `[Repair] Found ${brokenActivities.length} broken distributed activities.`,
      );

      for (const activity of brokenActivities) {
        const masterPlans = await this.planRepo.find({
          where: { activityId: activity.masterActivityId },
        });
        if (masterPlans.length > 0) {
          const newPlans = masterPlans.map((sp) =>
            this.planRepo.create({
              activityId: activity.id,
              projectId: activity.projectId,
              boqItemId: sp.boqItemId,
              boqSubItemId: sp.boqSubItemId,
              planningBasis: sp.planningBasis,
              mappingType: sp.mappingType,
              plannedQuantity: 0,
              createdBy: 'REPAIR_SCRIPT',
            }),
          );
          await this.planRepo.save(newPlans);
          results.brokenFixed++;
        }
      }
    } catch (err) {
      console.error('[Repair] Step 1 Error:', err);
      results.errors.push({ step: 1, message: err.message });
    }

    // Step 2: Refine Generic Links -> Smart Measurement Links
    try {
      // Find plans that are "Generic" (No Measurement ID) but have a Sub-Item ID
      // And are part of a Distributed Project (check linked activity)
      const genericPlans = await this.planRepo
        .createQueryBuilder('plan')
        .innerJoinAndSelect('plan.activity', 'activity')
        .where('plan.measurementId IS NULL')
        .andWhere('plan.boqSubItemId IS NOT NULL')
        .andWhere('activity.masterActivityId IS NOT NULL') // Only distributed activities
        .getMany();

      console.log(
        `[Repair] Found ${genericPlans.length} generic plans candidate for refinement.`,
      );

      for (const plan of genericPlans) {
        // Check for matching measurement
        // The Activity's Project ID is the EPS Node ID (Location)
        const locationId = plan.activity.projectId;

        const match = await this.measurementRepo.findOne({
          where: {
            boqSubItemId: plan.boqSubItemId,
            epsNodeId: locationId,
          },
        });

        if (match) {
          // Update Plan to be Specific
          plan.measurementId = match.id;
          plan.plannedQuantity = match.qty; // Set to specific measurement qty
          plan.mappingType = MappingType.DIRECT;

          await this.planRepo.save(plan);
          results.linksRefined++;
          console.log(
            `[Repair] Upgraded Plan ${plan.id} -> Measurement ${match.id} (Qty: ${match.qty}) for Loc ${locationId}`,
          );
        }
      }
    } catch (err) {
      console.error('[Repair] Step 2 Error:', err);
      results.errors.push({ step: 2, message: err.message });
    }

    return results;
  }

  async undistributeActivities(activityIds: number[], targetEpsIds: number[]) {
    try {
      if (!activityIds.length || !targetEpsIds.length) return { deleted: 0 };

      const result = await this.activityRepo
        .createQueryBuilder()
        .delete()
        .from(Activity)
        .where('masterActivityId IN (:...activityIds)', { activityIds })
        .andWhere('projectId IN (:...targetEpsIds)', { targetEpsIds })
        .execute();

      return { deleted: result.affected };
    } catch (error) {
      console.error('Undistribution Error:', error);
      throw error;
    }
  }

  async getDistributionMatrix(
    masterProjectId: number,
  ): Promise<Record<string, number[]>> {
    // Find all activities that claim to be children of activities in this master project
    const distributions = await this.activityRepo
      .createQueryBuilder('activity')
      .select(['activity.projectId', 'activity.masterActivityId'])
      .innerJoin(
        'activity.masterActivity',
        'master',
        'master.projectId = :projectId',
        { projectId: masterProjectId },
      )
      .getRawMany();

    // Group by masterActivityId
    const matrix: Record<string, number[]> = {};
    for (const dist of distributions) {
      const masterId =
        dist.activity_masterActivityId ||
        dist.masterActivity_id ||
        dist.masterActivityId; // Check raw alias carefully
      // In raw results from join: activity_projectId, activity_masterActivityId
      // Let's use getMany to be safer or debug alias if needed.
      // TypeORM raw result aliases can be tricky. Let's assume standard snake_case from TypeORM.
      // activity_masterActivityId
      const targetId = dist.activity_projectId;

      if (masterId) {
        if (!matrix[masterId]) {
          matrix[masterId] = [];
        }
        if (!matrix[masterId].includes(targetId)) {
          matrix[masterId].push(targetId);
        }
      }
    }
    return matrix;
  }

  // --- Activity-Centric Execution Logic ---

  async findActivitiesWithBoq(
    projectId: number,
    wbsNodeId?: number,
  ): Promise<any[]> {
    const rootId = wbsNodeId || projectId;

    // Recursive fetch
    const getDescendantIds = async (parentId: number): Promise<number[]> => {
      const children = await this.epsRepo.find({
        select: ['id'],
        where: { parentId },
      });
      let ids = children.map((c) => c.id);
      for (const child of children) {
        ids = [...ids, ...(await getDescendantIds(child.id))];
      }
      return ids;
    };

    const descendants = await getDescendantIds(rootId);
    const targetIds = [rootId, ...descendants];

    // Log for debugging
    console.log(
      `[PlanningService] Fetching Activities for Root ${rootId}.Total Target IDs: ${targetIds.length} `,
    );

    // Ensure we are fetching for the correct project IDs
    if (targetIds.length === 0)
      console.warn('[PlanningService] Warning: No target IDs found!');

    const query = this.activityRepo
      .createQueryBuilder('activity')
      .innerJoin('boq_activity_plan', 'plan', 'plan.activity_id = activity.id')
      .leftJoin('plan.boqItem', 'boqItem')
      .leftJoin('boq_sub_item', 'subItem', 'subItem.id = plan.boqSubItemId')
      .leftJoin('measurement_element', 'meas', 'meas.id = plan.measurement_id')
      .leftJoin('activity.wbsNode', 'activWbs')
      .leftJoin('activWbs.parent', 'parent')
      .leftJoin('parent.parent', 'grandparent')
      .leftJoin('grandparent.parent', 'greatgrandparent')
      .where(
        new Brackets((qb) => {
          qb.where('activity.projectId IN (:...ids)', { ids: targetIds })
            .orWhere('boqItem.epsNodeId IN (:...ids)', { ids: targetIds })
            .orWhere('meas.epsNodeId IN (:...ids)', { ids: targetIds });
        }),
      )
      .select([
        'activity.id',
        'activity.activityName',
        'activity.activityCode',
        'activity.startDatePlanned',
        'activity.finishDatePlanned',
        'activity.startDateActual',
        'activity.finishDateActual',
        'activity.percentComplete',
        'activity.status',
        'activWbs.wbsName as wbs_wbsName',
        'activWbs.wbsCode as wbs_wbsCode',
        'parent.wbsName as parent_wbsName',
        'parent.wbsCode as parent_wbsCode',
        'grandparent.wbsName as grandparent_wbsName',
        'greatgrandparent.wbsName as greatgrandparent_wbsName',
        'plan.id',
        'plan.plannedQuantity',
        'plan.boqItemId',
        'boqItem.id',
        'boqItem.description',
        'boqItem.uom',
        'boqItem.qty',
        'boqItem.consumedQty',
        'subItem.description',
        'meas.elementName',
        'meas.length',
        'meas.breadth',
        'meas.depth',
        'meas.qty',
        'meas.executedQty',
        'subItem.qty',
      ]);

    const raw = await query.getRawMany();
    console.log(`[PlanningService] Query returned ${raw.length} raw rows.`);
    if (raw.length > 0) {
      console.log('[PlanningService] Raw Keys:', Object.keys(raw[0]));
    }

    // Collect all unique activityId + boqItemId + planId combinations for execution lookup
    const activityBoqPairs: Array<{
      activityId: number;
      boqItemId: number;
      planId: number;
    }> = [];
    for (const r of raw) {
      const activityId = r.activity_id; // Check alias if this fails
      const boqItemId = r.plan_boqItemId || r.boqItem_id; // Check alias
      const planId = r.plan_id; // Check alias
      if (activityId && boqItemId && planId) {
        activityBoqPairs.push({ activityId, boqItemId, planId });
      }
    }

    // Fetch all Site Execution measurements for these combinations
    // Key format: "planId" -> executedQty (per-plan tracking)
    const execMeasMap = new Map<string, number>();

    if (activityBoqPairs.length > 0) {
      // Get unique boqItemIds
      const uniqueBoqIds = [
        ...new Set(activityBoqPairs.map((p) => p.boqItemId)),
      ];

      // Query Site Execution measurements
      const siteExecMeas = await this.measurementRepo
        .createQueryBuilder('m')
        .where('m.boqItemId IN (:...boqIds)', { boqIds: uniqueBoqIds })
        .andWhere('m.elementName = :name', { name: 'Site Execution' })
        .getMany();

      console.log(
        `[PlanningService] Found ${siteExecMeas.length} Site Execution measurements`,
      );

      for (const m of siteExecMeas as any[]) {
        // NEW: Parse elementId to extract planId for per-plan lookup
        // Format A (Legacy): "SITE-EXEC-{boqItemId}-{activityId}-{planId}" (5 parts)
        // Format B (Isolated): "SITE-EXEC-{boqItemId}-{activityId}-{epsNodeId}-{planId}" (6 parts)
        const elementId = m.elementId || '';
        const parts = elementId.split('-');
        const extractedPlanId =
          parts.length >= 6 ? parts[5] : parts.length >= 5 ? parts[4] : null;

        if (extractedPlanId && extractedPlanId !== 'NOPLAN') {
          // Per-plan tracking key: SITE-EXEC-{boqItemId}-{activityId}-{epsNodeId}-{planId}
          const key = `plan - ${extractedPlanId} `;
          const current = execMeasMap.get(key) || 0;
          execMeasMap.set(key, current + Number(m.executedQty || 0));
          console.log(
            `[PlanningService] Per - Plan Execution: ${key} = ${execMeasMap.get(key)} `,
          );
        } else {
          // Fallback to legacy key format: "activityId-boqItemId"
          const legacyKey = `${m.activityId || 'null'} -${m.boqItemId} `;
          execMeasMap.set(
            legacyKey,
            (execMeasMap.get(legacyKey) || 0) + Number(m.executedQty || 0),
          );
          console.log(
            `[PlanningService] Legacy Execution: ${legacyKey} = ${execMeasMap.get(legacyKey)} `,
          );
        }
      }
    }

    const groupedMap = new Map<number, any>();

    for (const r of raw) {
      const activityId = r.activity_id;

      if (!groupedMap.has(activityId)) {
        // Determine Status based on Finish Date (Robust Sync)
        let status = r.activity_status;
        if (
          !r.activity_finishDateActual &&
          status === ActivityStatus.COMPLETED
        ) {
          status = ActivityStatus.IN_PROGRESS;
        }
        if (r.activity_finishDateActual) {
          status = ActivityStatus.COMPLETED;
        }

        // Robust Key Extraction
        // Check original alias, snake_case, and fully lowercased variants
        const wbsCode =
          r.wbs_wbsCode ||
          r.wbs_wbscode ||
          r.activWbs_wbsCode ||
          r.activWbs_wbs_code ||
          r.activwbs_wbscode;
        const wbsName =
          r.wbs_wbsName ||
          r.wbs_wbsname ||
          r.activWbs_wbsName ||
          r.activWbs_wbs_name ||
          r.activwbs_wbsname;

        const parentName =
          r.parent_wbsName || r.parent_wbsname || r.parent_wbs_name;
        const grandName =
          r.grandparent_wbsName ||
          r.grandparent_wbsname ||
          r.grandparent_wbs_name;
        const greatName =
          r.greatgrandparent_wbsName ||
          r.greatgrandparent_wbsname ||
          r.greatgrandparent_wbs_name;

        const wbsInfo = wbsCode ? `${wbsCode} - ${wbsName}` : wbsName;

        const pathParts = [greatName, grandName, parentName, wbsInfo].filter(
          Boolean,
        );

        groupedMap.set(activityId, {
          id: activityId,
          activityName: r.activity_activityName,
          activityCode: r.activityCode || r.activity_activityCode,
          status: status,
          percentComplete: r.activity_percentComplete,
          startDateActual: r.activity_startDateActual,
          finishDateActual: r.activity_finishDateActual,
          wbsPath: pathParts.join(' > '),
          parentWbs: wbsInfo, // Explicit field for UI
          plans: [],
        });
      }

      if (r.plan_id) {
        // Construct Hierarchical Description
        let displayDescription = r.boqItem_description;
        if (r.subItem_description) {
          displayDescription += ` > ${r.subItem_description} `;
        }
        if (r.meas_elementName) {
          // If measurement exists, show technical details
          const dims: string[] = [];
          if (Number(r.meas_length)) dims.push(`L:${Number(r.meas_length)} `);
          if (Number(r.meas_breadth)) dims.push(`B:${Number(r.meas_breadth)} `);
          if (Number(r.meas_depth)) dims.push(`D:${Number(r.meas_depth)} `);

          displayDescription += ` > ${r.meas_elementName} (${dims.join(' x ')})`;
        }

        // Fix BOQ Item ID access
        const validBoqItemId =
          r.plan_boqItemId || r.boqItem_id || r.plan_boq_item_id;

        // Use Plan Qty (if not null/undefined) -> Measurement Qty -> SubItem Qty -> 0
        let finalPlannedQty = parseFloat(r.plan_plannedQuantity);

        // Fix: explicit check because 0 is falsy in JS
        if (isNaN(finalPlannedQty)) {
          finalPlannedQty =
            parseFloat(r.meas_qty) || parseFloat(r.subItem_qty) || 0;
        }

        // Lookup executed qty from map: try plan-specific first, then activity+boq, then generic
        const planKey = `plan - ${r.plan_id} `;
        const specificKey = `${activityId} -${validBoqItemId} `;
        const genericKey = `null - ${validBoqItemId} `;
        let executedQty =
          execMeasMap.get(planKey) ||
          execMeasMap.get(specificKey) ||
          execMeasMap.get(genericKey) ||
          0;

        // Fallback to plan's measurement (distribution)
        if (executedQty === 0) {
          executedQty = parseFloat(r.meas_executedQty) || 0;
        }

        groupedMap.get(activityId).plans.push({
          planId: r.plan_id,
          boqItemId: validBoqItemId,
          description: displayDescription,
          uom: r.boqItem_uom,
          plannedQuantity: finalPlannedQty,
          totalQty: parseFloat(r.boqItem_qty || 0),
          consumedQty: executedQty,
        });
      }
    }

    return Array.from(groupedMap.values());
  }

  async debugProjectActivities(projectId: number) {
    const activityCount = await this.activityRepo.count({
      where: { projectId },
    });

    // Detailed Plan Inspection
    const plans = await this.planRepo.find({
      where: { projectId },
      relations: ['activity', 'measurement'],
    });

    return {
      projectId,
      totalActivities: activityCount,
      totalPlans: plans.length,
      plans: plans.map((p) => ({
        planId: p.id,
        activity: p.activity.activityName,
        plannedQty: p.plannedQuantity, // The value in DB
        measId: p.measurementId,
        subItemId: p.boqSubItemId,
        measQtyFromLink: p.measurement?.qty, // The value on the linked measurement
      })),
    };
  }
  async repairDistributedActivitiesV3(): Promise<any> {
    const results = {
      brokenFixed: 0,
      linksRefined: 0,
      linksSplit: 0,
      errors: [] as any[],
    };

    // Helper to get all descendant EPS IDs (inclusive of self)
    const getEpsHierarchy = async (rootId: number): Promise<number[]> => {
      const ids = [rootId];
      const children = await this.epsRepo.find({ where: { parentId: rootId } });
      for (const child of children) {
        const subIds = await getEpsHierarchy(child.id);
        ids.push(...subIds);
      }
      return ids;
    };

    // Step 1: Fix Missing Plans (Broken Activities)
    try {
      const brokenActivities = await this.activityRepo
        .createQueryBuilder('activity')
        .leftJoin('boq_activity_plan', 'plan', 'plan.activity_id = activity.id')
        .where('activity.masterActivityId IS NOT NULL')
        .andWhere('plan.id IS NULL')
        .getMany();

      for (const activity of brokenActivities) {
        const masterPlans = await this.planRepo.find({
          where: { activityId: activity.masterActivityId },
        });
        if (masterPlans.length > 0) {
          const newPlans = masterPlans.map((sp) =>
            this.planRepo.create({
              activityId: activity.id,
              projectId: activity.projectId,
              boqItemId: sp.boqItemId,
              boqSubItemId: sp.boqSubItemId,
              planningBasis: sp.planningBasis,
              mappingType: sp.mappingType,
              plannedQuantity: 0,
              createdBy: 'REPAIR_SCRIPT_V3',
            }),
          );
          await this.planRepo.save(newPlans);
          results.brokenFixed++;
        }
      }
    } catch (err) {
      results.errors.push({ step: 1, message: err.message });
    }

    // Step 2: Refine Generic Links -> Smart Measurement Links (Aggregated)
    try {
      const genericPlans = await this.planRepo
        .createQueryBuilder('plan')
        .innerJoinAndSelect('plan.activity', 'activity')
        .where('plan.boqSubItemId IS NOT NULL')
        .andWhere('activity.masterActivityId IS NOT NULL')
        .getMany();

      console.log(
        `[RepairV3] Found ${genericPlans.length} generic plans candidate for refinement.`,
      );

      for (const plan of genericPlans) {
        const locationId = plan.activity.projectId;

        // Get all relevant EPS IDs (Self + Descendants)
        const targetEpsIds = await getEpsHierarchy(locationId);

        // Find all matching measurements in this hierarchy
        const matches = await this.measurementRepo.find({
          where: {
            boqSubItemId: plan.boqSubItemId,
            epsNodeId: In(targetEpsIds),
          },
        });

        if (matches.length > 0) {
          // Match 1: Update the existing generic plan
          const firstMatch = matches[0];
          plan.measurementId = firstMatch.id;
          plan.plannedQuantity = firstMatch.qty;
          plan.mappingType = MappingType.DIRECT;
          await this.planRepo.save(plan);
          results.linksRefined++;

          // Matches 2..N: Create NEW plans (Split)
          if (matches.length > 1) {
            const extraPlans = matches.slice(1).map((m) =>
              this.planRepo.create({
                activityId: plan.activityId,
                projectId: plan.projectId,
                boqItemId: plan.boqItemId,
                boqSubItemId: plan.boqSubItemId,
                measurementId: m.id,
                planningBasis: plan.planningBasis,
                mappingType: MappingType.DIRECT,
                plannedQuantity: m.qty,
                createdBy: 'REPAIR_SPLIT',
              }),
            );
            await this.planRepo.save(extraPlans);
            results.linksSplit += extraPlans.length;
          }
          console.log(
            `[RepairV3] Plan ${plan.id} refined / split into ${matches.length} measurement links.`,
          );
        }
      }
    } catch (err) {
      console.error('[RepairV3] Step 2 Error:', err);
      results.errors.push({ step: 2, message: err.message });
    }

    return results;
  }

  async repairDistributedActivitiesV4(): Promise<any> {
    const results = {
      brokenFixed: 0,
      linksRefined: 0,
      linksSplit: 0,
      errors: [] as any[],
    };

    // Helper to get all descendant EPS IDs (inclusive of self)
    const getEpsHierarchy = async (rootId: number): Promise<number[]> => {
      const ids = [rootId];
      const children = await this.epsRepo.find({ where: { parentId: rootId } });
      for (const child of children) {
        const subIds = await getEpsHierarchy(child.id);
        ids.push(...subIds);
      }
      return ids;
    };

    // Step 1: Fix Missing Plans (Broken Activities)
    // Skip Step 1 for V4 optimization, focusing on Refinement

    // Step 2: Refine / Force Align Measurement Links (Aggregated)
    try {
      // Fetch all plans that are part of distributed activities and have SubItems
      const allDistributedPlans = await this.planRepo
        .createQueryBuilder('plan')
        .innerJoinAndSelect('plan.activity', 'activity')
        .where('plan.boqSubItemId IS NOT NULL')
        .andWhere('activity.masterActivityId IS NOT NULL')
        .getMany();

      console.log(
        `[RepairV4] Checking ${allDistributedPlans.length} plans for alignment...`,
      );

      // Group by ActivityId + SubItemId to process as a set
      const groups = new Map<string, BoqActivityPlan[]>();
      for (const p of allDistributedPlans) {
        const key = `${p.activityId}_${p.boqSubItemId} `;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(p);
      }

      for (const [key, currentPlans] of groups) {
        const sample = currentPlans[0];
        const locationId = sample.activity.projectId;

        // 1. Get Hierarchy Measurements
        const targetEpsIds = await getEpsHierarchy(locationId);
        const matches = await this.measurementRepo.find({
          where: {
            boqSubItemId: sample.boqSubItemId,
            epsNodeId: In(targetEpsIds),
          },
        });

        if (matches.length === 0) continue; // No specific measurements, keep as is

        // 2. Compare Current vs Expected
        const currentMeasIds = currentPlans
          .map((p) => p.measurementId)
          .filter(Boolean)
          .sort();
        const expectedMeasIds = matches.map((m) => m.id).sort();

        const isAligned =
          currentMeasIds.length === expectedMeasIds.length &&
          currentMeasIds.every((id, i) => id === expectedMeasIds[i]);

        if (!isAligned) {
          console.log(
            `[RepairV4] Misalignment for Act ${sample.activityId} Sub ${sample.boqSubItemId}. Fixing...`,
          );

          // 3. Fix: Delete All Current -> Create All New
          await this.planRepo.remove(currentPlans);

          const newPlans = matches.map((m) =>
            this.planRepo.create({
              activityId: sample.activityId,
              projectId: sample.projectId,
              boqItemId: sample.boqItemId,
              boqSubItemId: sample.boqSubItemId,
              measurementId: m.id,
              planningBasis: sample.planningBasis,
              mappingType: MappingType.DIRECT,
              plannedQuantity: m.qty,
              createdBy: 'REPAIR_V4_FORCED',
            }),
          );

          await this.planRepo.save(newPlans);
          results.linksSplit += newPlans.length;
          results.linksRefined++;
        }
      }
    } catch (err) {
      console.error('[RepairV4] Step 2 Error:', err);
      results.errors.push({ step: 2, message: err.message });
    }

    return results;
  }

  async repairDistributedActivitiesV5(): Promise<any> {
    const results = {
      brokenFixed: 0,
      linksRefined: 0,
      linksSplit: 0,
      debug: {
        totalPlansFound: 0,
        sampleHierarchy: [] as number[],
        sampleLocation: 0,
      },
      errors: [] as any[],
    };

    const getEpsHierarchy = async (rootId: number): Promise<number[]> => {
      const ids = [rootId];
      const children = await this.epsRepo.find({ where: { parentId: rootId } });
      for (const child of children) {
        const subIds = await getEpsHierarchy(child.id);
        ids.push(...subIds);
      }
      return ids;
    };

    try {
      // Updated Query: Removed masterActivityId check to be broader
      const allDistributedPlans = await this.planRepo
        .createQueryBuilder('plan')
        .innerJoinAndSelect('plan.activity', 'activity')
        .where('plan.boqSubItemId IS NOT NULL')
        .getMany();

      results.debug.totalPlansFound = allDistributedPlans.length;
      console.log(
        `[RepairV5] Checking ${allDistributedPlans.length} plans for alignment...`,
      );

      const groups = new Map<string, BoqActivityPlan[]>();
      for (const p of allDistributedPlans) {
        const key = `${p.activityId}_${p.boqSubItemId} `;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(p);
      }

      let firstLoop = true;

      for (const [key, currentPlans] of groups) {
        const sample = currentPlans[0];
        const locationId = sample.activity.projectId;

        const targetEpsIds = await getEpsHierarchy(locationId);

        if (firstLoop) {
          results.debug.sampleLocation = locationId;
          results.debug.sampleHierarchy = targetEpsIds;
          firstLoop = false;
        }

        const matches = await this.measurementRepo.find({
          where: {
            boqSubItemId: sample.boqSubItemId,
            epsNodeId: In(targetEpsIds),
          },
        });

        if (matches.length === 0) continue;

        const currentMeasIds = currentPlans
          .map((p) => p.measurementId)
          .filter(Boolean)
          .sort();
        const expectedMeasIds = matches.map((m) => m.id).sort();

        const isAligned =
          currentMeasIds.length === expectedMeasIds.length &&
          currentMeasIds.every((id, i) => id === expectedMeasIds[i]);

        if (!isAligned) {
          // Fix: Delete All Current -> Create All New
          await this.planRepo.remove(currentPlans);

          const newPlans = matches.map((m) =>
            this.planRepo.create({
              activityId: sample.activityId,
              projectId: sample.projectId,
              boqItemId: sample.boqItemId,
              boqSubItemId: sample.boqSubItemId,
              measurementId: m.id,
              planningBasis: sample.planningBasis,
              mappingType: MappingType.DIRECT,
              plannedQuantity: m.qty,
              createdBy: 'REPAIR_V5_FORCED',
            }),
          );

          await this.planRepo.save(newPlans);
          results.linksSplit += newPlans.length;
          results.linksRefined++;
        }
      }
    } catch (err) {
      console.error('[RepairV5] Step 2 Error:', err);
      results.errors.push({ step: 2, message: err.message });
    }

    return results;
  }

  async repairDistributedActivitiesV6(): Promise<any> {
    const results = {
      brokenFixed: 0,
      linksRefined: 0,
      linksSplit: 0,
      shadowLinksFound: 0,
      debug: {
        totalPlansFound: 0,
        shadowProjects: [] as string[],
      },
      errors: [] as any[],
    };

    const getEpsHierarchy = async (rootId: number): Promise<number[]> => {
      const ids = [rootId];
      const children = await this.epsRepo.find({ where: { parentId: rootId } });
      for (const child of children) {
        const subIds = await getEpsHierarchy(child.id);
        ids.push(...subIds);
      }
      return ids;
    };

    try {
      const allDistributedPlans = await this.planRepo
        .createQueryBuilder('plan')
        .innerJoinAndSelect('plan.activity', 'activity')
        .where('plan.boqSubItemId IS NOT NULL')
        .getMany();

      results.debug.totalPlansFound = allDistributedPlans.length;
      console.log(`[RepairV6] Checking ${allDistributedPlans.length} plans...`);

      const groups = new Map<string, BoqActivityPlan[]>();
      for (const p of allDistributedPlans) {
        const key = `${p.activityId}_${p.boqSubItemId} `;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(p);
      }

      // Cache for Project / Shadow Hierarchy
      const hierarchyCache = new Map<number, number[]>();

      for (const [key, currentPlans] of groups) {
        const sample = currentPlans[0];
        const locationId = sample.activity.projectId;

        // Resolve Hierarchy with Shadow Check
        let targetEpsIds = hierarchyCache.get(locationId);
        if (!targetEpsIds) {
          targetEpsIds = await getEpsHierarchy(locationId);

          // Shadow Logic: If hierarchy is shallow (only self), check for duplicate named projects
          if (targetEpsIds.length === 1) {
            const projectNode = await this.epsRepo.findOne({
              where: { id: locationId },
            });
            if (projectNode) {
              const shadows = await this.epsRepo.find({
                where: { name: projectNode.name },
              });
              for (const shadow of shadows) {
                if (shadow.id !== locationId) {
                  const shadowIds = await getEpsHierarchy(shadow.id);
                  if (shadowIds.length > 1) {
                    console.log(
                      `[RepairV6] Found Shadow Project for ${projectNode.name}(${locationId}) -> ${shadow.id} with ${shadowIds.length} nodes.`,
                    );
                    targetEpsIds.push(...shadowIds);
                    results.debug.shadowProjects.push(
                      `${locationId} -> ${shadow.id} `,
                    );
                  }
                }
              }
            }
          }
          hierarchyCache.set(locationId, targetEpsIds);
        }

        const matches = await this.measurementRepo.find({
          where: {
            boqSubItemId: sample.boqSubItemId,
            epsNodeId: In(targetEpsIds),
          },
        });

        if (matches.length === 0) continue;

        // Logic:
        // If we found shadow matches, we treat them as valid links.
        // If it's a Shadow Match, we increment shadow counter

        const currentMeasIds = currentPlans
          .map((p) => p.measurementId)
          .filter(Boolean)
          .sort();
        const expectedMeasIds = matches.map((m) => m.id).sort();

        const isAligned =
          currentMeasIds.length === expectedMeasIds.length &&
          currentMeasIds.every((id, i) => id === expectedMeasIds[i]);

        if (!isAligned) {
          await this.planRepo.remove(currentPlans);

          const newPlans = matches.map((m) =>
            this.planRepo.create({
              activityId: sample.activityId,
              projectId: sample.projectId,
              boqItemId: sample.boqItemId,
              boqSubItemId: sample.boqSubItemId,
              measurementId: m.id,
              planningBasis: sample.planningBasis,
              mappingType: MappingType.DIRECT,
              plannedQuantity: m.qty,
              createdBy: 'REPAIR_V6_SHADOW',
            }),
          );

          await this.planRepo.save(newPlans);
          results.linksSplit += newPlans.length;
          results.linksRefined++;
          results.shadowLinksFound += matches.length;
        }
      }
    } catch (err) {
      console.error('[RepairV6] Step 2 Error:', err);
      results.errors.push({ step: 2, message: err.message });
    }

    return results;
  }

  async checkHierarchy(rootId: number) {
    const results = { rootId, childrenFound: 0, hierarchy: [] as any[] };

    const getChildren = async (parentId: number, depth: number) => {
      const children = await this.epsRepo.find({ where: { parentId } });
      for (const child of children) {
        results.hierarchy.push({
          id: child.id,
          name: child.name,
          parentId,
          depth,
        });
        results.childrenFound++;
        await getChildren(child.id, depth + 1);
      }
    };

    await getChildren(rootId, 1);
    return results;
  }

  async searchEps(name: string) {
    return this.epsRepo.find({
      where: { name: Like(`% ${name}% `) },
      take: 20,
    });
  }

  async listActivities() {
    return this.activityRepo.find({
      take: 10,
    });
  }

  async findActivityByName(namePartial: string) {
    // Try exact match first
    const activity = await this.activityRepo.findOne({
      where: { activityName: namePartial },
      relations: ['wbsNode'],
    });

    if (activity) {
      const plans = await this.planRepo.find({
        where: { activityId: activity.id },
        relations: ['measurement'],
      });

      return {
        status: 'FOUND_EXACT',
        activity: {
          id: activity.id,
          projectId: activity.projectId,
          name: activity.activityName,
          plans: plans.map((p) => ({
            id: p.id,
            qty: p.plannedQuantity,
            measId: p.measurementId,
            measQty: p.measurement?.qty,
          })),
        },
      };
    }

    // Try Like search
    const matches = await this.activityRepo.find({
      where: { activityName: Like(`% ${namePartial}% `) },
      take: 10,
    });

    if (matches.length === 0) return { status: 'NOT_FOUND', name: namePartial };

    // Return first match details
    const first = matches[0];
    const plans = await this.planRepo.find({
      where: { activityId: first.id },
      relations: ['measurement'],
    });

    return {
      status: 'FOUND_MULTIPLE',
      count: matches.length,
      firstMatch: {
        id: first.id,
        projectId: first.projectId,
        name: first.activityName,
        plans: plans.map((p) => ({
          id: p.id,
          qty: p.plannedQuantity,
          measId: p.measurementId,
          measQty: p.measurement?.qty,
        })),
      },
    };
  }

  /**
   * Aggregates financial values for an activity and updates the Activity entity.
   * Also triggers a WBS rollup if context is available.
   */
  async updateActivityFinancials(activityId: number): Promise<void> {
    const activity = await this.activityRepo.findOne({
      where: { id: activityId },
      relations: ['wbsNode'],
    });
    if (!activity) return;

    // 1. Budgeted Value (Planned)
    // SUM(plannedQty * rate) from plans
    const budgetRes = await this.planRepo
      .createQueryBuilder('p')
      .leftJoin('boq_item', 'b', 'p.boq_item_id = b.id')
      .select('SUM(p.plannedQuantity * b.rate)', 'sum')
      .where('p.activity_id = :activityId', { activityId })
      .getRawOne();

    activity.budgetedValue = Number(budgetRes?.sum || 0);

    // 2. Actual Value (Executed)
    // SUM(executedQty * rate) from measurements
    const actualRes = await this.measurementRepo
      .createQueryBuilder('m')
      .leftJoin('boq_item', 'b', 'm.boqItemId = b.id')
      .select('SUM(m.executedQty * b.rate)', 'sum')
      .where('m.activityId = :activityId', { activityId })
      .getRawOne();

    activity.actualValue = Number(actualRes?.sum || 0);

    await this.activityRepo.save(activity);

    // NOTE: Rollup is NOT triggered here to avoid redundant heavy operations
    // during bulk updates. Caller should trigger rollup separately if needed.
  }

  /**
   * Bulk re-sync for all project activities.
   */
  async syncProjectFinancials(projectId: number): Promise<void> {
    const activities = await this.activityRepo.find({ where: { projectId } });
    for (const act of activities) {
      await this.updateActivityFinancials(act.id);
    }
    await this.cpmService.triggerWbsRollup(projectId);
  }
  /**
   * Finds all activities linked to a specific BOQ item and updates their financials.
   */
  async updateActivitiesByBoqItem(boqItemId: number): Promise<void> {
    const plans = await this.planRepo.find({
      where: { boqItemId },
      select: ['activityId'],
    });
    const activityIds = [...new Set(plans.map((p) => p.activityId))];

    for (const id of activityIds) {
      await this.updateActivityFinancials(id);
    }

    // Trigger WBS Rollup after all activities are updated
    const firstPlan = plans[0];
    if (firstPlan) {
      const act = await this.activityRepo.findOne({
        where: { id: firstPlan.activityId },
      });
      if (act) {
        await this.cpmService.triggerWbsRollup(act.projectId);
      }
    }
  }

  // --- Look Ahead Resource Plan ---
  async getLookAheadResources(
    projectId: number,
    startDate: string,
    endDate: string,
  ): Promise<any> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    console.log(
      `[LookAhead] Project: ${projectId}, Window: ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`,
    );

    // 1. Determine Source: Latest WORKING Version vs Master
    const entityManager = this.planRepo.manager;
    const ScheduleVersionRepo = entityManager.getRepository('ScheduleVersion');
    const ActivityVersionRepo = entityManager.getRepository('ActivityVersion');

    // Find latest WORKING version. Prefer isActive but take latest regardless if needed.
    const latestVersion = (await ScheduleVersionRepo.createQueryBuilder('sv')
      .where('sv.projectId = :projectId', { projectId })
      .andWhere('sv.versionType = :type', { type: 'WORKING' })
      .orderBy('sv.isActive', 'DESC') // Active first
      .addOrderBy('sv.createdOn', 'DESC') // Then Newest
      .getOne()) as any;

    let activities: any[] = [];
    let isVersioned = false;
    let sourceString = 'Master Schedule';

    if (latestVersion) {
      console.log(
        `[LookAhead] Using Version: ${latestVersion.versionCode} (ID: ${latestVersion.id})`,
      );

      // Inclusion logic:
      // 1. Scheduled to start before or during window
      // 2. AND (Not finished OR finishes during/after the window start)
      const versions = (await ActivityVersionRepo.createQueryBuilder('av')
        .innerJoinAndSelect('av.activity', 'act')
        .where('av.versionId = :vid', { vid: latestVersion.id })
        .andWhere('av.startDate <= :end', { end })
        .andWhere('(av.finishDate >= :start OR act.percentComplete < 100)', {
          start,
        })
        .getMany()) as any[];

      activities = versions.map((av: any) => ({
        id: av.activity.id,
        activityName: av.activity.activityName,
        activityCode: av.activity.activityCode,
        projectId: av.activity.projectId,
        wbsNodeId: av.activity.wbsNodeId,
        startDatePlanned: av.startDate,
        finishDatePlanned: av.finishDate,
        durationPlanned: av.duration,
        startDateActual: av.activity.startDateActual,
        finishDateActual: av.activity.finishDateActual,
        percentComplete: av.activity.percentComplete,
        wbsNode: av.activity.wbsNode,
      }));
      isVersioned = true;
      sourceString = `Version ${latestVersion.versionCode}`;
    } else {
      console.log(
        `[LookAhead] No working Version found. Using Master Schedule.`,
      );
      // Fallback to Master
      activities = await this.activityRepo
        .createQueryBuilder('activity')
        .where('activity.projectId = :projectId', { projectId })
        .andWhere('activity.startDatePlanned <= :end', { end })
        .andWhere(
          '(activity.finishDatePlanned >= :start OR activity.percentComplete < 100)',
          { start },
        )
        .getMany();
    }

    if (activities.length === 0) {
      return {
        aggregated: [],
        boqBreakdown: [],
        cpmActivities: [],
        activitiesCount: 0,
        measurementsCount: 0,
        source: sourceString,
      };
    }

    const activityIds = activities.map((a) => a.id);
    console.log(
      `[LookAhead] Found ${activities.length} overlapping activities.`,
    );

    // 2. Fetch Measurements via TWO paths:
    const directMeasurements = await this.measurementRepo.find({
      where: { activityId: In(activityIds) },
      relations: [
        'analysisTemplate',
        'analysisTemplate.coefficients',
        'analysisTemplate.coefficients.resource',
        'boqItem',
        'boqItem.analysisTemplate',
        'boqItem.analysisTemplate.coefficients',
        'boqItem.analysisTemplate.coefficients.resource',
        'epsNode',
      ],
    });

    const plans = await this.planRepo.find({
      where: { activityId: In(activityIds) },
      relations: [
        'boqItem',
        'boqItem.analysisTemplate',
        'boqItem.analysisTemplate.coefficients',
        'boqItem.analysisTemplate.coefficients.resource',
        'measurement',
        'measurement.analysisTemplate',
        'measurement.analysisTemplate.coefficients',
        'measurement.analysisTemplate.coefficients.resource',
        'measurement.boqItem',
        'measurement.epsNode',
      ],
    });

    // Collect map of measurements to avoid duplicates
    // Key: MeasurementId
    const measurementMap = new Map<number, any>();
    const planMeasurementMap = new Map<number, number[]>(); // MeasId -> ActivityIds linked via Plan

    // Process Direct
    for (const m of directMeasurements) {
      measurementMap.set(m.id, m);
    }

    // Process via Plan
    for (const p of plans) {
      if (p.measurement) {
        const m = p.measurement;
        if (!measurementMap.has(m.id)) {
          measurementMap.set(m.id, m);
        }
        if (!planMeasurementMap.has(m.id)) {
          planMeasurementMap.set(m.id, []);
        }
        const existing = planMeasurementMap.get(m.id)!;
        if (!existing.includes(p.activityId)) {
          existing.push(p.activityId);
        }
      }
    }

    console.log(
      `[LookAhead] Found ${directMeasurements.length} direct measurements and ${plans.length} plans.`,
    );

    // 3. Calculate Resources & Activity List
    const cpmActivities: any[] = [];

    // 3. Aggregate Resources
    const boqMap = new Map<number, any>();
    const resourceMap = new Map<string, any>();

    for (const activity of activities) {
      if (!activity.startDatePlanned || !activity.finishDatePlanned) continue;

      const actStart = new Date(activity.startDatePlanned);
      const actFinish = new Date(activity.finishDatePlanned);
      const percentDone = (activity.percentComplete || 0) / 100;

      if (percentDone >= 1) continue;

      // Calculate Period Overlap Ratio (safeRatio)
      const totalDiff = actFinish.getTime() - actStart.getTime();
      const totalDays = Math.max(
        1,
        Math.ceil(totalDiff / (1000 * 3600 * 24)) + 1,
      );
      const daysDone = percentDone * totalDays;
      const remainingStart = new Date(
        actStart.getTime() + daysDone * 24 * 60 * 60 * 1000,
      );

      let safeRatio = 0;
      let overlapDays = 0;

      if (actFinish < start) {
        safeRatio = 1 - percentDone;
        overlapDays = totalDays * safeRatio;
      } else if (remainingStart > end) {
        safeRatio = 0;
      } else {
        const oStart = remainingStart > start ? remainingStart : start;
        const oEnd = actFinish < end ? actFinish : end;
        const oDiff = oEnd.getTime() - oStart.getTime();
        overlapDays = Math.max(0, Math.ceil(oDiff / (1000 * 3600 * 24)) + 1);
        safeRatio = overlapDays / totalDays;
      }

      if (safeRatio <= 0) continue;

      cpmActivities.push({
        id: activity.id,
        name: activity.activityName,
        code: activity.activityCode,
        start: activity.startDatePlanned,
        finish: activity.finishDatePlanned,
        overlapDays: Math.round(overlapDays),
        totalDays,
        ratio: safeRatio.toFixed(2),
        actualStart: activity.startDateActual,
        actualFinish: activity.finishDateActual,
      });

      // Collect unique items for this activity
      // Path A: MeasurementElements linked to Activity
      const actDirectMeasures = directMeasurements.filter(
        (m) => m.activityId === activity.id,
      );
      for (const m of actDirectMeasures) {
        const template = m.analysisTemplate || m.boqItem?.analysisTemplate;
        if (template) {
          this.calculateResourceImpact(
            template,
            m.qty || 0,
            safeRatio,
            m.boqItem,
            boqMap,
            resourceMap,
          );
        }
      }

      // Path B: BoqActivityPlans linked to Activity
      const actPlans = plans.filter((p) => p.activityId === activity.id);
      for (const p of actPlans) {
        const template =
          p.measurement?.analysisTemplate || p.boqItem?.analysisTemplate;
        const baseQty = p.plannedQuantity || 0;
        const boqItem = p.boqItem || p.measurement?.boqItem;

        if (template && boqItem) {
          this.calculateResourceImpact(
            template,
            baseQty,
            safeRatio,
            boqItem,
            boqMap,
            resourceMap,
          );
        }
      }
    }

    // Format Result
    const aggregated = Array.from(resourceMap.values());

    const boqBreakdown = Array.from(boqMap.values()).map((b: any) => ({
      ...b,
      resources: Array.from(b.resources.values()),
    }));

    // Sort by Amount Desc
    aggregated.sort((a, b) => b.totalAmount - a.totalAmount);
    boqBreakdown.sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      aggregated,
      boqBreakdown,
      cpmActivities,
      activitiesCount: activities.length,
      measurementsCount: directMeasurements.length + plans.length,
      source: sourceString,
    };
  }

  private calculateResourceImpact(
    template: any,
    baseQty: number,
    safeRatio: number,
    boqItem: any,
    boqMap: Map<number, any>,
    resourceMap: Map<string, any>,
  ) {
    if (!template || !template.coefficients || !boqItem) return;

    const windowQty = baseQty * safeRatio;

    if (!boqMap.has(boqItem.id)) {
      boqMap.set(boqItem.id, {
        id: boqItem.id,
        boqCode: boqItem.boqCode,
        description: boqItem.description,
        totalAmount: 0,
        resources: new Map<string, any>(),
      });
    }
    const boqEntry = boqMap.get(boqItem.id);

    for (const coeff of template.coefficients) {
      const resource = coeff.resource;
      if (!resource) continue;

      const resQty = windowQty * (coeff.coefficient || 0);
      const amount = resQty * (resource.standardRate || 0);

      const resKey = `RES_${resource.id}`;
      if (!resourceMap.has(resKey)) {
        resourceMap.set(resKey, {
          id: resource.id,
          name: resource.resourceName,
          type: resource.resourceType,
          uom: resource.uom,
          totalQty: 0,
          totalAmount: 0,
        });
      }
      const gRes = resourceMap.get(resKey);
      gRes.totalQty += resQty;
      gRes.totalAmount += amount;

      if (!boqEntry.resources.has(resKey)) {
        boqEntry.resources.set(resKey, {
          resourceName: resource.resourceName,
          uom: resource.uom,
          rate: resource.standardRate || 0,
          totalQty: 0,
          totalAmount: 0,
        });
      }
      const bRes = boqEntry.resources.get(resKey);
      bRes.totalQty += resQty;
      bRes.totalAmount += amount;

      boqEntry.totalAmount += amount;
    }
  }
}
