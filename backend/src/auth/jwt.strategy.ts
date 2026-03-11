import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TempUser } from '../temp-user/entities/temp-user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(TempUser)
    private readonly tempUserRepo: Repository<TempUser>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'supersecretkey',
    });
  }

  async validate(payload: any) {
    let vendorContext: {
      vendorId: number;
      workOrderId: number;
      projectId: number;
    } | null = null;

    const latestTempUser =
      payload.isTempUser === false
        ? null
        : await this.tempUserRepo.findOne({
            where: { user: { id: payload.sub } },
            relations: ['workOrder'],
            order: { id: 'DESC' },
          });

    const shouldEnforceTempPolicy =
      payload.isTempUser === true || !!latestTempUser;

    if (shouldEnforceTempPolicy) {
      const tempUser = latestTempUser;
      if (!tempUser || tempUser.status !== 'ACTIVE') {
        throw new UnauthorizedException(
          'Temporary access suspended or revoked',
        );
      }

      const now = new Date();
      if (
        !tempUser.expiryDate ||
        Number.isNaN(new Date(tempUser.expiryDate).getTime()) ||
        now > new Date(tempUser.expiryDate)
      ) {
        await this.tempUserRepo.update(tempUser.id, { status: 'EXPIRED' });
        throw new UnauthorizedException('TEMP_EXPIRED');
      }

      const wo = tempUser.workOrder;
      if (!wo || (wo.status !== 'ACTIVE' && wo.status !== 'IN_PROGRESS')) {
        await this.tempUserRepo.update(tempUser.id, { status: 'EXPIRED' });
        throw new UnauthorizedException('TEMP_EXPIRED');
      }

      if (
        !wo.orderValidityEnd ||
        Number.isNaN(new Date(wo.orderValidityEnd).getTime()) ||
        now > new Date(wo.orderValidityEnd)
      ) {
        await this.tempUserRepo.update(tempUser.id, { status: 'EXPIRED' });
        throw new UnauthorizedException('TEMP_EXPIRED');
      }

      vendorContext = {
        vendorId: tempUser.vendorId,
        workOrderId: wo.id,
        projectId: tempUser.projectId,
      };
    }

    return {
      id: payload.sub,
      username: payload.username,
      roles: payload.roles,
      permissions: payload.permissions,
      project_ids: payload.project_ids,
      isTempUser: shouldEnforceTempPolicy,
      isFirstLogin: payload.isFirstLogin === true,
      vendorContext,
    };
  }
}
