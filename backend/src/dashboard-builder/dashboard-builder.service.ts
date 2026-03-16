import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, Not } from 'typeorm';
import { CustomDashboard } from './entities/custom-dashboard.entity';
import { DashboardWidget } from './entities/dashboard-widget.entity';
import { DashboardAssignment } from './entities/dashboard-assignment.entity';
import { DashboardTemplate } from './entities/dashboard-template.entity';
import { Role } from '../roles/role.entity';
import { DataSourceRegistryService } from './data-source-registry.service';
import { QueryExecutorService } from './query-executor.service';
import { QueryConfig } from './data-sources/base.data-source';

@Injectable()
export class DashboardBuilderService {
  constructor(
    @InjectRepository(CustomDashboard)
    private readonly dashboardRepo: Repository<CustomDashboard>,
    @InjectRepository(DashboardWidget)
    private readonly widgetRepo: Repository<DashboardWidget>,
    @InjectRepository(DashboardAssignment)
    private readonly assignmentRepo: Repository<DashboardAssignment>,
    @InjectRepository(DashboardTemplate)
    private readonly templateRepo: Repository<DashboardTemplate>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly registry: DataSourceRegistryService,
    private readonly queryExecutor: QueryExecutorService,
  ) {}

  // ─── Dashboard CRUD ─────────────────────────────────────────────────────

