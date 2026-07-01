import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminDataCorrection } from './admin-data-correction.entity';
import { AdminDataController } from './admin-data.controller';
import { AdminDataService } from './admin-data.service';

@Module({
  imports: [TypeOrmModule.forFeature([AdminDataCorrection])],
  controllers: [AdminDataController],
  providers: [AdminDataService],
})
export class AdminDataModule {}
