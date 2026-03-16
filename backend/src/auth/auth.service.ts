import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { expandPermissions } from './permission-config';
import { ProjectAssignmentService } from '../projects/project-assignment.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TempUser } from '../temp-user/entities/temp-user.entity';
import { Role } from '../roles/role.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private assignmentService: ProjectAssignmentService,
    @InjectRepository(TempUser)
    private readonly tempUserRepo: Repository<TempUser>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    console.log(`[AuthService] Validating user: '${username}'`);
    const user = await this.usersService.findOne(username);

    if (!user) {
      console.log(`[AuthService] User not found in DB: '${username}'`);
      return null;
    }

    if (!user.isActive) {
      console.log(`[AuthService] User '${username}' is deactivated.`);
      throw new UnauthorizedException('User account is deactivated');
    }

    console.log(`[AuthService] User found: ${user.id} / ${user.username}`);
    console.log(
      `[AuthService] Stored Hash: ${user.passwordHash?.substring(0, 10)}...`,
    );

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    console.log(`[AuthService] Password '${pass}' match result: ${isMatch}`);

    if (isMatch) {
      const { passwordHash, ...result } = user;
      return result;
    }

    return null;
  }

  async login(user: any) {
    // Flatten permissions from all roles
    const rawPermissions = new Set<string>();
    if (user.roles) {
      user.roles.forEach((role) => {
        if (role.permissions) {
          role.permissions.forEach((p) => rawPermissions.add(p.permissionCode));
        }
      });
    }

    // Fetch Project Assignments to add Project-specific permissions and Project IDs
    let assignments = await this.assignmentService.getUserAssignments(
      user.id,
    );
    let assignedProjectIds = assignments.map((a) => a.project?.id);

    // Merge project-specific role permissions into the raw permissions set
    assignments.forEach((assignment) => {
      assignment.roles?.forEach((role) => {
        role.permissions?.forEach((p) => rawPermissions.add(p.permissionCode));
      });
    });

    if (user.isTempUser) {
      const activeTempUser = await this.tempUserRepo.findOne({
        where: { user: { id: user.id }, status: 'ACTIVE' },
        relations: ['tempRoleTemplate'],
        order: { id: 'DESC' },
      });

      if (activeTempUser && assignedProjectIds.length === 0) {
        await this.ensureTempUserProjectAssignment(activeTempUser);
        assignments = await this.assignmentService.getUserAssignments(user.id);
        assignedProjectIds = assignments.map((a) => a.project?.id);

        assignments.forEach((assignment) => {
          assignment.roles?.forEach((role) => {
            role.permissions?.forEach((p) => rawPermissions.add(p.permissionCode));
          });
        });
      }

      if (activeTempUser?.tempRoleTemplate?.allowedPermissions?.length) {
        this.expandTempPermissions(
          activeTempUser.tempRoleTemplate.allowedPermissions,
        ).forEach((code) => rawPermissions.add(code));
      }
    }

    // Expand permissions to include implied dependencies
    const permissions = expandPermissions(Array.from(rawPermissions));

    const payload = {
      username: user.username,
      sub: user.id,
      roles: user.roles?.map((r: any) => r.name),
      permissions: permissions,
      project_ids: assignedProjectIds,
      isTempUser: user.isTempUser,
      isFirstLogin: user.isFirstLogin,
    };

    const tokenOptions: any = {};
    if (user.isTempUser) {
      tokenOptions.expiresIn = '8h';
    }

    return {
      access_token: this.jwtService.sign(payload, tokenOptions),
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        roles: payload.roles,
        permissions: payload.permissions,
        project_ids: assignedProjectIds,
        isTempUser: user.isTempUser,
        isFirstLogin: user.isFirstLogin,
      },
    };
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

  private async ensureTempUserProjectAssignment(tempUser: TempUser) {
    if (!tempUser.projectId || !tempUser.userId || !tempUser.tempRoleTemplateId) {
      return;
    }

    const roleName = `TEMP_ROLE_${tempUser.tempRoleTemplateId}`;
    let role = await this.roleRepo.findOneBy({ name: roleName });
    if (!role) {
      role = this.roleRepo.create({
        name: roleName,
        description: 'Auto-generated fallback',
      });
      role = await this.roleRepo.save(role);
    }

    await this.assignmentService.assignUser(tempUser.projectId, tempUser.userId, [
      role.id,
    ]);
  }
}
