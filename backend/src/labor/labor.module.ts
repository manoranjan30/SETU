import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LaborService } from './labor.service';
import { LaborController } from './labor.controller';
import { LaborCategory } from './entities/labor-category.entity';
import { DailyLaborPresence } from './entities/daily-labor-presence.entity';
import { ActivityLaborUpdate } from './entities/activity-labor-update.entity';
import { LaborExcelMapping } from './entities/labor-excel-mapping.entity';
import { WbsModule } from '../wbs/wbs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LaborCategory,
      DailyLaborPresence,
      ActivityLaborUpdate,
      LaborExcelMapping,
    ]),
    WbsModule,
  ],
  providers: [LaborService],
  controllers: [LaborController],
  exports: [LaborService],
})
export class LaborModule {}
