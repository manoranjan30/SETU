import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { TempUser } from './entities/temp-user.entity';

@Injectable()
export class TempUserExpiryCron {
    private readonly logger = new Logger(TempUserExpiryCron.name);

    constructor(
        @InjectRepository(TempUser)
        private readonly repo: Repository<TempUser>,
    ) { }

    @Cron(CronExpression.EVERY_DAY_AT_1AM)
    async expireStaleUsers() {
        const today = new Date();
        // Use clear end of day comparison or just raw Date LessThan
        const expired = await this.repo.find({
            where: {
                status: 'ACTIVE',
                expiryDate: LessThan(today)
            },
            relations: ['user']
        });

        for (const tu of expired) {
            await this.repo.update(tu.id, { status: 'EXPIRED' });
            this.logger.log(`Temp user ${tu.user.username} (ID: ${tu.user.id}) expired for WO ${tu.workOrderId}`);
        }

        if (expired.length > 0) {
            this.logger.log(`Expired ${expired.length} temporary users`);
        }
    }
}
