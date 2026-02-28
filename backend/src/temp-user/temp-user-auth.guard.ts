import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TempUser } from './entities/temp-user.entity';
import { WorkOrder } from '../workdoc/entities/work-order.entity';

@Injectable()
export class TempUserAuthGuard implements CanActivate {
    constructor(
        @InjectRepository(TempUser) private tempUserRepo: Repository<TempUser>,
        @InjectRepository(WorkOrder) private workOrderRepo: Repository<WorkOrder>,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const user = req.user;

        // Fast fail if not a temp user
        if (!user || user.isTempUser !== true) return true;

        // Load active temp user profile
        const tempUser = await this.tempUserRepo.findOne({
            where: { user: { id: user.id }, status: 'ACTIVE' },
            relations: ['workOrder'],
        });

        if (!tempUser) {
            throw new UnauthorizedException('Temporary access suspended or revoked');
        }

        // Work order expiry check
        if (new Date() > new Date(tempUser.expiryDate)) {
            await this.tempUserRepo.update(tempUser.id, { status: 'EXPIRED' });
            throw new UnauthorizedException('TEMP_EXPIRED'); // Custom reason for flutter error handling
        }

        // Work order status check
        const wo = tempUser.workOrder;
        if (wo.status === 'CANCELLED' || wo.status === 'CLOSED') {
            await this.tempUserRepo.update(tempUser.id, { status: 'EXPIRED' });
            throw new UnauthorizedException('TEMP_EXPIRED');
        }

        // Injected into request
        req.vendorContext = {
            vendorId: tempUser.vendorId,
            workOrderId: wo.id,
            projectId: tempUser.projectId
        };

        return true;
    }
}
