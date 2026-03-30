import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { WbsNode, WbsStatus } from './entities/wbs.entity';
import { CreateWbsDto, UpdateWbsDto, ReorderWbsDto } from './dto/wbs.dto';
import { ProjectProfile } from '../eps/project-profile.entity';
import {
  Activity,
  ActivityStatus,
  ActivityType,
} from './entities/activity.entity';
import { CreateActivityDto, UpdateActivityDto } from './dto/activity.dto';
import { WbsTemplate, WbsTemplateNode } from './entities/wbs-template.entity';
import {
  WbsTemplateActivity,
  TemplateActivityType,
} from './entities/wbs-template-activity.entity';
import {
  CreateWbsTemplateDto,
  CreateWbsTemplateNodeDto,
} from './dto/wbs-template.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class WbsService {
  constructor(
    @InjectRepository(WbsNode)
    private wbsRepo: Repository<WbsNode>,
    @InjectRepository(ProjectProfile)
    private profileRepo: Repository<ProjectProfile>,
    @InjectRepository(Activity)
    private activityRepo: Repository<Activity>,
    @InjectRepository(WbsTemplate)
    private templateRepo: Repository<WbsTemplate>,
    @InjectRepository(WbsTemplateNode)
    private templateNodeRepo: Repository<WbsTemplateNode>,
    @InjectRepository(WbsTemplateActivity)
    private templateActivityRepo: Repository<WbsTemplateActivity>,
    private dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async create(
    projectId: number,
    dto: CreateWbsDto,
    createdBy: string,
  ): Promise<WbsNode> {
    // Sanitize
    if (dto.responsibleRoleId === ('' as any))
      dto.responsibleRoleId = undefined;
    if (dto.responsibleUserId === ('' as any))
      dto.responsibleUserId = undefined;

    // 1. Determine Parent
    let parent: WbsNode | null = null;
    if (dto.parentId) {
      parent = await this.wbsRepo.findOne({
        where: { id: dto.parentId, projectId },
      });
      if (!parent)
        throw new NotFoundException(
          'Parent WBS Node not found in this project',
        );
    }

    // 2. Determine Sequence
    const lastSibling = await this.wbsRepo
      .createQueryBuilder('wbs')
      .where('wbs.project_id = :projectId', { projectId })
      .andWhere(
        parent ? 'wbs.parent_id = :parentId' : 'wbs.parent_id IS NULL',
        { parentId: parent?.id },
      )
      .orderBy('wbs.sequence_no', 'DESC')
      .getOne();

    const sequenceNo = (lastSibling?.sequenceNo ?? 0) + 1;

    // 3. Generate WBS Code
    // If Root, fetch Project Code from Profile
    let rootCodePrefix = '';
    if (!parent) {
      const profile = await this.profileRepo.findOne({
        where: { epsNode: { id: projectId } },
      });
      rootCodePrefix = profile?.projectCode || `PROJ-${projectId}`;
    }

    const wbsCode = this.generateWbsCode(
      parent?.wbsCode,
      sequenceNo,
      rootCodePrefix,
    );

    const newNode = this.wbsRepo.create({
      ...dto,
      projectId,
      parentId: parent?.id,
      wbsLevel: (parent?.wbsLevel ?? 0) + 1,
      sequenceNo,
      wbsCode,
      createdBy,
    });

    return this.wbsRepo.save(newNode);
  }

  async findAll(projectId: number): Promise<WbsNode[]> {
    return this.wbsRepo.find({
      where: { projectId },
      order: { wbsCode: 'ASC' },
      relations: ['responsibleRole', 'responsibleUser'],
    });
  }

  async findOne(projectId: number, id: number): Promise<WbsNode> {
    const node = await this.wbsRepo.findOne({
      where: { id, projectId },
      relations: ['responsibleRole', 'responsibleUser'],
    });
    if (!node) throw new NotFoundException('WBS Node not found');
    return node;
  }

  async update(
    projectId: number,
    id: number,
    dto: UpdateWbsDto,
  ): Promise<WbsNode> {
    const node = await this.findOne(projectId, id);
    Object.assign(node, dto);
    return this.wbsRepo.save(node);
  }

  async delete(projectId: number, id: number, userId: number): Promise<void> {
    const node = await this.findOne(projectId, id);
    await this.wbsRepo.remove(node);

    await this.auditService.log(userId, 'WBS', 'DELETE_NODE', id, projectId, {
      code: node.wbsCode,
      name: node.wbsName,
    });
  }

  // --- Activity Methods ---

  async createActivity(
    projectId: number,
    wbsNodeId: number,
    dto: CreateActivityDto,
    createdBy: string,
  ): Promise<Activity> {
    const node = await this.wbsRepo.findOne({
      where: { id: wbsNodeId, projectId },
    });
    if (!node)
      throw new NotFoundException('WBS Node not found in this project');

    const activity = this.activityRepo.create({
      ...dto,
      projectId,
      wbsNode: node,
      createdBy,
      status: ActivityStatus.NOT_STARTED,
    });
    return this.activityRepo.save(activity);
  }

  async getActivities(
    projectId: number,
    wbsNodeId: number,
  ): Promise<Activity[]> {
    return this.activityRepo.find({
      where: { wbsNode: { id: wbsNodeId }, projectId },
      order: { createdOn: 'ASC' },
      relations: ['masterActivity', 'wbsNode'],
    });
  }

  async getAllActivities(projectId: number): Promise<Activity[]> {
    try {
      return await this.activityRepo.find({
        where: { projectId },
        order: { id: 'ASC' },
        relations: ['wbsNode', 'masterActivity'],
      });
    } catch (error) {
      console.error('getAllActivities Error:', error);
      return [];
    }
  }

  async updateActivity(
    activityId: number,
    dto: UpdateActivityDto,
  ): Promise<Activity> {
    await this.activityRepo.update(activityId, dto);
    return this.activityRepo.findOneByOrFail({ id: activityId });
  }

  async deleteActivity(activityId: number, userId: number): Promise<void> {
    const activity = await this.activityRepo.findOne({
      where: { id: activityId },
    });
    if (!activity) throw new NotFoundException('Activity not found');

    const projectId = activity.projectId;
    await this.activityRepo.delete(activityId);

    await this.auditService.log(
      userId,
      'WBS',
      'DELETE_ACTIVITY',
      activityId,
      projectId,
      { code: activity.activityCode, name: activity.activityName },
    );
  }

  async reorder(
    projectId: number,
    id: number,
    dto: ReorderWbsDto,
  ): Promise<WbsNode> {
    const node = await this.findOne(projectId, id);

    let parentChanged = false;
    if (dto.parentId !== undefined && dto.parentId !== node.parentId) {
      const newParent = await this.wbsRepo.findOne({
        where: { id: dto.parentId, projectId },
      });
      if (!newParent && dto.parentId !== null)
        throw new NotFoundException('New Parent not found');
      node.parentId = dto.parentId || null;
      node.wbsLevel = (newParent?.wbsLevel ?? 0) + 1;
      parentChanged = true;
    }

    node.sequenceNo = dto.newSequence;

    if (parentChanged) {
      const parent = node.parentId
        ? await this.wbsRepo.findOne({ where: { id: node.parentId } })
        : null;
      node.wbsCode = this.generateWbsCode(parent?.wbsCode, node.sequenceNo);
    }

    return this.wbsRepo.save(node);
  }

  // --- Template Methods ---

  async createTemplate(dto: CreateWbsTemplateDto): Promise<WbsTemplate> {
    const template = this.templateRepo.create(dto);
    return this.templateRepo.save(template);
  }

  async getTemplates(): Promise<WbsTemplate[]> {
    return this.templateRepo.find({ where: { isActive: true } });
  }

  // Apply Template Logic
  async applyTemplate(
    projectId: number,
    templateId: number,
    createdBy: string,
  ): Promise<void> {
    const template = await this.templateRepo.findOne({
      where: { id: templateId },
      relations: ['nodes', 'nodes.activities'],
    });
    if (!template) throw new NotFoundException('Template not found');

    // Check if project already has WBS nodes (safety check)
    const count = await this.wbsRepo.count({ where: { projectId } });
    if (count > 0)
      throw new BadRequestException(
        'Project already has WBS nodes. Cannot apply template to non-empty project.',
      );

    // Get Root Code Prefix
    const profile = await this.profileRepo.findOne({
      where: { epsNode: { id: projectId } },
    });
    const rootPrefix = profile?.projectCode || `PROJ-${projectId}`;

    // Build Tree from flat nodes
    const nodes = template.nodes;

    // Map to hold Old ID -> New WBS Node
    const idMap = new Map<number, WbsNode>();

    // 1. Sort by parentId similarly (Roots first)
    // Since we don't have level in template nodes directly, we must process hierarchically
    // A simple way is to find roots (parentId is null) and process recursively

    const roots = nodes.filter((n) => !n.parentId);

    for (const root of roots) {
      await this.replicateNode(
        root,
        null,
        projectId,
        rootPrefix,
        nodes,
        idMap,
        createdBy,
      );
    }
  }

  // --- Template Node Methods (Editor) ---

  async createTemplateNode(
    dto: CreateWbsTemplateNodeDto,
  ): Promise<WbsTemplateNode> {
    const node = this.templateNodeRepo.create(dto);
    return this.templateNodeRepo.save(node);
  }

  async getTemplateNodes(templateId: number): Promise<WbsTemplateNode[]> {
    return this.templateNodeRepo.find({
      where: { templateId },
      order: { wbsCode: 'ASC' }, // Or sequence logic if we had it
    });
  }

  async deleteTemplateNode(nodeId: number): Promise<void> {
    await this.templateNodeRepo.delete(nodeId);
  }

  async deleteTemplate(templateId: number): Promise<void> {
    const template = await this.templateRepo.findOne({
      where: { id: templateId },
    });
    if (!template) throw new NotFoundException('Template not found');

    // Nodes should cascade delete if relation is set up correctly,
    // OR we manually delete nodes.
    // Assuming CASCADE on Entity (which we didn't explicitly check but is standard).
    // Let's rely on standard delete. If FK constraints fail, we need to fix Entity.
    await this.templateRepo.delete(templateId);
  }

  // --- Save Project as Template ---

  async saveAsTemplate(
    projectId: number,
    templateName: string,
    description?: string,
  ): Promise<WbsTemplate> {
    // Check for existing template with same name
    const existing = await this.templateRepo.findOne({
      where: { templateName },
    });
    if (existing) {
      throw new ConflictException('Template with this name already exists.');
    }

    // 1. Fetch all Nodes
    const nodes = await this.wbsRepo.find({
      where: { projectId },
      order: { wbsLevel: 'ASC', sequenceNo: 'ASC' },
    });

    if (nodes.length === 0)
      throw new BadRequestException('Project has no WBS nodes to save.');

    // Use Transaction for Atomicity
    return this.dataSource.transaction(async (manager) => {
      // 2. Create Template
      const template = manager.create(WbsTemplate, {
        templateName,
        description: description || `Extracted from Project ID ${projectId}`,
        projectType: 'General',
        isActive: true,
      });
      const savedTemplate = await manager.save(template);

      // 3. Map Project Nodes to Template Nodes
      const idMap = new Map<number, WbsTemplateNode>();
      nodes.sort((a, b) => a.wbsLevel - b.wbsLevel);

      for (const node of nodes) {
        let parentTemplateNode: WbsTemplateNode | null = null;
        if (node.parentId) {
          parentTemplateNode = idMap.get(node.parentId) || null;
        }

        const parts = node.wbsCode.split('.');
        const relativeCode =
          parts.length > 1 ? parts.slice(1).join('.') : parts[0];

        const newNode = manager.create(WbsTemplateNode, {
          templateId: savedTemplate.id, // Explicit ID
          template: savedTemplate, // Relation
          parentId: parentTemplateNode?.id,
          parent: parentTemplateNode || undefined,
          wbsCode: relativeCode,
          wbsName: node.wbsName,
          isControlAccount: node.isControlAccount,
        });

        const savedNode = await manager.save(newNode);
        idMap.set(node.id, savedNode);

        // Fetch and Save Activities for this Node
        // Note: We use the existing activityRepo to find (read-only here)
        // But for writing new ones, use manager
        const activities = await this.activityRepo.find({
          where: { wbsNode: { id: node.id } },
        });
        if (activities.length > 0) {
          const templateActivities = activities.map((act) => {
            let tplType = TemplateActivityType.TASK;
            if (act.activityType === ActivityType.MILESTONE) {
              tplType = TemplateActivityType.MILESTONE_FINISH; // Default to Finish Milestone
            } else if (act.activityType === ActivityType.TASK) {
              tplType = TemplateActivityType.TASK;
            }

            return manager.create(WbsTemplateActivity, {
              templateNodeId: savedNode.id, // Explicit ID
              templateNode: savedNode, // Relation
              activityCode: act.activityCode,
              activityName: act.activityName,
              activityType: tplType,
              durationPlanned: act.durationPlanned,
              isMilestone: act.isMilestone,
            });
          });
          await manager.save(templateActivities);
        }
      }
      return savedTemplate;
    });
  }

  private async replicateNode(
    templateNode: WbsTemplateNode,
    parentNode: WbsNode | null,
    projectId: number,
    rootPrefix: string,
    allTemplateNodes: WbsTemplateNode[],
    idMap: Map<number, WbsNode>,
    createdBy: string,
  ) {
    // Calculate WBS Code logic is tricky here if we want to rely on auto-gen
    // Ideally we respect the template's relative code structure

    // However, our generateWbsCode method relies on sequence number.
    // Let's trust the template structure order.

    let wbsCode = '';
    if (parentNode) {
      wbsCode = `${parentNode.wbsCode}.${templateNode.wbsCode}`;
    } else {
      wbsCode = `${rootPrefix}.${templateNode.wbsCode}`;
    }

    const newNode = this.wbsRepo.create({
      projectId,
      parentId: parentNode?.id,
      wbsCode: wbsCode, // Overwrite with template logic? Or use auto-gen?
      // Better to use auto-gen to be consistent with our system's logic
      // But validation might fail if we drift.
      // Let's stick to our standard create logic but manually specifying parent

      wbsName: templateNode.wbsName,
      isControlAccount: templateNode.isControlAccount,
      wbsLevel: (parentNode?.wbsLevel ?? 0) + 1,
      sequenceNo: 0, // Needs calculation if we want perfect ordering
      createdBy,
      // Allow manual code override? For now, let's just use the name and generated code.
    });

    // Determine Sequence (simplified)
    // In a real bulk insert, we'd handle this better.
    // For now, let's use the sequence from the template loop index if possible,
    // but since we are recursing, just use what we have.

    // Re-using generate logic properly:
    // We actually want to KEEP the structure of the template.
    // If template has 1.1, 1.2. We want 1.1, 1.2.
    // Our generateWbsCode strictly implies sequencing.

    const siblingsCount = await this.wbsRepo.count({
      where: { projectId, parentId: parentNode ? parentNode.id : IsNull() },
    });
    newNode.sequenceNo = siblingsCount + 1;
    newNode.wbsCode = this.generateWbsCode(
      parentNode?.wbsCode,
      newNode.sequenceNo,
      rootPrefix,
    );

    const savedNode = await this.wbsRepo.save(newNode);
    idMap.set(templateNode.id, savedNode);

    // Restore Activities
    if (templateNode.activities && templateNode.activities.length > 0) {
      for (const tplAct of templateNode.activities) {
        const act = this.activityRepo.create({
          projectId,
          wbsNode: savedNode,
          activityCode: tplAct.activityCode,
          activityName: tplAct.activityName,
          activityType: tplAct.activityType as any, // Cast back to ActivityType
          durationPlanned: tplAct.durationPlanned,
          isMilestone: tplAct.isMilestone,
          status: ActivityStatus.NOT_STARTED,
          createdBy,
        });
        await this.activityRepo.save(act);
      }
    }

    // Find children
    const children = allTemplateNodes.filter(
      (n) => n.parentId === templateNode.id,
    );
    for (const child of children) {
      await this.replicateNode(
        child,
        savedNode,
        projectId,
        rootPrefix,
        allTemplateNodes,
        idMap,
        createdBy,
      );
    }
  }

  private generateWbsCode(
    parentCode: string | undefined,
    sequence: number,
    rootPrefix: string = '',
  ): string {
    if (!parentCode) {
      return rootPrefix ? `${rootPrefix}.${sequence}` : sequence.toString();
    }
    return `${parentCode}.${sequence}`;
  }

  // --- Bulk Import Logic ---

  async bulkCreate(
    projectId: number,
    data: any[],
    createdBy: string,
  ): Promise<{
    createdWbsCount: number;
    skippedExistingWbsCount: number;
    createdActivityCount: number;
    skippedActivityCount: number;
    skippedRows: Array<{ rowNumber?: number; code?: string; reason: string }>;
  }> {
    const normalizedData = (data || []).filter(
      (row) => row && row.importStatus !== 'ERROR',
    );

    const wbsRows = normalizedData.filter((d) => !d.activitycode);
    const activityRows = normalizedData.filter((d) => d.activitycode);

    wbsRows.sort((a, b) => {
      const partsA = a.wbscode.toString().split('.').length;
      const partsB = b.wbscode.toString().split('.').length;
      if (partsA !== partsB) return partsA - partsB;
      return a.wbscode.toString().localeCompare(b.wbscode.toString());
    });

    const codeMap = new Map<string, WbsNode>();
    const skippedRows: Array<{
      rowNumber?: number;
      code?: string;
      reason: string;
    }> = [];

    const existingNodes = await this.wbsRepo.find({
      where: { projectId },
      select: {
        id: true,
        wbsCode: true,
        wbsName: true,
        parentId: true,
        wbsLevel: true,
      },
    });

    for (const node of existingNodes) {
      codeMap.set(node.wbsCode, node);
    }

    let createdWbsCount = 0;
    let skippedExistingWbsCount = 0;
    let createdActivityCount = 0;
    let skippedActivityCount = 0;

    const existingActivityCodes = new Set(
      (
        await this.activityRepo.find({
          where: { projectId },
          select: { activityCode: true },
        })
      )
        .map((activity) => activity.activityCode)
        .filter(Boolean),
    );

    for (const row of wbsRows) {
      const inputCode = row.wbscode.toString().trim();
      const explicitParentCode = row.parentwbscode?.toString().trim();
      const inferredParentCode = inputCode.includes('.')
        ? inputCode.split('.').slice(0, -1).join('.')
        : '';
      const parentCodeInput = explicitParentCode || inferredParentCode;

      if (codeMap.has(inputCode)) {
        skippedExistingWbsCount += 1;
        skippedRows.push({
          rowNumber: row.__rowNumber,
          code: inputCode,
          reason: `WBS Code '${inputCode}' already exists and was skipped.`,
        });
        continue;
      }

      const parentNode = parentCodeInput ? codeMap.get(parentCodeInput) || null : null;
      const lastSibling = await this.wbsRepo
        .createQueryBuilder('wbs')
        .where('wbs.project_id = :projectId', { projectId })
        .andWhere(
          parentNode ? 'wbs.parent_id = :parentId' : 'wbs.parent_id IS NULL',
          { parentId: parentNode?.id },
        )
        .orderBy('wbs.sequence_no', 'DESC')
        .getOne();
      const sequenceNo = (lastSibling?.sequenceNo ?? 0) + 1;

      const newNode = this.wbsRepo.create({
        projectId,
        parentId: parentNode?.id,
        wbsCode: inputCode,
        wbsName: row.wbsname,
        isControlAccount:
          String(row.iscontrolaccount).toUpperCase() === 'TRUE' ||
          row.iscontrolaccount === true,
        wbsLevel:
          (parentNode?.wbsLevel ?? 0) +
          1,
        sequenceNo,
        createdBy,
      });

      const saved = await this.wbsRepo.save(newNode);
      codeMap.set(inputCode, saved);
      createdWbsCount += 1;
    }

    for (const row of activityRows) {
      const wbsCodeInput = (
        row.parentwbscode?.toString().trim() || row.wbscode?.toString().trim()
      );
      const parentWbs = codeMap.get(wbsCodeInput);

      if (!parentWbs) {
        skippedActivityCount += 1;
        skippedRows.push({
          rowNumber: row.__rowNumber,
          code: row.activitycode,
          reason: `Parent WBS '${wbsCodeInput}' was not found for activity '${row.activitycode}'.`,
        });
        continue;
      }

      const activityCode = row.activitycode.toString().trim();
      if (existingActivityCodes.has(activityCode)) {
        skippedActivityCount += 1;
        skippedRows.push({
          rowNumber: row.__rowNumber,
          code: activityCode,
          reason: `Activity Code '${activityCode}' already exists and was skipped.`,
        });
        continue;
      }

      const activity = this.activityRepo.create({
        projectId,
        wbsNode: parentWbs,
        activityCode,
        activityName: row.activityname || activityCode,
        activityType: row.type || 'TASK',
        durationPlanned: row.duration ? Number(row.duration) : 0,
        status: ActivityStatus.NOT_STARTED,
        createdBy,
      });
      await this.activityRepo.save(activity);
      existingActivityCodes.add(activityCode);
      createdActivityCount += 1;
    }

    return {
      createdWbsCount,
      skippedExistingWbsCount,
      createdActivityCount,
      skippedActivityCount,
      skippedRows,
    };
  }
}
