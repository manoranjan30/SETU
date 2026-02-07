import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TableViewConfig } from './entities/table-view-config.entity';
import { TableViewService } from './table-view.service';
import { TableViewController } from './table-view.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TableViewConfig])],
  controllers: [TableViewController],
  providers: [TableViewService],
  exports: [TableViewService],
})
export class CommonModule {}
