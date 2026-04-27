import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ALL_PERMISSION_PRESETS,
  COMPOSITE_ROLE_TEMPLATES,
  resolvePresetPermissions,
  type CompositeRoleTemplate,
  type PermissionPreset,
} from '../auth/permission-presets';
import { Permission } from '../permissions/permission.entity';
import { ActionPreset } from './action-preset.entity';
import { RoleTemplate } from './role-template.entity';
import { UpsertActionPresetDto } from './dto/upsert-action-preset.dto';
import { UpsertRoleTemplateDto } from './dto/upsert-role-template.dto';

@Injectable()
export class RoleCatalogService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RoleCatalogService.name);

  constructor(
    @InjectRepository(ActionPreset)
    private readonly actionPresetRepo: Repository<ActionPreset>,
    @InjectRepository(RoleTemplate)
    private readonly roleTemplateRepo: Repository<RoleTemplate>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedSystemActionPresets();
    await this.seedSystemRoleTemplates();
  }

  async listActionPresets() {
    const presets = await this.actionPresetRepo.find({
      where: { isActive: true },
      order: { isSystem: 'DESC', group: 'ASC', tier: 'ASC', name: 'ASC' },
    });
    return presets.map((preset) => this.serializePreset(preset));
  }

  async createActionPreset(dto: UpsertActionPresetDto) {
    return this.serializePreset(await this.saveActionPreset(dto));
  }

  async updateActionPreset(id: number, dto: UpsertActionPresetDto) {
    const preset = await this.actionPresetRepo.findOne({ where: { id } });
    if (!preset) throw new NotFoundException('Action preset not found');
    if (preset.isLocked) {
      throw new ForbiddenException('Locked system presets cannot be edited');
    }

    return this.serializePreset(await this.saveActionPreset(dto, preset));
  }

  async archiveActionPreset(id: number) {
    const preset = await this.actionPresetRepo.findOne({ where: { id } });
    if (!preset) throw new NotFoundException('Action preset not found');
    if (preset.isLocked) {
      throw new ForbiddenException('Locked system presets cannot be archived');
    }
    preset.isActive = false;
    return this.serializePreset(await this.actionPresetRepo.save(preset));
  }

  async cloneActionPreset(id: number) {
    const preset = await this.actionPresetRepo.findOne({
      where: { id },
      relations: ['permissions'],
    });
    if (!preset) throw new NotFoundException('Action preset not found');

    return this.serializePreset(
      await this.actionPresetRepo.save(
      this.actionPresetRepo.create({
        code: `${preset.code}_CUSTOM_${Date.now()}`,
        name: `${preset.name} Copy`,
        description: preset.description,
        group: preset.group,
        tier: preset.tier,
        icon: preset.icon,
        isSystem: false,
        isLocked: false,
        isActive: true,
        permissions: preset.permissions,
      }),
      ),
    );
  }

  async listRoleTemplates() {
    const templates = await this.roleTemplateRepo.find({
      where: { isActive: true },
      order: { isSystem: 'DESC', name: 'ASC' },
    });
    return templates.map((template) => this.serializeTemplate(template));
  }

  async createRoleTemplate(dto: UpsertRoleTemplateDto) {
    return this.serializeTemplate(await this.saveRoleTemplate(dto));
  }

  async updateRoleTemplate(id: number, dto: UpsertRoleTemplateDto) {
    const template = await this.roleTemplateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Role template not found');
    if (template.isLocked) {
      throw new ForbiddenException('Locked system templates cannot be edited');
    }

    return this.serializeTemplate(await this.saveRoleTemplate(dto, template));
  }

  async archiveRoleTemplate(id: number) {
    const template = await this.roleTemplateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Role template not found');
    if (template.isLocked) {
      throw new ForbiddenException('Locked system templates cannot be archived');
    }
    template.isActive = false;
    return this.serializeTemplate(await this.roleTemplateRepo.save(template));
  }

  async cloneRoleTemplate(id: number) {
    const template = await this.roleTemplateRepo.findOne({
      where: { id },
      relations: ['presets'],
    });
    if (!template) throw new NotFoundException('Role template not found');

    return this.serializeTemplate(
      await this.roleTemplateRepo.save(
      this.roleTemplateRepo.create({
        code: `${template.code}_CUSTOM_${Date.now()}`,
        name: `${template.name} Copy`,
        description: template.description,
        icon: template.icon,
        isSystem: false,
        isLocked: false,
        isActive: true,
        presets: template.presets,
      }),
      ),
    );
  }

  async resolveFromPresetCodes(presetCodes: string[]) {
    const presets = presetCodes.length
      ? await this.actionPresetRepo.find({
          where: { code: In(presetCodes), isActive: true },
          relations: ['permissions'],
        })
      : [];
    const codes = Array.from(
      new Set(
        presets.flatMap((preset) =>
          preset.permissions.map((permission) => permission.permissionCode),
        ),
      ),
    );
    return { codes, count: codes.length };
  }

  async resolveFromTemplateCodes(templateCodes: string[]) {
    const templates = templateCodes.length
      ? await this.roleTemplateRepo.find({
          where: { code: In(templateCodes), isActive: true },
          relations: ['presets', 'presets.permissions'],
        })
      : [];

    const codes = Array.from(
      new Set(
        templates.flatMap((template) =>
          template.presets.flatMap((preset) =>
            preset.permissions.map((permission) => permission.permissionCode),
          ),
        ),
      ),
    );

    return { codes, count: codes.length };
  }

  private async saveActionPreset(
    dto: UpsertActionPresetDto,
    existing?: ActionPreset,
  ) {
    const permissions = await this.findPermissionsByCodes(dto.permissionCodes ?? []);
    const preset = existing ?? this.actionPresetRepo.create();

    Object.assign(preset, {
      code: dto.code.trim().toUpperCase(),
      name: dto.name.trim(),
      description: dto.description?.trim(),
      group: dto.group.trim(),
      tier: dto.tier,
      icon: dto.icon?.trim() || 'ShieldCheck',
      isActive: dto.isActive ?? true,
    });
    preset.permissions = permissions;

    return this.actionPresetRepo.save(preset);
  }

  private async saveRoleTemplate(
    dto: UpsertRoleTemplateDto,
    existing?: RoleTemplate,
  ) {
    const presets = await this.findPresetsByCodes(dto.presetCodes ?? []);
    const template = existing ?? this.roleTemplateRepo.create();

    Object.assign(template, {
      code: dto.code.trim().toUpperCase(),
      name: dto.name.trim(),
      description: dto.description?.trim(),
      icon: dto.icon?.trim() || 'Briefcase',
      isActive: dto.isActive ?? true,
    });
    template.presets = presets;

    return this.roleTemplateRepo.save(template);
  }

  private async findPermissionsByCodes(codes: string[]) {
    if (!codes.length) return [];
    return this.permissionRepo.find({
      where: { permissionCode: In(codes) },
      order: { moduleName: 'ASC', permissionCode: 'ASC' },
    });
  }

  private async findPresetsByCodes(codes: string[]) {
    if (!codes.length) return [];
    return this.actionPresetRepo.find({
      where: { code: In(codes), isActive: true },
      relations: ['permissions'],
    });
  }

  private async seedSystemActionPresets() {
    for (const preset of ALL_PERMISSION_PRESETS) {
      await this.upsertSystemActionPreset(preset);
    }
  }

  private async seedSystemRoleTemplates() {
    for (const template of COMPOSITE_ROLE_TEMPLATES) {
      await this.upsertSystemRoleTemplate(template);
    }
  }

  private async upsertSystemActionPreset(definition: PermissionPreset) {
    let preset = await this.actionPresetRepo.findOne({
      where: { code: definition.id },
      relations: ['permissions'],
    });
    const permissions = await this.findPermissionsByCodes(definition.permissions);

    if (!preset) {
      preset = this.actionPresetRepo.create();
    }

    Object.assign(preset, {
      code: definition.id,
      name: definition.name,
      description: definition.description,
      group: definition.group,
      tier: definition.tier,
      icon: definition.icon,
      isSystem: true,
      isLocked: true,
      isActive: true,
      permissions,
    });

    await this.actionPresetRepo.save(preset);
  }

  private async upsertSystemRoleTemplate(definition: CompositeRoleTemplate) {
    let template = await this.roleTemplateRepo.findOne({
      where: { code: definition.id },
      relations: ['presets'],
    });

    const presets = await this.findPresetsByCodes(definition.presetIds);

    if (!template) {
      template = this.roleTemplateRepo.create();
    }

    Object.assign(template, {
      code: definition.id,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      isSystem: true,
      isLocked: definition.id === 'SYSTEM_ADMIN',
      isActive: true,
      presets,
    });

    await this.roleTemplateRepo.save(template);
  }

  private serializePreset(preset: ActionPreset) {
    return {
      id: preset.id,
      code: preset.code,
      name: preset.name,
      description: preset.description,
      group: preset.group,
      tier: preset.tier,
      icon: preset.icon,
      isSystem: preset.isSystem,
      isLocked: preset.isLocked,
      isActive: preset.isActive,
      permissions: preset.permissions.map((permission) => permission.permissionCode),
    };
  }

  private serializeTemplate(template: RoleTemplate) {
    return {
      id: template.id,
      code: template.code,
      name: template.name,
      description: template.description,
      icon: template.icon,
      isSystem: template.isSystem,
      isLocked: template.isLocked,
      isActive: template.isActive,
      presetCodes: template.presets.map((preset) => preset.code),
      presets: template.presets.map((preset) => ({
        code: preset.code,
        name: preset.name,
        tier: preset.tier,
        icon: preset.icon,
      })),
    };
  }
}
