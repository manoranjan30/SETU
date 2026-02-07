import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TableViewConfig } from './entities/table-view-config.entity';

@Injectable()
export class TableViewService {
  constructor(
    @InjectRepository(TableViewConfig)
    private readonly repo: Repository<TableViewConfig>,
  ) {}

  async getViews(userId: number, tableId: string) {
    return await this.repo.find({
      where: { userId, tableId },
      order: { isDefault: 'DESC', viewName: 'ASC' },
    });
  }

  async saveView(
    userId: number,
    dto: {
      tableId: string;
      viewName: string;
      config: any;
      isDefault?: boolean;
    },
  ) {
    // If isDefault is true, unset other defaults for this table/user
    if (dto.isDefault) {
      await this.repo.update(
        { userId, tableId: dto.tableId },
        { isDefault: false },
      );
    }

    // Check if exists updates
    const existing = await this.repo.findOne({
      where: { userId, tableId: dto.tableId, viewName: dto.viewName },
    });

    if (existing) {
      existing.config = dto.config;
      existing.isDefault = dto.isDefault ?? existing.isDefault;
      return await this.repo.save(existing);
    } else {
      const newView = this.repo.create({ ...dto, userId });
      return await this.repo.save(newView);
    }
  }

  async deleteView(userId: number, id: number) {
    const view = await this.repo.findOne({ where: { id, userId } });
    if (!view) throw new NotFoundException('View not found');
    return await this.repo.remove(view);
  }
}
