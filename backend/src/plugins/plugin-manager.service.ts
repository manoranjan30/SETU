import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PluginPackage } from './entities/plugin-package.entity';
import { PluginInstall } from './entities/plugin-install.entity';
import { PluginPermission } from './entities/plugin-permission.entity';
import { PluginMenu } from './entities/plugin-menu.entity';
import { PluginPage } from './entities/plugin-page.entity';
import { PluginWidget } from './entities/plugin-widget.entity';
import { PluginReport } from './entities/plugin-report.entity';
import { PluginWorkflow } from './entities/plugin-workflow.entity';
import { PluginSetting } from './entities/plugin-setting.entity';
import { PluginAuditLog } from './entities/plugin-audit-log.entity';
import { PluginManifestService } from './plugin-manifest.service';
import {
  Permission,
  PermissionAction,
  PermissionScope,
} from '../permissions/permission.entity';
import { QueryExecutorService } from '../dashboard-builder/query-executor.service';
import { User } from '../users/user.entity';

@Injectable()
export class PluginManagerService {
  constructor(
    @InjectRepository(PluginPackage)
    private readonly packageRepo: Repository<PluginPackage>,
    @InjectRepository(PluginInstall)
    private readonly installRepo: Repository<PluginInstall>,
    @InjectRepository(PluginPermission)
    private readonly pluginPermissionRepo: Repository<PluginPermission>,
    @InjectRepository(PluginMenu)
    private readonly menuRepo: Repository<PluginMenu>,
    @InjectRepository(PluginPage)
    private readonly pageRepo: Repository<PluginPage>,
    @InjectRepository(PluginWidget)
    private readonly widgetRepo: Repository<PluginWidget>,
    @InjectRepository(PluginReport)
    private readonly reportRepo: Repository<PluginReport>,
    @InjectRepository(PluginWorkflow)
    private readonly workflowRepo: Repository<PluginWorkflow>,
    @InjectRepository(PluginSetting)
    private readonly settingRepo: Repository<PluginSetting>,
    @InjectRepository(PluginAuditLog)
    private readonly auditRepo: Repository<PluginAuditLog>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly manifestService: PluginManifestService,
    private readonly queryExecutor: QueryExecutorService,
  ) {}

