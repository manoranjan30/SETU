import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomDashboard } from './entities/custom-dashboard.entity';
import { DashboardWidget } from './entities/dashboard-widget.entity';
import { DashboardAssignment } from './entities/dashboard-assignment.entity';
import { DashboardTemplate } from './entities/dashboard-template.entity';
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
    private readonly registry: DataSourceRegistryService,
    private readonly queryExecutor: QueryExecutorService,
  ) { }

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

  async assignDashboard(dashboardId: number, dto: Partial<DashboardAssignment>) {
    await this.findOne(dashboardId);
    const assignment = this.assignmentRepo.create({
      ...dto,
      dashboard: { id: dashboardId } as any,
    });
    return this.assignmentRepo.save(assignment);
  }

  async removeAssignment(assignmentId: number) {
    const assignment = await this.assignmentRepo.findOneBy({ id: assignmentId });
    if (!assignment) throw new NotFoundException(`Assignment #${assignmentId} not found`);
    return this.assignmentRepo.remove(assignment);
  }

  async getDefaultDashboard(userId: number, roleId: number, projectId?: number) {
    // Priority: User-specific > Role-specific > Project default > Global default
    const qb = this.assignmentRepo.createQueryBuilder('a')
      .leftJoinAndSelect('a.dashboard', 'd')
      .leftJoinAndSelect('d.widgets', 'w')
      .where('d.isActive = true')
      .orderBy('a.priority', 'ASC');

    // Try user-specific first
    let assignment = await qb.clone()
      .andWhere('a.userId = :uid', { uid: userId })
      .getOne();

    if (!assignment) {
      // Try role-specific
      assignment = await qb.clone()
        .andWhere('a.roleId = :rid', { rid: roleId })
        .getOne();
    }

    if (!assignment && projectId) {
      // Try project default
      assignment = await qb.clone()
        .andWhere("a.assignmentType = 'DEFAULT_PROJECT'")
        .andWhere('a.projectId = :pid', { pid: projectId })
        .getOne();
    }

    if (!assignment) {
      // Try global default
      assignment = await qb.clone()
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
    const template = await this.templateRepo.findOneBy({ id: templateId });
    if (!template) throw new NotFoundException(`Template #${templateId} not found`);

    const dashboard = this.dashboardRepo.create({
      name: `${template.name}`,
      description: template.description,
      layoutConfig: template.layoutConfig,
      scope: 'PROJECT',
      isActive: true,
      createdBy: { id: userId } as any,
    });
    const saved = await this.dashboardRepo.save(dashboard);

    // Create widgets from template config
    const widgetsConfig = template.widgetsConfig as any[];
    if (widgetsConfig?.length) {
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

  async saveAsTemplate(dashboardId: number, dto: { name: string; category: string; description?: string }, userId: number) {
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
