import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExportPreset } from './entities/export-preset.entity';

@Injectable()
export class ExportPresetService {
  constructor(
    @InjectRepository(ExportPreset)
    private readonly repo: Repository<ExportPreset>,
  ) {}

  async list(userId: number, module: string, tableKey: string) {
    return this.repo.find({
      where: { userId, module, tableKey },
      order: { updatedAt: 'DESC' },
    });
  }

  async save(
    userId: number,
    body: {
      module: string;
      tableKey: string;
      name: string;
      filters: Record<string, unknown>;
    },
  ) {
    const module = body.module?.trim();
    const tableKey = body.tableKey?.trim();
    const name = body.name?.trim();
    if (!module || !tableKey || !name) {
      throw new NotFoundException('Export preset scope and name are required');
    }

    const existing = await this.repo.findOne({
      where: { userId, module, tableKey, name },
    });
    const preset = existing || this.repo.create({ userId, module, tableKey, name });
    preset.filters = body.filters || {};
    return this.repo.save(preset);
  }

  async delete(userId: number, id: number) {
    const preset = await this.repo.findOne({ where: { id, userId } });
    if (!preset) throw new NotFoundException('Export preset not found');
    await this.repo.remove(preset);
    return { success: true };
  }
}