  async findAll() {
    return this.installRepo.find({
      relations: ['pluginPackage'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    const install = await this.installRepo.findOne({
      where: { id },
      relations: ['pluginPackage'],
    });
    if (!install) {
      throw new NotFoundException(`Plugin install #${id} not found.`);
    }

    return {
      ...install,
      permissions: await this.pluginPermissionRepo.find({
        where: { pluginInstall: { id } },
      }),
      menus: await this.menuRepo.find({
        where: { pluginInstall: { id } },
        order: { sortOrder: 'ASC', id: 'ASC' },
      }),
      pages: await this.pageRepo.find({
        where: { pluginInstall: { id } },
        order: { sortOrder: 'ASC', id: 'ASC' },
      }),
      widgets: await this.widgetRepo.find({
        where: { pluginInstall: { id } },
        order: { sortOrder: 'ASC', id: 'ASC' },
      }),
      reports: await this.reportRepo.find({
        where: { pluginInstall: { id } },
        order: { sortOrder: 'ASC', id: 'ASC' },
      }),
      workflows: await this.workflowRepo.find({
        where: { pluginInstall: { id } },
        order: { sortOrder: 'ASC', id: 'ASC' },
      }),
      settings: await this.settingRepo.find({
        where: { pluginInstall: { id } },
        order: { sortOrder: 'ASC', id: 'ASC' },
      }),
      auditLogs: await this.auditRepo.find({
        where: { pluginInstallId: id },
        order: { createdAt: 'DESC' },
      }),
    };
  }

  async installBundle(
    bundle: Record<string, any>,
    userId?: number,
    approvalSource?: string,
  ) {
    const validated = this.manifestService.validateBundle(bundle);
    const existing = await this.installRepo.findOne({
      where: { pluginKey: validated.plugin.pluginKey },
      order: { createdAt: 'DESC' },
    });
    if (existing && existing.status !== 'UNINSTALLED') {
      throw new BadRequestException(
        `Plugin '${validated.plugin.pluginKey}' is already installed. Disable and uninstall it first.`,
      );
    }

    let pluginPackage = await this.packageRepo.findOne({
      where: {
        pluginKey: validated.plugin.pluginKey,
        version: validated.plugin.version,
      },
    });

    if (!pluginPackage) {
      pluginPackage = await this.packageRepo.save(
        this.packageRepo.create({
          pluginKey: validated.plugin.pluginKey,
          name: validated.plugin.name,
          version: validated.plugin.version,
          author: validated.plugin.author ?? null,
          description: validated.plugin.description ?? null,
          appCompatibility: validated.plugin.appCompatibility,
          capabilities: validated.plugin.capabilities,
          manifestJson: validated.plugin,
          bundleJson: bundle,
          approvalSource: approvalSource ?? 'ADMIN_UPLOAD',
          checksum: validated.checksum,
        }),
      );
    }

    const installedBy = userId
      ? await this.userRepo.findOne({ where: { id: userId } })
      : null;

    const install = await this.installRepo.save(
      this.installRepo.create({
        pluginPackage,
        pluginKey: validated.plugin.pluginKey,
        version: validated.plugin.version,
        status: 'ENABLED',
        installPolicy: validated.plugin.installPolicy ?? null,
        uninstallPolicy: validated.plugin.uninstallPolicy ?? {
          mode: 'ARCHIVE',
          requiresDisableFirst: true,
        },
        settingsSchema: bundle.settingsSchema ?? null,
        settingsValues: {},
        installedBy,
        enabledAt: new Date(),
      }),
    );

    await this.seedDefinitions(install, validated);
    await this.registerPluginPermissions(validated.permissions);
    await this.audit('INSTALL', install, userId, {
      version: install.version,
      approvalSource: approvalSource ?? 'ADMIN_UPLOAD',
    });

    return this.findOne(install.id);
  }

  async enable(id: number, userId?: number) {
    const install = await this.requireInstall(id);
    if (install.status === 'UNINSTALLED') {
      throw new BadRequestException('Uninstalled plugins cannot be re-enabled.');
    }
    install.status = 'ENABLED';
    install.enabledAt = new Date();
    install.disabledAt = null;
    await this.installRepo.save(install);
    await this.audit('ENABLE', install, userId, null);
    return this.findOne(id);
  }

  async disable(id: number, userId?: number, reason?: string) {
    const install = await this.requireInstall(id);
    if (install.status === 'UNINSTALLED') {
      throw new BadRequestException('Plugin is already uninstalled.');
    }
    install.status = 'DISABLED';
    install.disabledAt = new Date();
    await this.installRepo.save(install);
    await this.audit('DISABLE', install, userId, { reason: reason ?? null });
    return this.findOne(id);
  }

  async uninstall(id: number, userId?: number, reason?: string) {
    const install = await this.requireInstall(id);
    if (install.status === 'ENABLED') {
      throw new BadRequestException(
        'Disable the plugin before uninstalling it.',
      );
    }
    if (install.status === 'UNINSTALLED') {
      return this.findOne(id);
    }

    const bundleSnapshot = await this.findOne(id);
    install.status = 'UNINSTALLED';
    install.uninstalledAt = new Date();
    install.archivedConfig = bundleSnapshot;
    await this.installRepo.save(install);
    await this.audit('UNINSTALL', install, userId, { reason: reason ?? null });
    return this.findOne(id);
  }

  async updateSettings(id: number, values: Record<string, any>, userId?: number) {
    const install = await this.requireInstall(id);
    install.settingsValues = {
      ...(install.settingsValues ?? {}),
      ...values,
    };
    await this.installRepo.save(install);
    await this.audit('UPDATE_SETTINGS', install, userId, {
      keys: Object.keys(values),
    });
    return this.findOne(id);
  }

  async runtimeManifest(projectId?: number) {
    const installs = await this.installRepo.find({
      where: { status: 'ENABLED' },
      relations: ['pluginPackage'],
      order: { createdAt: 'ASC' },
    });

    const items = await Promise.all(
      installs.map(async (install) => {
        const pages = await this.pageRepo.find({
          where: { pluginInstall: { id: install.id } },
          order: { sortOrder: 'ASC', id: 'ASC' },
        });
        const menus = await this.menuRepo.find({
          where: { pluginInstall: { id: install.id } },
          order: { sortOrder: 'ASC', id: 'ASC' },
        });
        const widgets = await this.widgetRepo.find({
          where: { pluginInstall: { id: install.id } },
          order: { sortOrder: 'ASC', id: 'ASC' },
        });
        const reports = await this.reportRepo.find({
          where: { pluginInstall: { id: install.id } },
          order: { sortOrder: 'ASC', id: 'ASC' },
        });
        const workflows = await this.workflowRepo.find({
          where: { pluginInstall: { id: install.id }, isActive: true },
          order: { sortOrder: 'ASC', id: 'ASC' },
        });
        const settings = await this.settingRepo.find({
          where: { pluginInstall: { id: install.id } },
          order: { sortOrder: 'ASC', id: 'ASC' },
        });

        return {
          id: install.id,
          pluginKey: install.pluginKey,
          version: install.version,
          status: install.status,
          plugin: install.pluginPackage.manifestJson,
          settingsSchema: install.settingsSchema,
          settingsValues: install.settingsValues ?? {},
          menus: menus.map((menu) => ({
            ...menu,
            path:
              menu.pathTemplate ??
              (menu.requiresProject && projectId
                ? `/dashboard/projects/${projectId}/plugins/${install.pluginKey}/${menu.pageKey ?? menu.menuKey}`
                : `/dashboard/plugins/${install.pluginKey}/${menu.pageKey ?? menu.menuKey}`),
          })),
          pages,
          widgets,
          reports,
          workflows,
          settings,
        };
      }),
    );

    return {
      generatedAt: new Date().toISOString(),
      installs: items,
    };
  }

  async runPageQuery(pluginKey: string, pageKey: string, payload: any) {
    const page = await this.pageRepo.findOne({
      where: {
        pageKey,
        pluginInstall: { pluginKey, status: 'ENABLED' },
      },
      relations: ['pluginInstall'],
    });
    if (!page) {
      throw new NotFoundException(`Plugin page '${pluginKey}/${pageKey}' not found.`);
    }
    const config = page.config ?? {};
    if (!config.dataSourceKey) {
      return {
        rows: config.staticRows ?? [],
        columns: config.columns ?? [],
      };
    }
    const rows = await this.queryExecutor.executeQuery(
      config.dataSourceKey,
      payload?.queryConfig ?? config.queryConfig ?? {},
    );
    return { rows, columns: config.columns ?? [] };
  }

  async runReport(pluginKey: string, reportKey: string, payload: any) {
    const report = await this.reportRepo.findOne({
      where: {
        reportKey,
        pluginInstall: { pluginKey, status: 'ENABLED' },
      },
      relations: ['pluginInstall'],
    });
    if (!report) {
      throw new NotFoundException(
        `Plugin report '${pluginKey}/${reportKey}' not found.`,
      );
    }
    const config = report.config ?? {};
    let rows = config.previewRows ?? [];
    if (report.dataSourceKey) {
      rows = await this.queryExecutor.executeQuery(
        report.dataSourceKey,
        payload?.queryConfig ?? config.queryConfig ?? {},
      );
    }
    return {
      title: report.title,
      exportTypes: report.exportTypes,
      columns: config.columns ?? [],
      rows,
      config,
    };
  }

  private async requireInstall(id: number) {
    const install = await this.installRepo.findOne({
      where: { id },
      relations: ['pluginPackage'],
    });
    if (!install) {
      throw new NotFoundException(`Plugin install #${id} not found.`);
    }
    return install;
  }

  private async audit(
    action: string,
    install: PluginInstall,
    actorUserId?: number,
    details?: Record<string, any> | null,
  ) {
    await this.auditRepo.save(
      this.auditRepo.create({
        pluginKey: install.pluginKey,
        action,
        actorUserId: actorUserId ?? null,
        pluginInstallId: install.id,
        details: details ?? null,
      }),
    );
  }

  private async seedDefinitions(install: PluginInstall, validated: any) {
    await this.pluginPermissionRepo.save(
      (validated.permissions ?? []).map((permission: any) =>
        this.pluginPermissionRepo.create({
          pluginInstall: install,
          permissionCode: permission.code,
          permissionName: permission.name,
          moduleName: permission.moduleName ?? 'PLUGIN',
          scopeLevel: permission.scopeLevel ?? 'PROJECT',
          description: permission.description ?? null,
        }),
      ),
    );

    await this.menuRepo.save(
      (validated.menus ?? []).map((menu: any, index: number) =>
        this.menuRepo.create({
          pluginInstall: install,
          menuKey: menu.menuKey,
          label: menu.label,
          location: menu.location ?? 'SIDEBAR',
          pageKey: menu.pageKey ?? null,
          pathTemplate: menu.pathTemplate ?? null,
          icon: menu.icon ?? null,
          permissionCode: menu.permissionCode ?? null,
          requiresProject: Boolean(menu.requiresProject),
          sortOrder: menu.sortOrder ?? index,
          config: menu.config ?? null,
        }),
      ),
    );

    await this.pageRepo.save(
      (validated.pages ?? []).map((page: any, index: number) =>
        this.pageRepo.create({
          pluginInstall: install,
          pageKey: page.pageKey,
          title: page.title,
          rendererType: page.rendererType,
          routePath: page.routePath ?? null,
          permissionCode: page.permissionCode ?? null,
          sortOrder: page.sortOrder ?? index,
          config: page.config ?? null,
        }),
      ),
    );

    await this.widgetRepo.save(
      (validated.widgets ?? []).map((widget: any, index: number) =>
        this.widgetRepo.create({
          pluginInstall: install,
          widgetKey: widget.widgetKey,
          title: widget.title,
          widgetType: widget.widgetType,
          permissionCode: widget.permissionCode ?? null,
          sortOrder: widget.sortOrder ?? index,
          config: widget.config ?? null,
        }),
      ),
    );

    await this.reportRepo.save(
      (validated.reports ?? []).map((report: any, index: number) =>
        this.reportRepo.create({
          pluginInstall: install,
          reportKey: report.reportKey,
          title: report.title,
          permissionCode: report.permissionCode ?? null,
          exportTypes: report.exportTypes ?? ['VIEW'],
          dataSourceKey: report.dataSourceKey ?? null,
          sortOrder: report.sortOrder ?? index,
          config: report.config ?? null,
        }),
      ),
    );

    await this.workflowRepo.save(
      (validated.workflows ?? []).map((workflow: any, index: number) =>
        this.workflowRepo.create({
          pluginInstall: install,
          workflowKey: workflow.workflowKey,
          processCode: workflow.processCode,
          moduleCode: workflow.moduleCode,
          permissionCode: workflow.permissionCode ?? null,
          isActive: workflow.isActive ?? true,
          sortOrder: workflow.sortOrder ?? index,
          config: workflow.config ?? null,
        }),
      ),
    );

    await this.settingRepo.save(
      (validated.settings ?? []).map((setting: any, index: number) =>
        this.settingRepo.create({
          pluginInstall: install,
          settingKey: setting.settingKey ?? setting.key,
          label: setting.label,
          fieldType: setting.fieldType ?? 'text',
          required: Boolean(setting.required),
          defaultValue: setting.defaultValue ?? null,
          config: setting.config ?? null,
          sortOrder: setting.sortOrder ?? index,
        }),
      ),
    );
  }

  private async registerPluginPermissions(permissions: any[]) {
    for (const permission of permissions ?? []) {
      const existing = await this.permissionRepo.findOne({
        where: { permissionCode: permission.code },
      });
      if (existing) continue;
      await this.permissionRepo.save(
        this.permissionRepo.create({
          permissionCode: permission.code,
          permissionName: permission.name,
          moduleName: permission.moduleName ?? 'PLUGIN',
          entityName: permission.entityName ?? 'PLUGIN',
          actionType:
            PermissionAction[
              (permission.actionType ?? 'SPECIAL') as keyof typeof PermissionAction
            ] ?? PermissionAction.SPECIAL,
          scopeLevel:
            PermissionScope[
              (permission.scopeLevel ?? 'PROJECT') as keyof typeof PermissionScope
            ] ?? PermissionScope.PROJECT,
          description: permission.description ?? null,
          isSystem: true,
          isActive: true,
        }),
      );
    }
  }
}
