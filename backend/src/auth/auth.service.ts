import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { expandPermissions } from './permission-config';
import { ProjectAssignmentService } from '../projects/project-assignment.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TempUser } from '../temp-user/entities/temp-user.entity';
import { Role } from '../roles/role.entity';
import { AuthOtpChallenge } from './entities/auth-otp-challenge.entity';
import { SystemSettingsService } from '../common/system-settings.service';
import { EmailDeliveryService } from './email-delivery.service';

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
    @InjectRepository(AuthOtpChallenge)
    private readonly otpRepo: Repository<AuthOtpChallenge>,
    private readonly settingsService: SystemSettingsService,
    private readonly emailDeliveryService: EmailDeliveryService,
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

  private isAdminUser(user: any) {
    return (
      user?.username === 'admin' ||
      user?.roles?.some?.((role: any) => role?.name === 'Admin') ||
      user?.roles?.includes?.('Admin')
    );
  }

  private maskEmail(email: string) {
    const [name, domain] = email.split('@');
    if (!domain) return 'configured email';
    const visible = name.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(2, name.length - 2))}@${domain}`;
  }

  async login(
    user: any,
    requestMeta?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const otpEnabled = await this.settingsService.getSettingBool(
      'AUTH_EMAIL_OTP_ENABLED',
    );
    if (otpEnabled && !this.isAdminUser(user)) {
      return this.createEmailOtpChallenge(user, requestMeta);
    }

    return this.issueLoginToken(user);
  }

  private async createEmailOtpChallenge(
    user: any,
    requestMeta?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const email = String(user.email || '').trim();
    if (!email) {
      throw new BadRequestException(
        'Email OTP is enabled but this user does not have an email address. Contact admin.',
      );
    }

    const ttlMinutes = Math.max(
      1,
      Math.min(
        15,
        Number((await this.settingsService.getSetting('AUTH_EMAIL_OTP_TTL_MINUTES')) || 5),
      ),
    );
    const otp = String(randomInt(0, 1000000)).padStart(6, '0');
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const challenge = await this.otpRepo.save(
      this.otpRepo.create({
        userId: user.id,
        deliveryChannel: 'EMAIL',
        destination: email,
        otpHash,
        expiresAt,
        consumedAt: null,
        attemptCount: 0,
        requestIp: requestMeta?.ipAddress || null,
        userAgent: requestMeta?.userAgent || null,
      }),
    );

    await this.emailDeliveryService.sendLoginOtp(email, otp, ttlMinutes);

    return {
      otpRequired: true,
      challengeId: challenge.id,
      deliveryChannel: 'EMAIL',
      destinationMasked: this.maskEmail(email),
      expiresAt,
      expiresInSeconds: ttlMinutes * 60,
    };
  }

  async verifyEmailOtp(challengeId: string, otp: string) {
    const challenge = await this.otpRepo.findOne({
      where: { id: challengeId },
      relations: ['user', 'user.roles', 'user.roles.permissions', 'user.permissions'],
    });
    if (!challenge || challenge.consumedAt) {
      throw new UnauthorizedException('Invalid or already used OTP challenge.');
    }
    if (new Date() > new Date(challenge.expiresAt)) {
      throw new UnauthorizedException('OTP expired. Please login again.');
    }
    if (challenge.attemptCount >= 5) {
      throw new UnauthorizedException('Too many OTP attempts. Please login again.');
    }

    const matches = await bcrypt.compare(String(otp || '').trim(), challenge.otpHash);
    challenge.attemptCount += 1;
    if (!matches) {
      await this.otpRepo.save(challenge);
      throw new UnauthorizedException('Invalid OTP.');
    }

    challenge.consumedAt = new Date();
    await this.otpRepo.save(challenge);
    const { passwordHash, ...user } = challenge.user as any;
    return this.issueLoginToken(user);
  }

  private async issueLoginToken(user: any) {
    // Flatten permissions from all roles
    const rawPermissions = new Set<string>();
    if (user.permissions) {
      user.permissions.forEach((permission) =>
        rawPermissions.add(permission.permissionCode),
      );
    }
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
        designation: user.designation,
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
