import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { expandPermissions } from './permission-config';
import { ProjectAssignmentService } from '../projects/project-assignment.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private assignmentService: ProjectAssignmentService,
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
    const assignments = await this.assignmentService.getUserAssignments(
      user.id,
    );
    const assignedProjectIds = assignments.map((a) => a.project?.id);

    // Merge project-specific role permissions into the raw permissions set
    assignments.forEach((assignment) => {
      assignment.roles?.forEach((role) => {
        role.permissions?.forEach((p) => rawPermissions.add(p.permissionCode));
      });
    });

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
}