  async findAll() {
    return this.dashboardRepo.find({
      relations: ['widgets', 'createdBy'],
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    const dashboard = await this.dashboardRepo.findOne({
      where: { id },
      relations: ['widgets', 'assignments', 'createdBy'],
    });
    if (!dashboard) throw new NotFoundException(`Dashboard #${id} not found`);
    return dashboard;
  }

  async create(dto: Partial<CustomDashboard>, userId: number) {
    const dashboard = this.dashboardRepo.create({
      ...dto,
      createdBy: { id: userId } as any,
    });
    return this.dashboardRepo.save(dashboard);
  }

  async update(id: number, dto: Partial<CustomDashboard>) {
    const dashboard = await this.findOne(id);
    Object.assign(dashboard, dto);
    return this.dashboardRepo.save(dashboard);
  }

  async remove(id: number) {
    const dashboard = await this.findOne(id);
    return this.dashboardRepo.remove(dashboard);
  }

  async clone(id: number, userId: number) {
    const original = await this.findOne(id);
    const cloned = this.dashboardRepo.create({
      name: `${original.name} (Copy)`,
      description: original.description,
      scope: original.scope,
      layoutConfig: original.layoutConfig,
      isActive: true,
      isDefault: false,
      isTemplate: false,
      createdBy: { id: userId } as any,
    });
    const saved = await this.dashboardRepo.save(cloned);

    // Clone widgets
    if (original.widgets?.length) {
      const widgetClones = original.widgets.map((w) =>
        this.widgetRepo.create({
          dashboard: saved,
          widgetType: w.widgetType,
          title: w.title,
          dataSourceKey: w.dataSourceKey,
          queryConfig: w.queryConfig,
          displayConfig: w.displayConfig,
          gridPosition: w.gridPosition,
          refreshIntervalSec: w.refreshIntervalSec,
          sortOrder: w.sortOrder,
        }),
      );
      await this.widgetRepo.save(widgetClones);
    }

    return this.findOne(saved.id);
  }

  // ─── Widget Operations ──────────────────────────────────────────────────

  async addWidget(dashboardId: number, dto: Partial<DashboardWidget>) {
    await this.findOne(dashboardId); // verify exists
    const widget = this.widgetRepo.create({
      ...dto,
      dashboard: { id: dashboardId } as any,
    });
    return this.widgetRepo.save(widget);
  }

  async updateWidget(widgetId: number, dto: Partial<DashboardWidget>) {
    const widget = await this.widgetRepo.findOneBy({ id: widgetId });
    if (!widget) throw new NotFoundException(`Widget #${widgetId} not found`);
    Object.assign(widget, dto);
    return this.widgetRepo.save(widget);
  }

  async removeWidget(widgetId: number) {
    const widget = await this.widgetRepo.findOneBy({ id: widgetId });
    if (!widget) throw new NotFoundException(`Widget #${widgetId} not found`);
    return this.widgetRepo.remove(widget);
  }

  // ─── Assignment Operations ──────────────────────────────────────────────

  async getAllAssignments() {
    return this.assignmentRepo.find({
      relations: ['dashboard', 'role', 'user', 'project'],
    });
  }

  async saveAssignment(dto: any) {
    if (dto.dashboardId) {
      await this.findOne(dto.dashboardId); // verify dashboard exists
    }

    if (dto.roleName && !dto.roleId) {
      const role = await this.roleRepo.findOne({
        where: { name: dto.roleName },
      });
      if (role) dto.roleId = role.id;
    }
    if (dto.roleId && !dto.roleName) {
      const role = await this.roleRepo.findOne({ where: { id: dto.roleId } });
      if (role) dto.roleName = role.name;
    }

    // Normalize assignment type payloads from frontend
    if (dto.assignmentType === 'GLOBAL') {
      dto.assignmentType = 'DEFAULT_GLOBAL';
      dto.roleId = null;
      dto.roleName = null;
      dto.userId = null;
      dto.projectId = null;
    } else if (dto.assignmentType === 'PROJECT') {
      dto.assignmentType = 'DEFAULT_PROJECT';
      dto.roleId = null;
      dto.roleName = null;
      dto.userId = null;
    } else if (dto.assignmentType === 'USER') {
      dto.roleId = null;
      dto.roleName = null;
      dto.projectId = null;
    } else {
      dto.assignmentType = 'ROLE';
      dto.userId = null;
      dto.projectId = null;
    }

    if (dto.id) {
      const assignment = await this.assignmentRepo.findOne({
        where: { id: dto.id },
      });
      if (!assignment)
        throw new NotFoundException(`Assignment #${dto.id} not found`);
      Object.assign(assignment, dto);
      return this.assignmentRepo.save(assignment);
    }

    const assignment = this.assignmentRepo.create(dto);
    return this.assignmentRepo.save(assignment);
  }

  async assignDashboard(
    dashboardId: number,
    dto: Partial<DashboardAssignment>,
  ) {
    await this.findOne(dashboardId);
    const assignment = this.assignmentRepo.create({
      ...dto,
      dashboardId,
    });
    return this.assignmentRepo.save(assignment);
  }

  async removeAssignment(assignmentId: number) {
    const assignment = await this.assignmentRepo.findOneBy({
      id: assignmentId,
    });
    if (!assignment)
      throw new NotFoundException(`Assignment #${assignmentId} not found`);
    return this.assignmentRepo.remove(assignment);
  }

  async getDefaultDashboard(
    userId: number,
    roles?: string[],
    projectId?: number,
  ) {
    let roleIds: number[] = [];
    if (roles && roles.length > 0) {
      const dbRoles = await this.roleRepo.find({ where: { name: In(roles) } });
      roleIds = dbRoles.map((r) => r.id);
    }

    // Priority: User-specific > Role-specific > Project default > Global default
    const qb = this.assignmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.dashboard', 'd')
      .leftJoinAndSelect('d.widgets', 'w')
      .where('d.isActive = true')
      .orderBy('a.priority', 'ASC');

    // Try user-specific first
    let assignment = await qb
      .clone()
      .andWhere('a.userId = :uid', { uid: userId })
      .getOne();

    if (!assignment && roleIds.length > 0) {
      // Try role-specific assignment
      assignment = await qb
        .clone()
        .andWhere('a.roleId IN (:...roleIds)', { roleIds })
        .getOne();

      if (!assignment) {
        // FALLBACK: If no assignment table entry, check the Role entity itself
        const rolesWithDashboard = await this.roleRepo.find({
          where: { id: In(roleIds), dashboardId: Not(IsNull()) },
        });
        if (rolesWithDashboard.length > 0) {
          return this.findOne(rolesWithDashboard[0].dashboardId);
        }
      }
    }

    if (!assignment && projectId) {
      // Try project default
      assignment = await qb
        .clone()
        .andWhere("a.assignmentType = 'DEFAULT_PROJECT'")
        .andWhere('a.projectId = :pid', { pid: projectId })
        .getOne();
    }

    if (!assignment) {
      // Try global default
      assignment = await qb
        .clone()
        .andWhere("a.assignmentType = 'DEFAULT_GLOBAL'")
        .getOne();
    }

    return assignment?.dashboard || null;
  }

  // ─── Template Operations ────────────────────────────────────────────────

  async getTemplates() {
    return this.templateRepo.find({ order: { name: 'ASC' } });
  }

  async applyTemplate(templateId: number, userId: number) {
    let template: any = null;

    // Check virtual memory templates (IDs under 0)
    if (templateId < 0) {
      template = this.getSystemTemplateConfig(templateId);
    } else {
      template = await this.templateRepo.findOneBy({ id: templateId });
    }

    if (!template)
      throw new NotFoundException(`Template #${templateId} not found`);

    const dashboard = this.dashboardRepo.create({
      name: `${template.name}`,
      description: template.description,
      layoutConfig: template.layoutConfig || { cols: 12, rowHeight: 80 },
      scope: template.scope || 'PROJECT',
      isActive: true,
      createdBy: { id: userId } as any,
    });
    const saved = await this.dashboardRepo.save(dashboard);

    // Create widgets from template config (only if not a fallback or if it has widgets setup)
    const widgetsConfig = template.widgetsConfig;
    if (widgetsConfig && widgetsConfig.length) {
      const widgets = widgetsConfig.map((wc) =>
        this.widgetRepo.create({
          dashboard: saved,
          widgetType: wc.widgetType,
          title: wc.title,
          dataSourceKey: wc.dataSourceKey,
          queryConfig: wc.queryConfig,
          displayConfig: wc.displayConfig,
          gridPosition: wc.gridPosition,
          refreshIntervalSec: wc.refreshIntervalSec || 0,
          sortOrder: wc.sortOrder || 0,
        }),
      );
      await this.widgetRepo.save(widgets);
    }

    return this.findOne(saved.id);
  }

  private getSystemTemplateConfig(templateId: number): any {
    const SYSTEM_TEMPLATES: Record<number, any> = {
      [-1]: {
        name: 'Construction Overview',
        description:
          'Project-wise site progress, execution value and activity status snapshot.',
        scope: 'GLOBAL' as any,
        layoutConfig: { cols: 12, rowHeight: 80 },
        widgetsConfig: [
          {
            widgetType: 'TABLE',
            title: 'Site Progress by Project',
            dataSourceKey: 'project.progress.summary',
            queryConfig: {
              limit: 100,
              orderBy: [{ field: 'siteProgressPercent', direction: 'DESC' }],
            },
            displayConfig: {},
            gridPosition: { x: 0, y: 0, w: 12, h: 5 },
            refreshIntervalSec: 0,
            sortOrder: 1,
          },
        ],
      },
      [-2]: {
        name: 'Quality Control Metrics',
        description:
          'Latest quality scores, pending observations and quality progress across projects.',
        scope: 'GLOBAL' as any,
        layoutConfig: { cols: 12, rowHeight: 80 },
        widgetsConfig: [
          {
            widgetType: 'TABLE',
            title: 'Quality Rating by Project',
            dataSourceKey: 'quality.rating.summary',
            queryConfig: {
              limit: 100,
              orderBy: [{ field: 'overallScore', direction: 'DESC' }],
            },
            displayConfig: {},
            gridPosition: { x: 0, y: 0, w: 12, h: 5 },
            refreshIntervalSec: 0,
            sortOrder: 1,
          },
        ],
      },
      [-3]: {
        name: 'Procurement Strategy & Status',
        description:
          'BOQ burn and quantity execution visibility for project-level procurement control.',
        scope: 'PROJECT' as any,
        layoutConfig: { cols: 12, rowHeight: 80 },
        widgetsConfig: [
          {
            widgetType: 'TABLE',
            title: 'BOQ Burn Status',
            dataSourceKey: 'boq.burn',
            queryConfig: {
              limit: 100,
              orderBy: [{ field: 'burnPercent', direction: 'DESC' }],
            },
            displayConfig: {},
            gridPosition: { x: 0, y: 0, w: 12, h: 5 },
            refreshIntervalSec: 0,
            sortOrder: 1,
          },
        ],
      },
      [-4]: {
        name: 'Financial Health & Budgeting',
        description:
          'Company-level budget posture and execution cash flow variance by project.',
        scope: 'GLOBAL' as any,
        layoutConfig: { cols: 12, rowHeight: 80 },
        widgetsConfig: [
          {
            widgetType: 'BAR',
            title: 'Budget vs Actual Value by Project',
            dataSourceKey: 'project.progress.summary',
            queryConfig: {
              labelField: 'projectName',
              valueFields: ['budgetedValue', 'actualValue'],
              orderBy: [{ field: 'actualValue', direction: 'DESC' }],
              limit: 20,
            },
            displayConfig: {},
            gridPosition: { x: 0, y: 0, w: 12, h: 5 },
            refreshIntervalSec: 0,
            sortOrder: 1,
          },
        ],
      },
      [-5]: {
        name: 'Company Command Center',
        description:
          'Executive dashboard across all projects covering site progress, cash flow, quality score and quality progress.',
        scope: 'GLOBAL' as any,
        layoutConfig: { cols: 12, rowHeight: 80 },
        widgetsConfig: [
          {
            widgetType: 'COUNTER',
            title: 'Total Projects',
            dataSourceKey: 'project.portfolio',
            queryConfig: { valueField: 'id', aggregation: 'COUNT' },
            displayConfig: { label: 'Projects' },
            gridPosition: { x: 0, y: 0, w: 3, h: 2 },
            refreshIntervalSec: 0,
            sortOrder: 1,
          },
          {
            widgetType: 'KPI',
            title: 'Approved Budget',
            dataSourceKey: 'project.portfolio',
            queryConfig: { valueField: 'approvedBudget', aggregation: 'SUM' },
            displayConfig: { label: 'Approved Budget' },
            gridPosition: { x: 3, y: 0, w: 3, h: 2 },
            refreshIntervalSec: 0,
            sortOrder: 2,
          },
          {
            widgetType: 'KPI',
            title: 'Overall Site Progress',
            dataSourceKey: 'project.progress.summary',
            queryConfig: {
              valueField: 'siteProgressPercent',
              aggregation: 'AVG',
            },
            displayConfig: { label: 'Avg Site Progress %' },
            gridPosition: { x: 6, y: 0, w: 3, h: 2 },
            refreshIntervalSec: 0,
            sortOrder: 3,
          },
          {
            widgetType: 'KPI',
            title: 'Overall Quality Score',
            dataSourceKey: 'quality.rating.summary',
            queryConfig: { valueField: 'overallScore', aggregation: 'AVG' },
            displayConfig: { label: 'Avg Quality Score' },
            gridPosition: { x: 9, y: 0, w: 3, h: 2 },
            refreshIntervalSec: 0,
            sortOrder: 4,
          },
          {
            widgetType: 'BAR',
            title: 'Project Cash Flow (Budget vs Actual)',
            dataSourceKey: 'project.progress.summary',
            queryConfig: {
              labelField: 'projectName',
              valueFields: ['budgetedValue', 'actualValue'],
              orderBy: [{ field: 'actualValue', direction: 'DESC' }],
              limit: 20,
            },
            displayConfig: {},
            gridPosition: { x: 0, y: 2, w: 8, h: 4 },
            refreshIntervalSec: 0,
            sortOrder: 5,
          },
          {
            widgetType: 'DONUT',
            title: 'Quality Progress by Project',
            dataSourceKey: 'quality.rating.summary',
            queryConfig: {
              labelField: 'projectName',
              valueField: 'qualityProgressPercent',
              orderBy: [{ field: 'qualityProgressPercent', direction: 'DESC' }],
              limit: 12,
            },
            displayConfig: {},
            gridPosition: { x: 8, y: 2, w: 4, h: 4 },
            refreshIntervalSec: 0,
            sortOrder: 6,
          },
          {
            widgetType: 'TABLE',
            title: 'Project Scoreboard',
            dataSourceKey: 'project.progress.summary',
            queryConfig: {
              orderBy: [{ field: 'siteProgressPercent', direction: 'DESC' }],
              limit: 50,
            },
            displayConfig: {},
            gridPosition: { x: 0, y: 6, w: 12, h: 5 },
            refreshIntervalSec: 0,
            sortOrder: 7,
          },
          {
            widgetType: 'TABLE',
            title: 'Quality Rating Board',
            dataSourceKey: 'quality.rating.summary',
            queryConfig: {
              orderBy: [{ field: 'overallScore', direction: 'DESC' }],
              limit: 50,
            },
            displayConfig: {},
            gridPosition: { x: 0, y: 11, w: 12, h: 5 },
            refreshIntervalSec: 0,
            sortOrder: 8,
          },
        ],
      },
    };

    return SYSTEM_TEMPLATES[templateId] || null;
  }

  async saveAsTemplate(
    dashboardId: number,
    dto: { name: string; category: string; description?: string },
    userId: number,
  ) {
    const dashboard = await this.findOne(dashboardId);
    const template = this.templateRepo.create({
      name: dto.name,
      category: dto.category,
      description: dto.description || dashboard.description,
      layoutConfig: dashboard.layoutConfig,
      widgetsConfig: dashboard.widgets?.map((w) => ({
        widgetType: w.widgetType,
        title: w.title,
        dataSourceKey: w.dataSourceKey,
        queryConfig: w.queryConfig,
        displayConfig: w.displayConfig,
        gridPosition: w.gridPosition,
        refreshIntervalSec: w.refreshIntervalSec,
        sortOrder: w.sortOrder,
      })),
      isSystemTemplate: false,
      createdBy: { id: userId } as any,
    });
    return this.templateRepo.save(template);
  }

  // ─── Data Source Operations ─────────────────────────────────────────────

  getDataSources() {
    return this.registry.getAllMeta();
  }

  async queryData(sourceKey: string, config: QueryConfig) {
    return this.queryExecutor.executeQuery(sourceKey, config);
  }

  async previewData(sourceKey: string, config: QueryConfig) {
    // Preview returns limited rows
    return this.queryExecutor.executeQuery(sourceKey, {
      ...config,
      limit: config.limit || 25,
    });
  }
}
