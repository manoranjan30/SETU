import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like, IsNull, Brackets } from 'typeorm';
import * as XLSX from 'xlsx';
import {
  BoqActivityPlan,
  PlanningBasis,
  MappingType,
} from './entities/boq-activity-plan.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { BoqSubItem } from '../boq/entities/boq-sub-item.entity';
import { MeasurementElement } from '../boq/entities/measurement-element.entity';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { Activity, ActivityStatus } from '../wbs/entities/activity.entity';
import { ActivityRelationship } from '../wbs/entities/activity-relationship.entity';
import { WorkOrderItem } from '../workdoc/entities/work-order-item.entity';
import { WoActivityPlan } from './entities/wo-activity-plan.entity';
import { RecoveryPlan } from './entities/recovery-plan.entity';
import {
  QuantityProgressRecord,
  ProgressStatus,
} from './entities/quantity-progress-record.entity';
import { WbsNode } from '../wbs/entities/wbs.entity';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { CpmService } from '../wbs/cpm.service';
import { AuditService } from '../audit/audit.service';
import { PushNotificationService } from '../notifications/push-notification.service';
import { NotificationComposerService } from '../notifications/notification-composer.service';
import { CustomerMilestoneService } from '../milestone/customer-milestone.service';
import { ExecutionProgressEntry, ExecutionProgressEntryStatus } from '../execution/entities/execution-progress-entry.entity';
import { WorkOrderItemNodeType } from '../workdoc/entities/work-order-item.entity';

type DistributionImportColumnMapping = Record<string, string>;

type DistributionImportStatus =
  | 'READY'
  | 'PARTIAL'
  | 'SKIP_EXISTING'
  | 'IGNORED'
  | 'ERROR';

interface DistributionImportFieldDefinition {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

interface DistributionImportPreviewRow {
  __rowIndex: number;
  __rowNumber: number;
  activitycode?: string;
  activityname?: string;
  wbspath?: string;
  availablefloorcodes?: string;
  availablefloornames?: string;
  linkedfloorcodes?: string;
  linkedfloornames?: string;
  notes?: string;
  requestedfloormarks?: string;
  targetfloorcode?: string;
  targetfloorname?: string;
  targetepspath?: string;
  linked?: string;
  resolvednewfloorcodes?: string;
  resolvednewfloornames?: string;
  alreadylinkedfloorcodes?: string;
  invalidfloorcodes?: string;
  importStatus?: DistributionImportStatus;
  importMessage?: string;
}

interface DistributionImportValidation {
  isValid: boolean;
  errors: string[];
}

interface DistributionImportSummary {
  totalRows: number;
  readyRows: number;
  partialRows: number;
  skippedExistingRows: number;
  ignoredRows: number;
  errorRows: number;
}

type WoMapperImportColumnMapping = Record<string, string>;

interface WoMapperImportFieldDefinition {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

interface WoMapperImportPreviewRow {
  __rowIndex: number;
  __rowNumber: number;
  activitycode?: string;
  activityname?: string;
  wbspath?: string;
  currentlinkedwocodes?: string;
  currentlinkedwonames?: string;
  notes?: string;
  requestedwomarks?: string;
  resolvednewwoids?: string;
  resolvednewwocodes?: string;
  resolvednewwonames?: string;
  alreadylinkedwocodes?: string;
  invalidwocolumns?: string;
  importStatus?: DistributionImportStatus;
  importMessage?: string;
}

interface WoMapperImportValidation {
  isValid: boolean;
  errors: string[];
}

interface WoMapperImportSummary {
  totalRows: number;
  readyRows: number;
  partialRows: number;
  skippedExistingRows: number;
  ignoredRows: number;
  errorRows: number;
}

@Injectable()
export class PlanningService {
  private readonly distributionImportFields: DistributionImportFieldDefinition[] = [
    {
      key: 'activitycode',
      label: 'Activity Code',
      required: true,
      aliases: ['activity code', 'activitycode', 'code'],
    },
    {
      key: 'activityname',
      label: 'Activity Name',
      aliases: ['activity name', 'activityname', 'name'],
    },
    {
      key: 'wbspath',
      label: 'WBS Path',
      aliases: ['wbs path', 'wbspath'],
    },
    {
      key: 'availablefloorcodes',
      label: 'Available Floor Codes',
      aliases: ['available floor codes', 'availablefloorcodes'],
    },
    {
      key: 'availablefloornames',
      label: 'Available Floor Names',
      aliases: ['available floor names', 'availablefloornames'],
    },
    {
      key: 'linkedfloorcodes',
      label: 'Linked Floor Codes',
      aliases: [
        'linked floor codes',
        'linkedfloorcodes',
        'floor codes to link',
        'floors to link',
      ],
    },
    {
      key: 'linkedfloornames',
      label: 'Linked Floor Names',
      aliases: ['linked floor names', 'linkedfloornames'],
    },
    {
      key: 'notes',
      label: 'Notes',
      aliases: ['notes', 'remarks', 'comments'],
    },
    {
      key: 'targetfloorcode',
      label: 'Target Floor Code',
      aliases: [
        'target floor code',
        'targetfloorcode',
        'target floor id',
        'targetfloorid',
        'floor code',
        'floor id',
      ],
    },
    {
      key: 'targetfloorname',
      label: 'Target Floor Name',
      aliases: ['target floor name', 'targetfloorname', 'floor name'],
    },
    {
      key: 'targetepspath',
      label: 'Target EPS Path',
      aliases: ['target eps path', 'targetepspath', 'eps path'],
    },
    {
      key: 'linked',
      label: 'Linked',
      required: true,
      aliases: ['linked', 'link', 'is linked'],
    },
  ];

  private readonly woMapperImportFields: WoMapperImportFieldDefinition[] = [
    {
      key: 'activitycode',
      label: 'Activity Code',
      required: true,
      aliases: ['activity code', 'activitycode', 'code'],
    },
    {
      key: 'activityname',
      label: 'Activity Name',
      aliases: ['activity name', 'activityname', 'name'],
    },
    {
      key: 'wbspath',
      label: 'WBS Path',
      aliases: ['wbs path', 'wbspath'],
    },
    {
      key: 'currentlinkedwocodes',
      label: 'Current Linked WO Codes',
      aliases: [
        'current linked wo codes',
        'currentlinkedwocodes',
        'linked wo codes',
      ],
    },
    {
      key: 'currentlinkedwonames',
      label: 'Current Linked WO Names',
      aliases: [
        'current linked wo names',
        'currentlinkedwonames',
        'linked wo names',
      ],
    },
    {
      key: 'notes',
      label: 'Notes',
      aliases: ['notes', 'remarks', 'comments'],
    },
  ];

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
    @InjectRepository(MeasurementProgress)
    private measurementProgressRepo: Repository<MeasurementProgress>,
    @InjectRepository(ExecutionProgressEntry)
    private executionEntryRepo: Repository<ExecutionProgressEntry>,
    @InjectRepository(WbsNode)
    private wbsRepo: Repository<WbsNode>,
    @InjectRepository(EpsNode)
    private epsRepo: Repository<EpsNode>,
    @InjectRepository(ActivityRelationship)
    private relRepo: Repository<ActivityRelationship>,
    @InjectRepository(WorkOrderItem)
    private woItemRepo: Repository<WorkOrderItem>,
    private cpmService: CpmService,
    private readonly auditService: AuditService,
    private readonly pushService: PushNotificationService,
    private readonly notificationComposer: NotificationComposerService,
    private readonly customerMilestoneService: CustomerMilestoneService,
  ) {}

  private normalizeImportHeader(value: string): string {
    return (value || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private normalizeImportCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }
    return String(value).trim();
  }

  private buildDistributionImportAutoMapping(
    headers: string[],
  ): DistributionImportColumnMapping {
    const mapping: DistributionImportColumnMapping = {};
    const normalizedHeaders = headers.map((header) => ({
      source: header,
      normalized: this.normalizeImportHeader(header),
    }));

    for (const field of this.distributionImportFields) {
      const exact = normalizedHeaders.find((header) =>
        field.aliases.includes(header.normalized),
      );
      if (exact) {
        mapping[field.key] = exact.source;
        continue;
      }

      const fuzzy = normalizedHeaders.find((header) =>
        field.aliases.some(
          (candidate) =>
            header.normalized.includes(candidate) ||
            candidate.includes(header.normalized),
        ),
      );
      if (fuzzy) {
        mapping[field.key] = fuzzy.source;
      }
    }

    return mapping;
  }

