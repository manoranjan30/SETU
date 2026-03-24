import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TempRoleTemplate } from './entities/temp-role-template.entity';
import { CreateTempRoleDto } from './dto/create-temp-role.dto';
import { ALL_PERMISSIONS } from '../auth/permission-registry';
import { Role } from '../roles/role.entity';
import { Permission } from '../permissions/permission.entity';

const TEMP_USER_PERMISSION_ALLOWLIST = new Set<string>([
  'EPS.NODE.READ',
  'QUALITY.DASHBOARD.READ',
  'QUALITY.ACTIVITYLIST.READ',
  'QUALITY.ACTIVITY.READ',
  'QUALITY.INSPECTION.RAISE',
  'QUALITY.INSPECTION.READ',
  'QUALITY.INSPECTION.APPROVE',
  'QUALITY.OBSERVATION.RESOLVE',
  'QUALITY.OBSERVATION.CLOSE',
  'QUALITY.SITE_OBS.READ',
  'QUALITY.SITE_OBS.RECTIFY',
  'QUALITY.DOCUMENT.MANAGE',
  'QUALITY.CHECKLIST.CREATE',
  'EXECUTION.ENTRY.READ',
  'EXECUTION.ENTRY.CREATE',
  'EXECUTION.MICRO.CREATE',
  'PROGRESS.DASHBOARD.READ',
  'QUALITY.SNAG.READ',
  'QUALITY.SNAG.UPDATE',
]);

@Injectable()
export class TempRoleService {
  constructor(
    @InjectRepository(TempRoleTemplate)
    private readonly repo: Repository<TempRoleTemplate>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permRepo: Repository<Permission>,
  ) {}

  async create(dto: CreateTempRoleDto, userId: number) {
    this.validateAllowedPermissions(dto.allowedPermissions);

    const template = this.repo.create({
      ...dto,
      createdById: userId,
    });
    const savedTemplate = await this.repo.save(template);

    // Sync underlying Role
    await this.syncRole(savedTemplate);

    return savedTemplate;
  }

  async update(
    id: number,
    dto: Partial<CreateTempRoleDto>,
    isActive?: boolean,
  ) {
    const template = await this.repo.findOneBy({ id });
    if (!template) throw new NotFoundException('Template not found');

    if (dto.allowedPermissions) {
      this.validateAllowedPermissions(dto.allowedPermissions);
    }

    Object.assign(template, dto);
    if (typeof isActive !== 'undefined') template.isActive = isActive;

    const savedTemplate = await this.repo.save(template);

    // Sync underlying Role
    if (template.isActive) {
      await this.syncRole(savedTemplate);
    }
    return savedTemplate;
  }

  async delete(id: number) {
    return this.update(id, {}, false);
  }

  async findAll() {
    return this.repo.find({ order: { id: 'DESC' } });
  }

  async findOneActive(id: number) {
    const template = await this.repo.findOneBy({ id, isActive: true });
    if (!template)
      throw new NotFoundException('Template not found or inactive');
    return template;
  }

  private async syncRole(template: TempRoleTemplate) {
    const roleName = `TEMP_ROLE_${template.id}`;
    let role = await this.roleRepo.findOne({
      where: { name: roleName },
      relations: ['permissions'],
    });

    const expandedPermissionCodes = this.expandTempPermissions(
      template.allowedPermissions,
    );

    const permissions = await this.permRepo.find({
      where: { permissionCode: In(expandedPermissionCodes) },
    });

    if (!role) {
      role = this.roleRepo.create({
        name: roleName,
        description: `Auto-generated Role for TempRoleTemplate: ${template.name}`,
        permissions,
      });
    } else {
      role.description = `Auto-generated Role for TempRoleTemplate: ${template.name}`;
      role.permissions = permissions;
    }

    await this.roleRepo.save(role);
  }

  private expandTempPermissions(permissionCodes: string[]) {
    const expanded = new Set<string>(permissionCodes);

    expanded.add('EPS.NODE.READ');

    const hasQualityAccess = Array.from(expanded).some((code) =>
      code.startsWith('QUALITY.'),
    );
    if (hasQualityAccess) {
      expanded.add('QUALITY.DASHBOARD.READ');
    }

    if (
      expanded.has('QUALITY.INSPECTION.RAISE') ||
      expanded.has('QUALITY.INSPECTION.READ') ||
      expanded.has('QUALITY.INSPECTION.APPROVE')
    ) {
      expanded.add('QUALITY.ACTIVITYLIST.READ');
      expanded.add('QUALITY.ACTIVITY.READ');
    }

    if (expanded.has('QUALITY.INSPECTION.APPROVE')) {
      expanded.add('QUALITY.INSPECTION.STAGE_APPROVE');
      expanded.add('QUALITY.INSPECTION.FINAL_APPROVE');
    }

    if (
      expanded.has('EXECUTION.ENTRY.CREATE') ||
      expanded.has('EXECUTION.ENTRY.UPDATE')
    ) {
      expanded.add('EXECUTION.ENTRY.READ');
    }

    return Array.from(expanded);
  }

  private validateAllowedPermissions(permissionCodes: string[]) {
    const validCodes = new Set(ALL_PERMISSIONS.map((p) => p.code));

    for (const code of permissionCodes) {
      if (!validCodes.has(code)) {
        throw new BadRequestException(`Invalid permission code: ${code}`);
      }
      if (!TEMP_USER_PERMISSION_ALLOWLIST.has(code)) {
        throw new BadRequestException(
          `Permission not allowed for temporary vendor users: ${code}`,
        );
      }
    }
  }
}
