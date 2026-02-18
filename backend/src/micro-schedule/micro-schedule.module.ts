import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MicroSchedule } from './entities/micro-schedule.entity';
import { MicroScheduleActivity } from './entities/micro-schedule-activity.entity';
import { MicroDailyLog } from './entities/micro-daily-log.entity';
import { MicroQuantityLedger } from './entities/micro-quantity-ledger.entity';
import { DelayReason } from './entities/delay-reason.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { WorkOrder } from '../workdoc/entities/work-order.entity';
import { EpsNode } from '../eps/eps.entity';
import { User } from '../users/user.entity';
import { MicroScheduleService } from './micro-schedule.service';
import { MicroActivityService } from './micro-activity.service';
import { MicroDailyLogService } from './micro-daily-log.service';
import { MicroLedgerService } from './micro-ledger.service';
import { MicroScheduleController } from './micro-schedule.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            MicroSchedule,
            MicroScheduleActivity,
            MicroDailyLog,
            MicroQuantityLedger,
            DelayReason,
            Activity,
            BoqItem,
            WorkOrder,
            EpsNode,
            User,
        ]),
    ],
    controllers: [MicroScheduleController],
    providers: [
        MicroScheduleService,
        MicroActivityService,
        MicroDailyLogService,
        MicroLedgerService,
    ],
    exports: [
        MicroScheduleService,
        MicroActivityService,
        MicroDailyLogService,
        MicroLedgerService,
    ],
})
export class MicroScheduleModule { }
