import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

const ALLOWED_CAPABILITIES = new Set([
  'menus',
  'pages',
  'widgets',
  'reports',
  'workflows',
  'settings',
  'remote-ui',
]);

const ALLOWED_PAGE_RENDERERS = new Set([
  'hostFormPage',
  'hostTablePage',
  'hostDashboardWidget',
  'hostReportAction',
  'remoteUiPage',
]);

@Injectable()
export class PluginManifestService {
  private readonly appVersion = this.readAppVersion();

  validateBundle(bundle: Record<string, any>) {
    const plugin = bundle?.plugin ?? bundle?.pluginJson ?? bundle;
    if (!plugin || typeof plugin !== 'object') {
      throw new BadRequestException('Plugin bundle is missing plugin metadata.');
    }

    for (const field of [
      'pluginKey',
      'name',
      'version',
      'appCompatibility',
      'capabilities',
    ]) {
      if (!plugin[field]) {
        throw new BadRequestException(`Plugin manifest is missing '${field}'.`);
      }
    }

    if (!/^[a-z0-9-]+$/i.test(plugin.pluginKey)) {
      throw new BadRequestException(
        'pluginKey may contain only letters, numbers, and hyphens.',
      );
    }

    if (!Array.isArray(plugin.capabilities) || plugin.capabilities.length === 0) {
      throw new BadRequestException('Plugin capabilities must be a non-empty array.');
    }

    for (const capability of plugin.capabilities) {
      if (!ALLOWED_CAPABILITIES.has(capability)) {
        throw new BadRequestException(
          `Capability '${capability}' is not allowed in SETU Plugin System v1.`,
        );
      }
    }

    if (!this.isCompatible(plugin.appCompatibility)) {
      throw new BadRequestException(
        `Plugin requires app compatibility '${plugin.appCompatibility}', current app version is '${this.appVersion}'.`,
      );
    }

    const permissions = bundle.permissions ?? [];
    const pages = bundle.pages ?? [];
    const menus = bundle.menus ?? [];
    const widgets = bundle.widgets ?? [];
    const reports = bundle.reports ?? [];
    const workflows = bundle.workflows ?? [];
    const settings = bundle.settings ?? bundle.settingsSchema ?? [];

    for (const permission of permissions) {
      const code = permission?.code;
      if (!code || !code.startsWith(`PLUGIN.${plugin.pluginKey.toUpperCase()}.`)) {
        throw new BadRequestException(
          `Plugin permission '${code ?? 'unknown'}' must start with PLUGIN.${plugin.pluginKey.toUpperCase()}.`,
        );
      }
    }

    for (const page of pages) {
      if (!ALLOWED_PAGE_RENDERERS.has(page.rendererType)) {
        throw new BadRequestException(
          `Page renderer '${page.rendererType}' is not supported.`,
        );
      }
    }

    for (const menu of menus) {
      if (menu.pageKey && !pages.some((page: any) => page.pageKey === menu.pageKey)) {
        throw new BadRequestException(
          `Menu '${menu.menuKey}' references unknown page '${menu.pageKey}'.`,
        );
      }
    }

    const reportKeys = new Set(reports.map((report: any) => report.reportKey));
    for (const page of pages) {
      if (page.rendererType === 'hostReportAction') {
        const reportKey = page?.config?.reportKey;
        if (reportKey && !reportKeys.has(reportKey)) {
          throw new BadRequestException(
            `Page '${page.pageKey}' references missing report '${reportKey}'.`,
          );
        }
      }
    }

    return {
      plugin,
      permissions,
      menus,
      pages,
      widgets,
      reports,
      workflows,
      settings,
      checksum: createHash('sha256')
        .update(JSON.stringify(bundle))
        .digest('hex'),
    };
  }

  private readAppVersion() {
    try {
      const packageJson = JSON.parse(
        readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
      );
      return packageJson.version || '0.0.1';
    } catch {
      return '0.0.1';
    }
  }

  private isCompatible(range: string) {
    const value = String(range).trim();
    if (!value || value === '*') return true;
    if (value === this.appVersion) return true;
    if (value.startsWith('^')) {
      return this.appVersion.split('.')[0] === value.slice(1).split('.')[0];
    }
    if (value.startsWith('~')) {
      const [major, minor] = value.slice(1).split('.');
      const [currentMajor, currentMinor] = this.appVersion.split('.');
      return major === currentMajor && minor === currentMinor;
    }
    if (value.startsWith('>=')) {
      return this.compareVersions(this.appVersion, value.slice(2)) >= 0;
    }
    return false;
  }

  private compareVersions(left: string, right: string) {
    const l = left.split('.').map((part) => parseInt(part || '0', 10));
    const r = right.split('.').map((part) => parseInt(part || '0', 10));
    const length = Math.max(l.length, r.length);
    for (let index = 0; index < length; index++) {
      const leftPart = l[index] ?? 0;
      const rightPart = r[index] ?? 0;
      if (leftPart > rightPart) return 1;
      if (leftPart < rightPart) return -1;
    }
    return 0;
  }
}
