import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { LaborCategory } from './entities/labor-category.entity';
import { DailyLaborPresence } from './entities/daily-labor-presence.entity';
import { ActivityLaborUpdate } from './entities/activity-labor-update.entity';
import { LaborExcelMapping } from './entities/labor-excel-mapping.entity';

@Injectable()
export class LaborService {
  private readonly logger = new Logger(LaborService.name);

  constructor(
    @InjectRepository(LaborCategory)
    private categoryRepo: Repository<LaborCategory>,
    @InjectRepository(DailyLaborPresence)
    private presenceRepo: Repository<DailyLaborPresence>,
    @InjectRepository(ActivityLaborUpdate)
    private activityLaborRepo: Repository<ActivityLaborUpdate>,
    @InjectRepository(LaborExcelMapping)
    private mappingRepo: Repository<LaborExcelMapping>,
  ) {}

  // --- Categories ---
  async getCategories(projectId?: number) {
    return this.categoryRepo.find({
      where: [
        { projectId: projectId },
        { projectId: IsNull() }, // Include global templates
      ],
      order: { categoryGroup: 'ASC', name: 'ASC' },
    });
  }

  async saveCategories(categories: Partial<LaborCategory>[]) {
    return this.categoryRepo.save(categories);
  }

  // --- Daily Presence (Register) ---
  async getDailyPresence(projectId: number, date?: string) {
    const where: any = { projectId };
    if (date) where.date = date;

    return this.presenceRepo.find({
      where,
      relations: ['category'],
      order: { date: 'DESC' },
    });
  }

  async saveDailyPresence(projectId: number, entries: any[], userId: number) {
    try {
      const userIdStr = userId?.toString() || 'unknown';
      const toSave = entries.map((e) => ({
        ...e,
        projectId,
        updatedBy: userIdStr,
      }));
      return await this.presenceRepo.save(toSave);
    } catch (error) {
      this.logger.error(
        `Failed to save daily presence for project ${projectId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // --- Activity Labor Allocation ---
  async getActivityLabor(activityId: number) {
    return this.activityLaborRepo.find({
      where: { activityId },
      relations: ['category', 'activity'],
      order: { date: 'DESC' },
    });
  }

  async saveActivityLabor(entries: any[], userId: number) {
    try {
      const userIdStr = userId?.toString() || 'unknown';
      const toSave = entries.map((e) => ({
        ...e,
        updatedBy: userIdStr,
      }));
      return await this.activityLaborRepo.save(toSave);
    } catch (error) {
      this.logger.error(
        `Failed to save activity labor: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getAllocationsByProject(projectId: number, date?: string) {
    // Get all activity labor allocations for a project, optionally filtered by date
    const query = this.activityLaborRepo
      .createQueryBuilder('alu')
      .leftJoinAndSelect('alu.category', 'category')
      .leftJoinAndSelect('alu.activity', 'activity')
      .innerJoin('activity.wbsNode', 'wbs')
      .where('wbs.projectId = :projectId', { projectId });

    if (date) {
      query.andWhere('alu.date = :date', { date });
    }

    return query.orderBy('alu.date', 'DESC').getMany();
  }

  // --- Excel Mapping ---
  async getMappings(projectId: number) {
    return this.mappingRepo.find({ where: { projectId } });
  }

  async saveMapping(mapping: Partial<LaborExcelMapping>) {
    return this.mappingRepo.save(mapping);
  }

  // --- Batch Import from Excel ---
  async importLaborData(
    projectId: number,
    data: any[],
    mappingId: number,
    userId: number,
  ) {
    try {
      const mapping = await this.mappingRepo.findOne({
        where: { id: mappingId },
      });
      // For demo/simple import, mappings might be passed directly or used from mappingId
      const colMap = mapping?.columnMappings || {};

      const userIdStr = userId?.toString() || 'unknown';
      const results: any[] = [];

      for (const row of data) {
        const date = row.date || row.Date;
        if (!date) continue;

        for (const [colName, categoryId] of Object.entries(colMap)) {
          const count = parseFloat(row[colName]);
          if (isNaN(count) || count === 0) continue;

          results.push({
            projectId,
            date,
            categoryId: Number(categoryId),
            count,
            updatedBy: userIdStr,
            remarks: 'Imported from Excel',
          });
        }
      }

      if (results.length === 0) return [];
      return await this.presenceRepo.save(results);
    } catch (error) {
      this.logger.error(
        `Failed to import labor data for project ${projectId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