  private parseImportWorkbookRows(
    fileBuffer: Buffer,
  ): Record<string, unknown>[] {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
    });
  }

  private canonicalizeDistributionImportRows(
    rawRows: Record<string, unknown>[],
    mapping: DistributionImportColumnMapping,
  ): DistributionImportPreviewRow[] {
    return rawRows.map((row, index) => {
      const normalizedRow: DistributionImportPreviewRow = {
        __rowIndex: index,
        __rowNumber: index + 2,
      };

      for (const field of this.distributionImportFields) {
        const sourceHeader = mapping[field.key];
        if (!sourceHeader) continue;
        ((normalizedRow as unknown) as Record<string, unknown>)[field.key] =
          this.normalizeImportCell(row[sourceHeader]);
      }

      return normalizedRow;
    });
  }

  private normalizeLinkedFlag(value: string): boolean | null {
    const normalized = this.normalizeImportHeader(value);
    if (!normalized) return null;
    if (['yes', 'true', '1', 'y', 'x', 'checked', 'link'].includes(normalized))
      return true;
    if (['no', 'false', '0', 'n'].includes(normalized)) return false;
    return null;
  }

  private buildFloorColumnHeader(target: {
    code: string;
    name: string;
    path?: string;
  }): string {
    const readablePath = this.normalizeImportCell(target.path || '');
    if (readablePath) {
      return `Floor ${readablePath}`;
    }
    return `Floor ${target.name}`;
  }

  private buildFloorColumnAliases(
    target: { code: string; name: string; path?: string },
    projectId: number,
  ): string[] {
    const normalizedName = target.name.trim();
    const normalizedPath = this.normalizeImportCell(target.path || '');
    return [
      this.normalizeImportHeader(this.buildFloorColumnHeader(target)),
      this.normalizeImportHeader(`${target.code}`),
      this.normalizeImportHeader(`floor ${target.code}`),
      this.normalizeImportHeader(`${normalizedName}`),
      this.normalizeImportHeader(`floor ${normalizedName}`),
      this.normalizeImportHeader(`${normalizedName} (${target.code})`),
      this.normalizeImportHeader(`${normalizedName} [${target.code}]`),
      this.normalizeImportHeader(`${normalizedPath}`),
      this.normalizeImportHeader(`floor ${normalizedPath}`),
      this.normalizeImportHeader(`${projectId}.${target.code}`),
    ];
  }

  private summarizeDistributionImportRows(
    rows: DistributionImportPreviewRow[],
  ): DistributionImportSummary {
    return rows.reduce<DistributionImportSummary>(
      (summary, row) => {
        summary.totalRows += 1;
        if (row.importStatus === 'READY') summary.readyRows += 1;
        if (row.importStatus === 'PARTIAL') summary.partialRows += 1;
        if (row.importStatus === 'SKIP_EXISTING') {
          summary.skippedExistingRows += 1;
        }
        if (row.importStatus === 'IGNORED') summary.ignoredRows += 1;
        if (row.importStatus === 'ERROR') summary.errorRows += 1;
        return summary;
      },
      {
        totalRows: 0,
        readyRows: 0,
        partialRows: 0,
        skippedExistingRows: 0,
        ignoredRows: 0,
        errorRows: 0,
      },
    );
  }

  private buildWoMapperImportAutoMapping(
    headers: string[],
  ): WoMapperImportColumnMapping {
    const mapping: WoMapperImportColumnMapping = {};
    const normalizedHeaders = headers.map((header) => ({
      source: header,
      normalized: this.normalizeImportHeader(header),
    }));

    for (const field of this.woMapperImportFields) {
      const exact = normalizedHeaders.find((header) =>
        field.aliases.includes(header.normalized),
      );
      if (exact) {
        mapping[field.key] = exact.source;
        continue;
      }

      const fuzzy = normalizedHeaders.find((header) =>
        field.aliases.some(
          (candidate) =>
            header.normalized.includes(candidate) ||
            candidate.includes(header.normalized),
        ),
      );
      if (fuzzy) {
        mapping[field.key] = fuzzy.source;
      }
    }

    return mapping;
  }

  private canonicalizeWoMapperImportRows(
    rawRows: Record<string, unknown>[],
    mapping: WoMapperImportColumnMapping,
  ): WoMapperImportPreviewRow[] {
    return rawRows.map((row, index) => {
      const normalizedRow: WoMapperImportPreviewRow = {
        __rowIndex: index,
        __rowNumber: index + 2,
      };

      for (const field of this.woMapperImportFields) {
        const sourceHeader = mapping[field.key];
        if (!sourceHeader) continue;
        ((normalizedRow as unknown) as Record<string, unknown>)[field.key] =
          this.normalizeImportCell(row[sourceHeader]);
      }

      return normalizedRow;
    });
  }

  private summarizeWoMapperImportRows(
    rows: WoMapperImportPreviewRow[],
  ): WoMapperImportSummary {
    return rows.reduce<WoMapperImportSummary>(
      (summary, row) => {
        summary.totalRows += 1;
        if (row.importStatus === 'READY') summary.readyRows += 1;
        if (row.importStatus === 'PARTIAL') summary.partialRows += 1;
        if (row.importStatus === 'SKIP_EXISTING') {
          summary.skippedExistingRows += 1;
        }
        if (row.importStatus === 'IGNORED') summary.ignoredRows += 1;
        if (row.importStatus === 'ERROR') summary.errorRows += 1;
        return summary;
      },
      {
        totalRows: 0,
        readyRows: 0,
        partialRows: 0,
        skippedExistingRows: 0,
        ignoredRows: 0,
        errorRows: 0,
      },
    );
  }

  private buildCsvBuffer(rows: Record<string, unknown>[]): Buffer {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    return Buffer.from(`\ufeff${csv}`, 'utf8');
  }

  private buildWoMapperColumnHeader(target: {
    id: number;
    path: string;
    name: string;
  }): string {
    return `WO ${target.path || target.name || target.id}`;
  }

  private buildWoMapperColumnAliases(target: {
    id: number;
    code: string;
    name: string;
    path: string;
  }): string[] {
    const safePath = this.normalizeImportCell(target.path || '');
    const safeName = this.normalizeImportCell(target.name || '');
    return [
      this.normalizeImportHeader(this.buildWoMapperColumnHeader(target)),
      this.normalizeImportHeader(safePath),
      this.normalizeImportHeader(`wo ${safePath}`),
      this.normalizeImportHeader(safeName),
      this.normalizeImportHeader(`wo ${safeName}`),
      this.normalizeImportHeader(target.code),
      this.normalizeImportHeader(`wo ${target.code}`),
      this.normalizeImportHeader(String(target.id)),
    ].filter(Boolean);
  }

  private naturalSortTokenize(value: string): Array<string | number> {
    return this.normalizeImportCell(value)
      .split(/(\d+)/)
      .filter(Boolean)
      .map((part) => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase()));
  }

  private compareNaturalStrings(a: string, b: string): number {
    const aTokens = this.naturalSortTokenize(a);
    const bTokens = this.naturalSortTokenize(b);
    const maxLength = Math.max(aTokens.length, bTokens.length);

    for (let index = 0; index < maxLength; index += 1) {
      const left = aTokens[index];
      const right = bTokens[index];
      if (left === undefined) return -1;
      if (right === undefined) return 1;
      if (left === right) continue;

      if (typeof left === 'number' && typeof right === 'number') {
        return left - right;
      }

      return String(left).localeCompare(String(right), undefined, {
        sensitivity: 'base',
      });
    }

    return 0;
  }

  private compareWoMapperTargets(
    left: {
      vendorName: string;
      workOrderNumber: string;
      path: string;
      code: string;
      id: number;
    },
    right: {
      vendorName: string;
      workOrderNumber: string;
      path: string;
      code: string;
      id: number;
    },
  ): number {
    return (
      this.compareNaturalStrings(left.vendorName, right.vendorName) ||
      this.compareNaturalStrings(left.workOrderNumber, right.workOrderNumber) ||
      this.compareNaturalStrings(left.path, right.path) ||
      this.compareNaturalStrings(left.code, right.code) ||
      left.id - right.id
    );
  }

  private orderWoMapperTargets<T extends { id: number }>(
    targets: T[],
    targetOrder: string[],
  ): T[] {
    const orderIndex = new Map<string, number>(
      targetOrder.map((targetId, index) => [String(targetId), index]),
    );

    return [...targets].sort((left, right) => {
      const leftIndex = orderIndex.get(String(left.id)) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex =
        orderIndex.get(String(right.id)) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex || Number(left.id) - Number(right.id);
    });
  }

  private async getWoMapperTargets(projectId: number) {
    const items = await this.woItemRepo
      .createQueryBuilder('woItem')
      .leftJoinAndSelect('woItem.workOrder', 'workOrder')
      .leftJoinAndSelect('workOrder.vendor', 'vendor')
      .leftJoinAndSelect('woItem.boqItem', 'boqItem')
      .leftJoinAndSelect('woItem.boqSubItem', 'boqSubItem')
      .leftJoinAndSelect('woItem.measurementElement', 'measurementElement')
      .where('workOrder.projectId = :projectId', { projectId })
      .andWhere('workOrder.status IN (:...statuses)', {
        statuses: ['ACTIVE', 'IN_PROGRESS'],
      })
      .orderBy('vendor.name', 'ASC')
      .addOrderBy('workOrder.woNumber', 'ASC')
      .addOrderBy('woItem.id', 'ASC')
      .getMany();

    const itemMap = new Map<number, WorkOrderItem>();
    items.forEach((item) => itemMap.set(item.id, item));

    const buildLeafPath = (item: WorkOrderItem) => {
      const parts: string[] = [];
      const visited = new Set<number>();
      let current: WorkOrderItem | undefined = item;
      while (current && !visited.has(current.id)) {
        parts.unshift(current.description || `WO Item ${current.id}`);
        visited.add(current.id);
        current = current.parentWorkOrderItemId
          ? itemMap.get(current.parentWorkOrderItemId)
          : undefined;
      }
      const woNumber = item.workOrder?.woNumber || `WO-${item.workOrder?.id || ''}`;
      const vendorName = item.workOrder?.vendor?.name || 'Unknown Vendor';
      return `${vendorName} > ${woNumber} > ${parts.join(' > ')}`;
    };

    const targets = items
      .filter((item) => item.nodeType === WorkOrderItemNodeType.MEASUREMENT)
      .map((item) => ({
        id: item.id,
        code: item.materialCode || `WOI-${item.id}`,
        name: item.description || `WO Item ${item.id}`,
        path: buildLeafPath(item),
        workOrderNumber: item.workOrder?.woNumber || '',
        vendorName: item.workOrder?.vendor?.name || '',
        allocatedQty: Number(item.allocatedQty || 0),
        uom: item.uom || '',
      }))
      .sort((left, right) => this.compareWoMapperTargets(left, right));

    return {
      targets,
      targetOrder: targets.map((target) => String(target.id)),
      targetById: new Map(targets.map((target) => [String(target.id), target])),
    };
  }

  private async getProjectDistributionTargets(projectId: number) {
    const epsNodes = await this.epsRepo.find({
      order: { order: 'ASC', id: 'ASC' },
    });
    const nodeMap = new Map<number, EpsNode>();
    const childrenMap = new Map<number, EpsNode[]>();

    epsNodes.forEach((node) => {
      nodeMap.set(node.id, node);
      childrenMap.set(node.id, []);
    });

    epsNodes.forEach((node) => {
      if (node.parentId && childrenMap.has(node.parentId)) {
        childrenMap.get(node.parentId)!.push(node);
      }
    });

    const projectNode = nodeMap.get(projectId);
    if (!projectNode) {
      throw new NotFoundException('Project EPS node not found');
    }

    const descendants: EpsNode[] = [];
    const visit = (nodeId: number) => {
      const children = childrenMap.get(nodeId) || [];
      children.forEach((child) => {
        descendants.push(child);
        visit(child.id);
      });
    };
    visit(projectId);

    const floorTargets = descendants.filter(
      (node) => node.type === EpsNodeType.FLOOR,
    );
    const leafTargets =
      floorTargets.length > 0
        ? floorTargets
        : descendants.filter(
            (node) => (childrenMap.get(node.id) || []).length === 0,
          );

    const buildPath = (nodeId: number) => {
      const parts: string[] = [];
      let current = nodeMap.get(nodeId) || null;
      while (current && current.id !== projectId) {
        parts.unshift(current.name);
        current = current.parentId ? nodeMap.get(current.parentId) || null : null;
      }
      return parts.join(' > ');
    };

    const targetMeta = leafTargets.map((node) => ({
      id: node.id,
      code: String(node.id),
      name: node.name,
      path: buildPath(node.id),
    }));

    const targetByCode = new Map(
      targetMeta.map((target) => [target.code, target]),
    );
    const targetById = new Map(targetMeta.map((target) => [String(target.id), target]));
    const targetsByName = new Map<string, typeof targetMeta>();
    targetMeta.forEach((target) => {
      const key = target.name.trim().toLowerCase();
      const existing = targetsByName.get(key) || [];
      existing.push(target);
      targetsByName.set(key, existing);
    });

    return {
      targetMeta,
      targetByCode,
      targetById,
      targetsByName,
    };
  }

  private async getDistributionSourceActivities(projectId: number) {
    const [wbsNodes, activities] = await Promise.all([
      this.wbsRepo.find({ where: { projectId } }),
      this.activityRepo.find({
        where: { projectId },
        relations: ['wbsNode'],
        order: { activityCode: 'ASC' },
      }),
    ]);

    const wbsMap = new Map<number, WbsNode>();
    wbsNodes.forEach((node) => wbsMap.set(node.id, node));

    const buildWbsPath = (wbsNodeId?: number | null) => {
      if (!wbsNodeId) return '';
      const parts: string[] = [];
      let current = wbsMap.get(wbsNodeId) || null;
      while (current) {
        parts.unshift(current.wbsName);
        current = current.parentId ? wbsMap.get(current.parentId) || null : null;
      }
      return parts.join(' > ');
    };

    const activityMeta = activities.map((activity) => ({
      id: activity.id,
      activityCode: activity.activityCode,
      activityName: activity.activityName,
      wbsPath: buildWbsPath(activity.wbsNode?.id),
    }));

    const activityByCode = new Map(
      activityMeta.map((activity) => [
        activity.activityCode.trim().toLowerCase(),
        activity,
      ]),
    );

    return {
      activityMeta,
      activityByCode,
    };
  }

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

  async getProjectSchedule(projectId: number) {
    const [activities, relationships] = await Promise.all([
      this.activityRepo.find({
        where: { projectId },
        relations: ['wbsNode'],
      }),
      this.getProjectRelationships(projectId),
    ]);
    return { activities, relationships };
  }

  // --- Mapper Logic (WO-centric) ---

  async distributeWoItemToActivity(
    workOrderItemId: number,
    activityId: number,
    quantity: number,
  ) {
    const activity = await this.activityRepo.findOne({
      where: { id: activityId },
    });
    if (!activity) throw new NotFoundException('Activity not found');

    // Fetch the WO item to resolve parent IDs (Vendor, WO, BOQ)
    const woItem = await this.woItemRepo.findOne({
      where: { id: workOrderItemId },
      relations: ['workOrder', 'workOrder.vendor'],
    });

    if (!woItem) throw new NotFoundException('Work Order Item not found');
    if (woItem.nodeType !== WorkOrderItemNodeType.MEASUREMENT) {
      throw new BadRequestException(
        'Only measurement work order items can be linked to schedule activities.',
      );
    }

    const executionEpsNodeId = await this.resolveFloorExecutionNodeId(activity);
    const leafItems = await this.expandWoExecutionLeaves(woItem);
    if (!leafItems.length) {
      throw new BadRequestException(
        'Selected work order node does not have executable measurement leaves.',
      );
    }

    const leafQuantities = new Map<number, number>();
    if (quantity === -1) {
      for (const leaf of leafItems) {
        const existingLinks = await this.planRepo.find({
          where: { workOrderItemId: leaf.id },
        });
        const mappedTotal = existingLinks
          .filter((link) => link.activityId !== activityId)
          .reduce((sum, link) => sum + Number(link.plannedQuantity || 0), 0);
        const remaining = Math.max(
          0,
          Number(leaf.allocatedQty || 0) - Number(mappedTotal || 0),
        );
        leafQuantities.set(leaf.id, remaining);
      }
    } else {
      const totalBaseQty = leafItems.reduce(
        (sum, leaf) => sum + Number(leaf.allocatedQty || 0),
        0,
      );
      let distributed = 0;
      leafItems.forEach((leaf, index) => {
        const isLast = index === leafItems.length - 1;
        const proportionalQty =
          totalBaseQty > 0
            ? Number(
                (
                  (quantity * Number(leaf.allocatedQty || 0)) /
                  totalBaseQty
                ).toFixed(3),
              )
            : 0;
        const qtyForLeaf = isLast
          ? Number((quantity - distributed).toFixed(3))
          : proportionalQty;
        distributed += qtyForLeaf;
        leafQuantities.set(leaf.id, Math.max(0, qtyForLeaf));
      });
    }

    const savedPlans: WoActivityPlan[] = [];
    for (const leaf of leafItems) {
      const plannedQuantity = leafQuantities.get(leaf.id) || 0;
      if (plannedQuantity <= 0) continue;

      let existing = await this.planRepo.findOne({
        where: { activityId, workOrderItemId: leaf.id },
      });

      if (existing) {
        existing.plannedQuantity = plannedQuantity;
        existing.executionEpsNodeId = executionEpsNodeId;
        savedPlans.push(await this.planRepo.save(existing));
        continue;
      }

      const plan = this.planRepo.create({
        projectId: activity.projectId,
        activityId,
        workOrderItemId: leaf.id,
        workOrderId: leaf.workOrder?.id,
        vendorId: leaf.workOrder?.vendor?.id,
        boqItemId: leaf.boqItemId,
        boqSubItemId: leaf.boqSubItemId,
        measurementId: leaf.measurementElementId,
        executionEpsNodeId,
        plannedQuantity,
        planningBasis: PlanningBasis.INITIAL,
        mappingType: MappingType.DIRECT,
      });

      savedPlans.push(await this.planRepo.save(plan));
    }

    await this.updateActivityFinancials(activityId);
    return savedPlans;
  }

  async unlinkWoItem(workOrderItemId: number): Promise<void> {
    const woItem = await this.woItemRepo.findOne({
      where: { id: workOrderItemId },
    });
    if (!woItem) return;

    const leafItems = await this.expandWoExecutionLeaves(woItem);
    const targetIds = leafItems.length
      ? leafItems.map((item) => item.id)
      : [workOrderItemId];

    const affectedPlans = await this.planRepo.find({
      where: targetIds.map((id) => ({ workOrderItemId: id })),
      select: ['activityId'],
    });

    const activityIds = [...new Set(affectedPlans.map((p) => p.activityId))];
    if (targetIds.length > 0) {
      await this.planRepo.delete(targetIds.map((id) => ({ workOrderItemId: id })));
    }

    for (const id of activityIds) {
      await this.updateActivityFinancials(id);
    }
  }

  async exportWoMapperMatrixWorkbook(projectId: number): Promise<Buffer> {
    const [{ activityMeta }, { targets, targetOrder }, existingPlans] = await Promise.all([
      this.getDistributionSourceActivities(projectId),
      this.getWoMapperTargets(projectId),
      this.planRepo.find({
        where: { projectId },
        relations: ['activity'],
      }),
    ]);

    const activityWoMap = new Map<number, Set<string>>();
    existingPlans.forEach((plan) => {
      if (!activityWoMap.has(plan.activityId)) {
        activityWoMap.set(plan.activityId, new Set<string>());
      }
      activityWoMap.get(plan.activityId)!.add(String(plan.workOrderItemId));
    });

    const matrixRows = activityMeta.map((activity) => {
      const linkedTargetIds = activityWoMap.get(activity.id) || new Set<string>();
      const linkedTargets = this.orderWoMapperTargets(
        targets.filter((target) => linkedTargetIds.has(String(target.id))),
        targetOrder,
      );

      return {
        'Activity Code': activity.activityCode,
        'Activity Name': activity.activityName,
        'WBS Path': activity.wbsPath,
        'Current Linked WO Codes': linkedTargets.map((target) => target.code).join(', '),
        'Current Linked WO Names': linkedTargets.map((target) => target.path).join(', '),
        Notes: '',
        ...Object.fromEntries(
          targets.map((target) => [
            this.buildWoMapperColumnHeader(target),
            linkedTargetIds.has(String(target.id)) ? '1' : '',
          ]),
        ),
      };
    });

    const referenceRows = targets.map((target) => ({
      Order: (targetOrder.indexOf(String(target.id)) || 0) + 1,
      'WO Item ID': target.id,
      'WO Item Code': target.code,
      'WO Item Name': target.name,
      'WO Path': target.path,
      'Work Order': target.workOrderNumber,
      Vendor: target.vendorName,
      'Allocated Qty': target.allocatedQty,
      UOM: target.uom,
    }));

    const nameListRows = targets.map((target, index) => ({
      Order: index + 1,
      'WO Name': target.name,
      'WO Path': target.path,
      'WO Item Code': target.code,
      'WO Item ID': target.id,
      'Work Order': target.workOrderNumber,
      Vendor: target.vendorName,
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(matrixRows),
      'WO Link Matrix',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(referenceRows),
      'WO Reference',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(nameListRows),
      'WO Name List',
    );

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async previewWoMapperImport(
    projectId: number,
    fileBuffer: Buffer,
    mapping?: WoMapperImportColumnMapping,
  ) {
    const rawRows = this.parseImportWorkbookRows(fileBuffer);
    if (rawRows.length === 0) {
      throw new BadRequestException('Sheet is empty');
    }

    const headers = Object.keys(rawRows[0] || {});
    const { activityByCode } = await this.getDistributionSourceActivities(projectId);
    const { targets, targetById, targetOrder } = await this.getWoMapperTargets(projectId);
    const existingPlans = await this.planRepo.find({ where: { projectId } });

    const woHeaderLookup = new Map<string, string>();
    const targetTokenLookup = new Map<string, string>();
    targets.forEach((target) => {
      this.buildWoMapperColumnAliases(target).forEach((alias) =>
        woHeaderLookup.set(alias, String(target.id)),
      );
      [
        this.normalizeImportHeader(target.path),
        this.normalizeImportHeader(target.name),
        this.normalizeImportHeader(target.code),
        this.normalizeImportHeader(String(target.id)),
        this.normalizeImportHeader(this.buildWoMapperColumnHeader(target)),
      ]
        .filter(Boolean)
        .forEach((token) => {
          if (!targetTokenLookup.has(token)) {
            targetTokenLookup.set(token, String(target.id));
          }
        });
    });

    const hasDynamicWoHeaders = headers.some((header) =>
      woHeaderLookup.has(this.normalizeImportHeader(header)),
    );

    const effectiveMapping =
      mapping && Object.keys(mapping).length > 0
        ? mapping
        : this.buildWoMapperImportAutoMapping(headers);

    const hasReferenceColumns = Boolean(
      effectiveMapping.currentlinkedwonames || effectiveMapping.currentlinkedwocodes,
    );

    const missingRequired = this.woMapperImportFields
      .filter((field) => field.required)
      .filter((field) => !effectiveMapping[field.key])
      .map((field) => field.label);

    if (!hasDynamicWoHeaders && !hasReferenceColumns) {
      missingRequired.push('WO Matrix Columns or Current Linked WO Names/Codes');
    }

    if (missingRequired.length > 0) {
      throw new BadRequestException(
        `Missing required columns: ${Array.from(new Set(missingRequired)).join(', ')}`,
      );
    }

    const normalizedRows = this.canonicalizeWoMapperImportRows(
      rawRows,
      effectiveMapping,
    );

    const dynamicWoHeaderMap = new Map<string, string>();
    headers.forEach((header) => {
      const normalizedHeader = this.normalizeImportHeader(header);
      if (
        !Object.values(effectiveMapping).includes(header) &&
        woHeaderLookup.has(normalizedHeader)
      ) {
        dynamicWoHeaderMap.set(header, woHeaderLookup.get(normalizedHeader)!);
      }
    });

    const activityLinkedWoMap = new Map<number, Set<string>>();
    existingPlans.forEach((plan) => {
      if (!activityLinkedWoMap.has(plan.activityId)) {
        activityLinkedWoMap.set(plan.activityId, new Set<string>());
      }
      activityLinkedWoMap.get(plan.activityId)!.add(String(plan.workOrderItemId));
    });

    const validationErrors: string[] = [];
    const seenActivityCodes = new Set<string>();

    const data = normalizedRows.map((row) => {
      const normalizedActivityCode = this.normalizeImportCell(row.activitycode)
        .toLowerCase();
      const activity = activityByCode.get(normalizedActivityCode);

      if (!normalizedActivityCode) {
        const message = 'Activity Code is required.';
        validationErrors.push(`Row ${row.__rowNumber}: ${message}`);
        return {
          ...row,
          importStatus: 'ERROR' as DistributionImportStatus,
          importMessage: message,
        };
      }

      if (seenActivityCodes.has(normalizedActivityCode)) {
        const message = `Duplicate Activity Code "${row.activitycode}" found in the uploaded file.`;
        validationErrors.push(`Row ${row.__rowNumber}: ${message}`);
        return {
          ...row,
          importStatus: 'ERROR' as DistributionImportStatus,
          importMessage: message,
        };
      }
      seenActivityCodes.add(normalizedActivityCode);

      if (!activity) {
        const message = `Activity Code "${row.activitycode}" was not found in this project.`;
        validationErrors.push(`Row ${row.__rowNumber}: ${message}`);
        return {
          ...row,
          importStatus: 'ERROR' as DistributionImportStatus,
          importMessage: message,
        };
      }

      const requestedTargetIds = new Set<string>();
      const requestedMarks: string[] = [];
      const rawSourceRow = rawRows[row.__rowIndex] || {};
      dynamicWoHeaderMap.forEach((targetId, sourceHeader) => {
        const rawValue = this.normalizeImportCell(rawSourceRow[sourceHeader]);
        const linkedFlag = this.normalizeLinkedFlag(rawValue);
        if (linkedFlag) {
          requestedTargetIds.add(targetId);
          const target = targetById.get(targetId);
          requestedMarks.push(target?.path || sourceHeader);
        }
      });

      const resolveTokensFromCell = (value: string) => {
        this.normalizeImportCell(value)
          .split(',')
          .map((token) => this.normalizeImportCell(token))
          .filter(Boolean)
          .forEach((token) => {
            const matchedTargetId = targetTokenLookup.get(
              this.normalizeImportHeader(token),
            );
            if (matchedTargetId) {
              requestedTargetIds.add(matchedTargetId);
              const target = targetById.get(matchedTargetId);
              if (target) requestedMarks.push(target.path);
            }
          });
      };

      if (requestedTargetIds.size === 0) {
        resolveTokensFromCell(this.normalizeImportCell(row.currentlinkedwocodes));
        resolveTokensFromCell(this.normalizeImportCell(row.currentlinkedwonames));
      }

      const currentLinkedIds = activityLinkedWoMap.get(activity.id) || new Set<string>();
      const alreadyLinkedTargets: Array<(typeof targets)[number]> = [];
      const newTargets: Array<(typeof targets)[number]> = [];

      requestedTargetIds.forEach((targetId) => {
        const target = targetById.get(targetId);
        if (!target) return;
        if (currentLinkedIds.has(String(target.id))) {
          alreadyLinkedTargets.push(target);
        } else {
          newTargets.push(target);
        }
      });

      const orderedCurrentLinkedTargets = this.orderWoMapperTargets(
        Array.from(currentLinkedIds)
          .map((id) => targetById.get(id))
          .filter(Boolean) as Array<(typeof targets)[number]>,
        targetOrder,
      );
      const orderedAlreadyLinkedTargets = this.orderWoMapperTargets(
        alreadyLinkedTargets,
        targetOrder,
      );
      const orderedNewTargets = this.orderWoMapperTargets(newTargets, targetOrder);

      const normalizedBase: WoMapperImportPreviewRow = {
        ...row,
        activitycode: activity.activityCode,
        activityname: activity.activityName,
        wbspath: activity.wbsPath,
        currentlinkedwocodes: orderedCurrentLinkedTargets
          .map((target) => target.code)
          .join(', '),
        currentlinkedwonames: orderedCurrentLinkedTargets
          .map((target) => target.path)
          .join(', '),
        requestedwomarks: requestedMarks.join(', '),
        resolvednewwoids: orderedNewTargets
          .map((target) => String(target.id))
          .join(', '),
        resolvednewwocodes: orderedNewTargets
          .map((target) => target.code)
          .join(', '),
        resolvednewwonames: orderedNewTargets
          .map((target) => target.path)
          .join(', '),
        alreadylinkedwocodes: orderedAlreadyLinkedTargets
          .map((target) => target.code)
          .join(', '),
        invalidwocolumns: '',
      };

      if (requestedTargetIds.size === 0) {
        return {
          ...normalizedBase,
          importStatus: 'IGNORED' as DistributionImportStatus,
          importMessage:
            'No WO columns were marked with 1 and no Current Linked WO Names/Codes were provided.',
        };
      }

      if (newTargets.length === 0 && alreadyLinkedTargets.length > 0) {
        return {
          ...normalizedBase,
          importStatus: 'SKIP_EXISTING' as DistributionImportStatus,
          importMessage: 'All marked WO links already exist.',
        };
      }

      if (newTargets.length > 0 && alreadyLinkedTargets.length > 0) {
        return {
          ...normalizedBase,
          importStatus: 'PARTIAL' as DistributionImportStatus,
          importMessage: `${newTargets.length} new link(s) will be created, ${alreadyLinkedTargets.length} already exist.`,
        };
      }

      return {
        ...normalizedBase,
        importStatus: 'READY' as DistributionImportStatus,
        importMessage: `${newTargets.length} new WO link(s) will be created.`,
      };
    });

    const summary = this.summarizeWoMapperImportRows(data);
    const validation: WoMapperImportValidation = {
      isValid: summary.errorRows === 0,
      errors: validationErrors,
    };

    return {
      data,
      summary,
      validation,
      mapping: effectiveMapping,
    };
  }

  async commitWoMapperImport(
    projectId: number,
    data: WoMapperImportPreviewRow[],
  ) {
    const actionableRows = (Array.isArray(data) ? data : []).filter(
      (row) => row.importStatus === 'READY' || row.importStatus === 'PARTIAL',
    );
    const { activityByCode } = await this.getDistributionSourceActivities(projectId);
    const { targetById } = await this.getWoMapperTargets(projectId);

    let createdCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const row of actionableRows) {
      const activity = activityByCode.get(
        this.normalizeImportCell(row.activitycode).toLowerCase(),
      );
      if (!activity) {
        skippedCount += 1;
        errors.push(
          `Row ${row.__rowNumber}: Activity "${row.activitycode}" was not found during import.`,
        );
        continue;
      }

      const targetIds = this.normalizeImportCell(row.resolvednewwoids)
        .split(',')
        .map((value) => this.normalizeImportCell(value))
        .filter(Boolean);

      for (const targetId of targetIds) {
        const target = targetById.get(targetId);
        if (!target) {
          skippedCount += 1;
          errors.push(
            `Row ${row.__rowNumber}: WO target "${targetId}" is no longer available in this project.`,
          );
          continue;
        }
        try {
          await this.distributeWoItemToActivity(target.id, activity.id, -1);
          createdCount += 1;
        } catch (error) {
          skippedCount += 1;
          const message =
            error instanceof Error
              ? error.message
              : 'Unexpected import error while linking WO item.';
          errors.push(
            `Row ${row.__rowNumber}: ${activity.activityCode} -> ${target.path}: ${message}`,
          );
        }
      }
    }

    if (createdCount === 0 && errors.length > 0) {
      throw new BadRequestException({
        message: 'WO link import could not create any links.',
        details: errors.slice(0, 10),
      });
    }

    return {
      createdCount,
      skippedCount,
      processedRows: actionableRows.length,
      errorCount: errors.length,
      errors,
    };
  }

  private async expandWoExecutionLeaves(
    woItem: WorkOrderItem,
  ): Promise<WorkOrderItem[]> {
    if (woItem.nodeType === WorkOrderItemNodeType.MEASUREMENT) {
      const leaf = await this.woItemRepo.findOne({
        where: { id: woItem.id },
        relations: ['workOrder', 'workOrder.vendor'],
      });
      return leaf ? [leaf] : [];
    }

    const descendants = await this.woItemRepo.find({
      where: { parentWorkOrderItemId: woItem.id },
      relations: ['workOrder', 'workOrder.vendor'],
      order: { id: 'ASC' },
    });

    const leaves: WorkOrderItem[] = [];
    for (const child of descendants) {
      const childLeaves = await this.expandWoExecutionLeaves(child);
      leaves.push(...childLeaves);
    }
    return leaves;
  }

  private async resolveFloorExecutionNodeId(
    activity: Activity,
  ): Promise<number | null> {
    const nodes = await this.epsRepo.find({
      select: ['id', 'parentId', 'type'],
    });
    const nodeMap = new Map<number, EpsNode>(
      nodes.map((node) => [node.id, node]),
    );

    let currentId: number | null = Number(activity.projectId);
    while (currentId != null) {
      const node = nodeMap.get(currentId);
      if (!node) return Number(activity.projectId);
      const type = String(node.type || '').toUpperCase();
      if (type === EpsNodeType.FLOOR || type === 'LEVEL') {
        return node.id;
      }
      currentId = node.parentId == null ? null : Number(node.parentId);
    }

    return Number(activity.projectId);
  }

  // --- Mapper Logic (Legacy) ---

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
  ): Promise<any> {
    const woActivityPlanId = Number((data as any).woActivityPlanId || 0) || null;
    const workOrderItemId = Number((data as any).workOrderItemId || 0) || null;
    if (!woActivityPlanId && !workOrderItemId) {
      throw new BadRequestException(
        'Progress must be recorded against a mapped work order measurement.',
      );
    }

    const resolvedPlan =
      woActivityPlanId
        ? await this.planRepo.findOne({ where: { id: woActivityPlanId } })
        : workOrderItemId
          ? await this.planRepo.findOne({
              where: { workOrderItemId },
              order: { id: 'ASC' },
            })
          : null;

    if (!resolvedPlan) {
      throw new BadRequestException(
        'No mapped schedule activity was found for the supplied progress entry.',
      );
    }

    const savedRecord = await this.executionEntryRepo.save(
      this.executionEntryRepo.create({
        projectId: Number(data.projectId),
        activityId: resolvedPlan.activityId,
        woActivityPlanId: resolvedPlan.id,
        workOrderId: resolvedPlan.workOrderId,
        workOrderItemId: resolvedPlan.workOrderItemId,
        executionEpsNodeId: resolvedPlan.executionEpsNodeId,
        entryDate: data.measureDate ? new Date(data.measureDate) : new Date(),
        enteredQty: Number(data.measuredQty || 0),
        remarks: data.remarks || null,
        status: ExecutionProgressEntryStatus.APPROVED,
        createdBy: data.createdBy || 'system',
        approvedBy: data.approvedBy || data.createdBy || 'system',
        approvedAt: new Date(),
      }),
    );

    // 2. Notify project-scoped progress approvers (fire-and-forget)
    if (savedRecord.projectId) {
      const notification = await this.notificationComposer.composeProgressEntrySubmitted({
        projectId: savedRecord.projectId,
        epsNodeId: savedRecord.executionEpsNodeId,
        activityId: savedRecord.activityId,
        qty: Number(savedRecord.enteredQty || 0),
      });
      this.pushService
        .sendToProjectPermission(
          savedRecord.projectId,
          'EXECUTION.ENTRY.APPROVE',
          notification.title,
          notification.body,
          {
            recordId: String(savedRecord.id),
            ...notification.data,
          },
        )
        .catch(() => {
          /* non-fatal */
        });
    }

    // 3. Trigger Schedule Recalculation for affected activities
    if (savedRecord.activityId) {
      await this.updateActivityFinancials(savedRecord.activityId);
    }
    await this.customerMilestoneService.handleProgressRefresh(savedRecord.projectId);

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
      if (!mapping.boqSubItemId) {
        throw new BadRequestException(
          `Activity ${activityId} has BOQ mapping ${mapping.id} without a BOQ sub item. Assigned Value and Achieved Value must use sub item rate.`,
        );
      }
      const subItem = await this.subItemRepo.findOne({
        where: { id: mapping.boqSubItemId },
        select: ['id', 'rate'],
      });
      const rate = Number(subItem?.rate || 0);
      if (rate <= 0) {
        throw new BadRequestException(
          `BOQ sub item ${mapping.boqSubItemId} is not having rate.`,
        );
      }

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
      .leftJoin(WoActivityPlan, 'plan', 'plan.activity_id = activity.id')
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
      .leftJoin(WoActivityPlan, 'plan', 'plan.activity_id = activity.id')
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
          // Skip activities without a WBS node — cannot replicate path
          if (!sourceAct.wbsNode) {
            skippedCount++;
            continue;
          }

          // Walk up from sourceAct.wbsNode until we hit the root (parentId null)
          const pathStack: WbsNode[] = [];
          let current: WbsNode | null = sourceAct.wbsNode;
          while (current) {
            pathStack.unshift(current);
            if (!current.parent) break; // Reached root
            current = current.parent ?? null;
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
                      workOrderItemId: sp.workOrderItemId,
                      workOrderId: sp.workOrderId,
                      vendorId: sp.vendorId,
                      planningBasis: sp.planningBasis,
                      mappingType: MappingType.DIRECT, // Forced direct mapping
                      plannedQuantity: meas.qty, // Auto-set Planned Qty to Measurement Qty (Budget for this Loc)
                      createdBy: user?.username || 'SYSTEM_DISTRIBUTOR',
                    });
                    newPlans.push(plan);
                  }
                } else {
                  // Fallback: If no detailed measurements, distribute parent quantity evenly across target locations
                  const plan = this.planRepo.create({
                    activityId: savedActivity.id,
                    projectId: targetEpsId,
                    boqItemId: sp.boqItemId,
                    boqSubItemId: sp.boqSubItemId,
                    workOrderItemId: sp.workOrderItemId,
                    workOrderId: sp.workOrderId,
                    vendorId: sp.vendorId,
                    planningBasis: sp.planningBasis,
                    mappingType: sp.mappingType,
                    plannedQuantity:
                      Number(sp.plannedQuantity || 0) /
                      resolvedTargetIds.length,
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

      await this.auditService.log(
        user?.id || 0,
        'SCHEDULE',
        'DISTRIBUTE_ACTIVITIES',
        undefined,
        undefined, // Multi-project usually
        {
          activityCount: activityIds.length,
          targetCount: targetEpsIds.length,
          created: createdCount,
        },
      );

      return { created: createdCount, skipped: skippedCount };
    } catch (error) {
      console.error('Distribution Error:', error);
      // Surface DB constraint violations as a readable 400 instead of raw 500
      const msg: string = error?.message || '';
      if (
        msg.includes('unique constraint') ||
        msg.includes('duplicate key') ||
        msg.includes('UniqueConstraintViolationException')
      ) {
        throw new BadRequestException(
          `Duplicate activity code detected during distribution. ` +
            `Ensure source activities have unique codes before distributing. Detail: ${msg}`,
        );
      }
      throw new BadRequestException(
        `Distribution failed: ${msg || 'Unknown error'}`,
      );
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
        .leftJoin('wo_activity_plan', 'plan', 'plan.activity_id = activity.id')
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

  async undistributeActivities(
    activityIds: number[],
    targetEpsIds: number[],
    user: any,
  ) {
    try {
      if (!activityIds.length || !targetEpsIds.length) return { deleted: 0 };

      const result = await this.activityRepo
        .createQueryBuilder()
        .delete()
        .from(Activity)
        .where('masterActivityId IN (:...activityIds)', { activityIds })
        .andWhere('projectId IN (:...targetEpsIds)', { targetEpsIds })
        .execute();

      await this.auditService.log(
        user?.id || 0,
        'SCHEDULE',
        'UNDISTRIBUTE_ACTIVITIES',
        undefined,
        undefined,
        {
          activityCount: activityIds.length,
          targetCount: targetEpsIds.length,
          deleted: result.affected,
        },
      );

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

  async exportDistributionMatrixCsv(
    projectId: number,
    mode: 'linked' | 'template' = 'template',
  ): Promise<Buffer> {
    const [{ activityMeta }, { targetMeta }, matrix] = await Promise.all([
      this.getDistributionSourceActivities(projectId),
      this.getProjectDistributionTargets(projectId),
      this.getDistributionMatrix(projectId),
    ]);

    const rows: Array<Record<string, unknown>> = [];
    const availableFloorCodes = targetMeta.map((target) => target.code).join(', ');
    const availableFloorNames = targetMeta
      .map((target) => target.path || target.name)
      .join(', ');
    const floorColumnHeaders = targetMeta.map((target) =>
      this.buildFloorColumnHeader(target),
    );

    for (const activity of activityMeta) {
      const linkedTargetIds = new Set(
        (matrix[String(activity.id)] || []).map((targetId) => String(targetId)),
      );
      const linkedFloorTargets = targetMeta.filter((target) =>
        linkedTargetIds.has(String(target.id)),
      );

      if (mode === 'linked' && linkedFloorTargets.length === 0) {
        continue;
      }

      rows.push({
        'Activity Code': activity.activityCode,
        'Activity Name': activity.activityName,
        'WBS Path': activity.wbsPath,
        'Available Floor Codes': availableFloorCodes,
        'Available Floor Names': availableFloorNames,
        'Linked Floor Codes': linkedFloorTargets
          .map((target) => target.code)
          .join(', '),
        'Linked Floor Names': linkedFloorTargets
          .map((target) => target.path || target.name)
          .join(', '),
        Notes: '',
        ...Object.fromEntries(
          floorColumnHeaders.map((header, index) => {
            const target = targetMeta[index];
            return [header, linkedTargetIds.has(String(target.id)) ? '1' : ''];
          }),
        ),
      });
    }

    return this.buildCsvBuffer(rows);
  }

  async previewDistributionImport(
    projectId: number,
    fileBuffer: Buffer,
    mapping?: DistributionImportColumnMapping,
  ) {
    const rawRows = this.parseImportWorkbookRows(fileBuffer);
    if (rawRows.length === 0) {
      throw new BadRequestException('Sheet is empty');
    }

    const headers = Object.keys(rawRows[0] || {});
    const { targetByCode, targetById, targetsByName } =
      await this.getProjectDistributionTargets(projectId);
    const floorHeaderLookup = new Map<string, string>();
    for (const target of Array.from(targetByCode.values())) {
      const aliases = this.buildFloorColumnAliases(target, projectId);
      aliases.forEach((alias) => floorHeaderLookup.set(alias, target.code));
    }
    const hasDynamicFloorHeaders = headers.some((header) =>
      floorHeaderLookup.has(this.normalizeImportHeader(header)),
    );

    const effectiveMapping =
      mapping && Object.keys(mapping).length > 0
        ? mapping
        : this.buildDistributionImportAutoMapping(headers);

    const missingRequired = this.distributionImportFields
      .filter((field) => field.required)
      .filter((field) => !effectiveMapping[field.key])
      .map((field) => field.label);

    if (
      !hasDynamicFloorHeaders &&
      !effectiveMapping.linkedfloorcodes &&
      !effectiveMapping.targetfloorcode &&
      !effectiveMapping.targetfloorname
    ) {
      missingRequired.push(
        'Linked Floor Codes or Target Floor Code / Target Floor Name',
      );
    }

    if (missingRequired.length > 0) {
      throw new BadRequestException(
        `Missing required columns: ${missingRequired.join(', ')}`,
      );
    }

    const normalizedRows = this.canonicalizeDistributionImportRows(
      rawRows,
      effectiveMapping,
    );

    const [{ activityByCode }, matrix] =
      await Promise.all([
        this.getDistributionSourceActivities(projectId),
        this.getDistributionMatrix(projectId),
      ]);

    const dynamicFloorHeaderMap = new Map<string, string>();
    headers.forEach((header) => {
      const normalizedHeader = this.normalizeImportHeader(header);
      if (
        !Object.values(effectiveMapping).includes(header) &&
        floorHeaderLookup.has(normalizedHeader)
      ) {
        dynamicFloorHeaderMap.set(header, floorHeaderLookup.get(normalizedHeader)!);
      }
    });

    const seenPairs = new Set<string>();
    const validationErrors: string[] = [];

    const data = normalizedRows.map((row) => {
      const normalizedActivityCode = this.normalizeImportCell(row.activitycode)
        .toLowerCase();
      const activity = activityByCode.get(normalizedActivityCode);

      if (!activity) {
        const message = `Activity Code "${row.activitycode || ''}" was not found in this project.`;
        validationErrors.push(`Row ${row.__rowNumber}: ${message}`);
        return {
          ...row,
          importStatus: 'ERROR' as DistributionImportStatus,
          importMessage: message,
        };
      }

      const requestedCodes = new Set<string>();
      const linkedFloorCodesCell = this.normalizeImportCell(row.linkedfloorcodes);
      if (linkedFloorCodesCell) {
        linkedFloorCodesCell
          .split(/[,\n;]+/)
          .map((value) => this.normalizeImportCell(value))
          .filter(Boolean)
          .forEach((code) => requestedCodes.add(code));
      }

      if (requestedCodes.size === 0 && dynamicFloorHeaderMap.size > 0) {
        const rawSourceRow = rawRows[row.__rowIndex] || {};
        const markedFloorCodes: string[] = [];
        const markedFloorNames: string[] = [];
        dynamicFloorHeaderMap.forEach((floorCode, sourceHeader) => {
          const rawValue = this.normalizeImportCell(rawSourceRow[sourceHeader]);
          const linkedFlag = this.normalizeLinkedFlag(rawValue);
          if (linkedFlag) {
            requestedCodes.add(floorCode);
            markedFloorCodes.push(floorCode);
            const target = targetByCode.get(floorCode.toLowerCase());
            if (target) {
              markedFloorNames.push(target.path || target.name);
            }
          }
        });
        if (markedFloorNames.length > 0) {
          row.requestedfloormarks = markedFloorNames.join(', ');
        } else if (markedFloorCodes.length > 0) {
          row.requestedfloormarks = markedFloorCodes.join(', ');
        }
      }

      if (requestedCodes.size === 0) {
        const fallbackTargetCode = this.normalizeImportCell(row.targetfloorcode);
        const fallbackTargetName = this.normalizeImportCell(row.targetfloorname);
        const linkedFlag = this.normalizeLinkedFlag(row.linked || '');
        if (fallbackTargetCode || fallbackTargetName) {
          if (linkedFlag === null) {
            const message = `Linked value "${row.linked || ''}" is invalid. Use Yes/No, True/False, or 1/0.`;
            validationErrors.push(`Row ${row.__rowNumber}: ${message}`);
            return {
              ...row,
              activitycode: activity.activityCode,
              activityname: activity.activityName,
              wbspath: activity.wbsPath,
              importStatus: 'ERROR' as DistributionImportStatus,
              importMessage: message,
            };
          }
          if (linkedFlag) {
            if (fallbackTargetCode) {
              requestedCodes.add(fallbackTargetCode);
            } else if (fallbackTargetName) {
              const matchingTargets =
                targetsByName.get(fallbackTargetName.toLowerCase()) || [];
              if (matchingTargets.length === 1) {
                requestedCodes.add(matchingTargets[0].code);
              } else if (matchingTargets.length > 1) {
                const message = `Target Floor Name "${fallbackTargetName}" matched multiple floors.`;
                validationErrors.push(`Row ${row.__rowNumber}: ${message}`);
                return {
                  ...row,
                  activitycode: activity.activityCode,
                  activityname: activity.activityName,
                  wbspath: activity.wbsPath,
                  importStatus: 'ERROR' as DistributionImportStatus,
                  importMessage: message,
                };
              } else {
                requestedCodes.add(`__INVALID_NAME__:${fallbackTargetName}`);
              }
            }
          }
        }
      }

      const currentLinkedTargetIds = new Set(
        (matrix[String(activity.id)] || []).map((targetId) => String(targetId)),
      );
      const currentLinkedTargets = Array.from(currentLinkedTargetIds)
        .map((targetId) => targetById.get(targetId))
        .filter(
          (
            target,
          ): target is { id: number; code: string; name: string; path: string } =>
            Boolean(target),
        );

      const newTargets: Array<{
        id: number;
        code: string;
        name: string;
        path: string;
      }> = [];
      const alreadyLinkedTargets: Array<{
        id: number;
        code: string;
        name: string;
        path: string;
      }> = [];
      const invalidCodes: string[] = [];

      for (const requestedCode of requestedCodes) {
        if (requestedCode.startsWith('__INVALID_NAME__:')) {
          invalidCodes.push(requestedCode.replace('__INVALID_NAME__:', ''));
          continue;
        }

        const target = targetByCode.get(requestedCode);
        if (!target) {
          invalidCodes.push(requestedCode);
          continue;
        }

        const pairKey = `${activity.id}::${target.id}`;
        if (seenPairs.has(pairKey)) {
          invalidCodes.push(`${requestedCode} (duplicate in file)`);
          continue;
        }
        seenPairs.add(pairKey);

        if (currentLinkedTargetIds.has(String(target.id))) {
          alreadyLinkedTargets.push(target);
        } else {
          newTargets.push(target);
        }
      }

      const normalizedBase = {
        ...row,
        activitycode: activity.activityCode,
        activityname: activity.activityName,
        wbspath: activity.wbsPath,
        availablefloorcodes: Array.from(targetByCode.keys()).join(', '),
        availablefloornames: Array.from(targetByCode.values())
          .map((target) => target.path || target.name)
          .join(', '),
        linkedfloorcodes: Array.from(requestedCodes)
          .filter((code) => !code.startsWith('__INVALID_NAME__:'))
          .join(', '),
        linkedfloornames: Array.from(requestedCodes)
          .filter((code) => !code.startsWith('__INVALID_NAME__:'))
          .map((code) => {
            const target = targetByCode.get(code);
            return target ? target.path || target.name : code;
          })
          .join(', '),
        requestedfloormarks: row.requestedfloormarks || '',
        resolvednewfloorcodes: newTargets.map((target) => target.code).join(', '),
        resolvednewfloornames: newTargets
          .map((target) => target.path || target.name)
          .join(', '),
        alreadylinkedfloorcodes: alreadyLinkedTargets
          .map((target) => target.code)
          .join(', '),
        invalidfloorcodes: invalidCodes.join(', '),
      };

      if (requestedCodes.size === 0) {
        return {
          ...normalizedBase,
          linkedfloorcodes: currentLinkedTargets.map((target) => target.code).join(', '),
          linkedfloornames: currentLinkedTargets
            .map((target) => target.path || target.name)
            .join(', '),
          importStatus: 'IGNORED' as DistributionImportStatus,
          importMessage: 'No new floor codes provided. Edit only the Linked Floor Codes column to add links.',
        };
      }

      if (newTargets.length === 0 && invalidCodes.length === 0) {
        return {
          ...normalizedBase,
          importStatus: 'SKIP_EXISTING' as DistributionImportStatus,
          importMessage: 'All requested floors are already linked.',
        };
      }

      if (newTargets.length === 0 && invalidCodes.length > 0) {
        const message = `No valid new floors found. Invalid floor codes: ${invalidCodes.join(', ')}.`;
        validationErrors.push(`Row ${row.__rowNumber}: ${message}`);
        return {
          ...normalizedBase,
          importStatus: 'ERROR' as DistributionImportStatus,
          importMessage: message,
        };
      }

      if (invalidCodes.length > 0 || alreadyLinkedTargets.length > 0) {
        const parts: string[] = [];
        if (alreadyLinkedTargets.length > 0) {
          parts.push(
            `${alreadyLinkedTargets.length} floor(s) already linked`,
          );
        }
        if (newTargets.length > 0) {
          parts.push(`${newTargets.length} new floor(s) will be added`);
        }
        if (invalidCodes.length > 0) {
          parts.push(`Invalid floor codes: ${invalidCodes.join(', ')}`);
        }
        return {
          ...normalizedBase,
          importStatus: 'PARTIAL' as DistributionImportStatus,
          importMessage: parts.join('. ') + '.',
        };
      }

      return {
        ...normalizedBase,
        importStatus: 'READY' as DistributionImportStatus,
        importMessage: `Will add ${newTargets.length} new floor(s).`,
      };
    });

    const summary = this.summarizeDistributionImportRows(data);
    const validation: DistributionImportValidation = {
      isValid: summary.errorRows === 0,
      errors: validationErrors,
    };

    return {
      data,
      summary,
      validation,
      mapping: effectiveMapping,
    };
  }

  async commitDistributionImport(
    projectId: number,
    data: DistributionImportPreviewRow[],
    user: any,
  ) {
    const actionableRows = (Array.isArray(data) ? data : []).filter(
      (row) => row.importStatus === 'READY' || row.importStatus === 'PARTIAL',
    );

    const groupedByFloor = new Map<number, number[]>();
    const { activityByCode } = await this.getDistributionSourceActivities(projectId);

    for (const row of actionableRows) {
      const activity = activityByCode.get(
        this.normalizeImportCell(row.activitycode).toLowerCase(),
      );
      if (!activity) {
        continue;
      }

      const resolvedCodes = this.normalizeImportCell(
        row.resolvednewfloorcodes,
      )
        .split(/[,\n;]+/)
        .map((value) => this.normalizeImportCell(value))
        .filter(Boolean);

      for (const resolvedCode of resolvedCodes) {
        const targetId = Number(resolvedCode);
        if (!Number.isFinite(targetId)) continue;
        const existing = groupedByFloor.get(targetId) || [];
        existing.push(activity.id);
        groupedByFloor.set(targetId, existing);
      }
    }

    let createdLinkCount = 0;
    let skippedByServiceCount = 0;

    for (const [targetId, activityIds] of groupedByFloor.entries()) {
      const uniqueActivityIds = [...new Set(activityIds)];
      const result = await this.distributeActivitiesToEps(
        uniqueActivityIds,
        [targetId],
        user,
      );
      createdLinkCount += Number(result?.created || 0);
      skippedByServiceCount += Number(result?.skipped || 0);
    }

    return {
      processedRows: actionableRows.length,
      createdLinkCount,
      skippedByServiceCount,
      partialRows: data.filter((row) => row.importStatus === 'PARTIAL').length,
      skippedExistingRows: data.filter(
        (row) => row.importStatus === 'SKIP_EXISTING',
      ).length,
      ignoredRows: data.filter((row) => row.importStatus === 'IGNORED').length,
      errorRows: data.filter((row) => row.importStatus === 'ERROR').length,
    };
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
      .leftJoin('wo_activity_plan', 'plan', 'plan.activity_id = activity.id')
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
            .orWhere('plan.execution_eps_node_id IN (:...ids)', { ids: targetIds })
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
        'activity.projectId',
        'activity.masterActivityId',
        'activWbs.wbsName as wbs_wbsName',
        'activWbs.wbsCode as wbs_wbsCode',
        'parent.wbsName as parent_wbsName',
        'parent.wbsCode as parent_wbsCode',
        'grandparent.wbsName as grandparent_wbsName',
        'greatgrandparent.wbsName as greatgrandparent_wbsName',
        'plan.id',
        'plan.plannedQuantity',
        'plan.boqItemId',
        'plan.executionEpsNodeId',
        'boqItem.id',
        'boqItem.epsNodeId',
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

    // Fetch execution quantities from dedicated execution transaction storage.
    const approvedMeasMap = new Map<string, number>();
    const pendingMeasMap = new Map<string, number>();

    if (activityBoqPairs.length > 0) {
      const planIds = [...new Set(activityBoqPairs.map((p) => p.planId))];
      const executionRows = await this.executionEntryRepo
        .createQueryBuilder('entry')
        .where('entry.woActivityPlanId IN (:...planIds)', { planIds })
        .select('entry.woActivityPlanId', 'planId')
        .addSelect('entry.activityId', 'activityId')
        .addSelect('entry.status', 'status')
        .addSelect('COALESCE(SUM(entry.enteredQty), 0)', 'qty')
        .groupBy('entry.woActivityPlanId')
        .addGroupBy('entry.activityId')
        .addGroupBy('entry.status')
        .getRawMany();

      for (const row of executionRows) {
        const planKey = `plan - ${row.planId} `;
        const qty = Number(row.qty || 0);
        if (row.status === ExecutionProgressEntryStatus.APPROVED) {
          approvedMeasMap.set(planKey, (approvedMeasMap.get(planKey) || 0) + qty);
        } else if (row.status === ExecutionProgressEntryStatus.PENDING) {
          pendingMeasMap.set(planKey, (pendingMeasMap.get(planKey) || 0) + qty);
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

        // epsNodeId: determines which EPS node this activity belongs to for mobile filtering.
        // Priority:
        // 1. distribute-schedule copies: activity.projectId IS the target EPS node (floor/unit)
        // 2. WO-linked activities: plan.executionEpsNodeId set during WO distribution
        // 3. BOQ-linked fallback: boqItem.epsNodeId
        const activityProjectId = r.activity_projectId ?? r.activity_projectid ?? null;
        const masterActivityId = r.activity_masterActivityId ?? r.activity_masteractivityid ?? null;
        const planExecutionEpsNodeId =
          r.plan_executionEpsNodeId ?? r.plan_executionepsnodeid ??
          r.plan_execution_eps_node_id ?? null;
        const epsNodeId =
          (masterActivityId ? activityProjectId : null) ?? // distribute-schedule copies
          planExecutionEpsNodeId ??                        // WO workflow
          r.boqItem_epsNodeId ?? r.boqitem_epsnodeid ??   // BOQ fallback
          null;

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
          epsNodeId,          // EPS node the BOQ item belongs to
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

        let finalPlannedQty = parseFloat(r.plan_plannedQuantity);

        // Prevent cost items (qty=1) from showing as planned quantity if not actually planned
        if (isNaN(finalPlannedQty) || finalPlannedQty <= 0) {
          finalPlannedQty = 0;
        }

        // Lookup approved + pending qty from maps: try plan-specific first, then fallbacks
        const planKey = `plan - ${r.plan_id} `;
        const specificKey = `${activityId} -${validBoqItemId} `;
        const genericKey = `null - ${validBoqItemId} `;

        let approvedQty =
          approvedMeasMap.get(planKey) ||
          approvedMeasMap.get(specificKey) ||
          approvedMeasMap.get(genericKey) ||
          0;

        const pendingQty =
          pendingMeasMap.get(planKey) ||
          pendingMeasMap.get(specificKey) ||
          pendingMeasMap.get(genericKey) ||
          0;

        // Fallback to plan's measurement (distribution) when no site execution exists
        if (approvedQty === 0 && pendingQty === 0) {
          approvedQty = parseFloat(r.meas_executedQty) || 0;
        }

        groupedMap.get(activityId).plans.push({
          planId: r.plan_id,
          boqItemId: validBoqItemId,
          description: displayDescription,
          uom: r.boqItem_uom,
          plannedQuantity: finalPlannedQty,
          totalQty: parseFloat(r.boqItem_qty || 0),
          consumedQty: approvedQty + pendingQty, // backward compat (total submitted)
          approvedQty, // approved by manager
          pendingQty, // submitted, awaiting approval
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
        .leftJoin('wo_activity_plan', 'plan', 'plan.activity_id = activity.id')
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

    const plans = await this.planRepo.find({
      where: { activityId },
      relations: ['workOrderItem'],
      order: { id: 'ASC' },
    });

    let totalPlannedQty = 0;
    let totalExecutedQty = 0;
    let totalBudgetedValue = 0;
    let totalActualValue = 0;
    let allPlansComplete = true;

    const approvedDateWindow = await this.executionEntryRepo
      .createQueryBuilder('entry')
      .select('MIN(entry.entryDate)', 'minDate')
      .addSelect('MAX(entry.entryDate)', 'maxDate')
      .where('entry.activityId = :activityId', { activityId })
      .andWhere('entry.status = :status', {
        status: ExecutionProgressEntryStatus.APPROVED,
      })
      .getRawOne<{ minDate: string | null; maxDate: string | null }>();

    for (const plan of plans) {
      const subItemId = plan.boqSubItemId || plan.workOrderItem?.boqSubItemId;
      const rateSource = subItemId
        ? await this.subItemRepo.findOne({
            where: { id: subItemId },
            select: ['id', 'rate'],
          })
        : null;
      const rate =
        Number(plan.workOrderItem?.rate || 0) || Number(rateSource?.rate || 0);

      if (!subItemId || rate <= 0) {
        throw new BadRequestException(
          `Activity ${activityId} has BOQ sub item mappings without valid rate.`,
        );
      }

      const plannedQty = Number(plan.plannedQuantity || 0);
      totalPlannedQty += plannedQty;
      totalBudgetedValue += plannedQty * rate;

      const actualRes = await this.executionEntryRepo
        .createQueryBuilder('entry')
        .select('COALESCE(SUM(entry.enteredQty), 0)', 'sum')
        .where('entry.woActivityPlanId = :planId', { planId: plan.id })
        .andWhere('entry.status = :status', {
          status: ExecutionProgressEntryStatus.APPROVED,
        })
        .getRawOne<{ sum: string }>();

      const executedQty = Number(actualRes?.sum || 0);
      totalExecutedQty += Math.min(plannedQty, executedQty);
      totalActualValue += executedQty * rate;

      if (plannedQty > 0 && executedQty + 0.0001 < plannedQty) {
        allPlansComplete = false;
      }
    }

    const percentComplete =
      totalPlannedQty > 0 ? (totalExecutedQty / totalPlannedQty) * 100 : 0;
    activity.percentComplete = Number(
      Math.min(100, Math.max(0, percentComplete)).toFixed(2),
    );
    activity.budgetedValue = Number(totalBudgetedValue.toFixed(2));
    activity.actualValue = Number(totalActualValue.toFixed(2));

    if (activity.percentComplete > 0 || activity.actualValue > 0) {
      if (!activity.startDateActual && approvedDateWindow?.minDate) {
        activity.startDateActual = new Date(approvedDateWindow.minDate);
      }
      if (activity.status === ActivityStatus.NOT_STARTED) {
        activity.status = ActivityStatus.IN_PROGRESS;
      }
    } else {
      activity.startDateActual = null;
      activity.finishDateActual = null;
      activity.status = ActivityStatus.NOT_STARTED;
    }

    if (activity.percentComplete >= 100 && allPlansComplete) {
      activity.percentComplete = 100;
      activity.status = ActivityStatus.COMPLETED;
      if (!activity.finishDateActual && approvedDateWindow?.maxDate) {
        activity.finishDateActual = new Date(approvedDateWindow.maxDate);
      }
    } else if (activity.status === ActivityStatus.COMPLETED) {
      activity.status =
        activity.percentComplete > 0
          ? ActivityStatus.IN_PROGRESS
          : ActivityStatus.NOT_STARTED;
      activity.finishDateActual = null;
    }

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
