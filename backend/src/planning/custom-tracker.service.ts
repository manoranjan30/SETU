import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CustomTrackerFieldType,
  CustomTrackerRecordStatus,
  CustomTrackerStatus,
  PlanningCustomTracker,
  PlanningCustomTrackerField,
  PlanningCustomTrackerRecord,
} from './entities/custom-tracker.entity';

const FIELD_TYPES: CustomTrackerFieldType[] = [
  'TEXT',
  'NUMBER',
  'DATE',
  'BOOLEAN',
  'SELECT',
  'MULTI_SELECT',
  'PERCENT',
  'STATUS',
  'USER',
  'CURRENCY',
];

const RECORD_STATUSES: CustomTrackerRecordStatus[] = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'BLOCKED',
  'ON_HOLD',
];

@Injectable()
export class CustomTrackerService {
  constructor(
    @InjectRepository(PlanningCustomTracker)
    private readonly trackerRepo: Repository<PlanningCustomTracker>,
    @InjectRepository(PlanningCustomTrackerField)
    private readonly fieldRepo: Repository<PlanningCustomTrackerField>,
    @InjectRepository(PlanningCustomTrackerRecord)
    private readonly recordRepo: Repository<PlanningCustomTrackerRecord>,
  ) {}

  async listTrackers(projectId: number, includeArchived = false) {
    const where = includeArchived
      ? { projectId }
      : { projectId, status: 'ACTIVE' as CustomTrackerStatus };
    const trackers = await this.trackerRepo.find({
      where,
      order: { updatedAt: 'DESC', id: 'DESC' },
    });
    if (!trackers.length) return [];

    const fields = await this.fieldRepo.find({
      where: trackers.map((tracker) => ({ trackerId: tracker.id })),
      order: { sequence: 'ASC', id: 'ASC' },
    });
    const counts = await this.recordRepo
      .createQueryBuilder('record')
      .select('record.trackerId', 'trackerId')
      .addSelect('COUNT(*)', 'count')
      .where('record.trackerId IN (:...ids)', {
        ids: trackers.map((tracker) => tracker.id),
      })
      .groupBy('record.trackerId')
      .getRawMany<{ trackerId: string; count: string }>();
    const countMap = new Map(
      counts.map((row) => [Number(row.trackerId), Number(row.count)]),
    );

    return trackers.map((tracker) => ({
      ...tracker,
      fields: fields.filter((field) => field.trackerId === tracker.id),
      recordCount: countMap.get(tracker.id) || 0,
    }));
  }

  async getTracker(projectId: number, trackerId: number) {
    const tracker = await this.findTracker(projectId, trackerId);
    const [fields, records] = await Promise.all([
      this.listFields(tracker.id),
      this.recordRepo.find({
        where: { projectId, trackerId },
        order: { updatedAt: 'DESC', id: 'DESC' },
      }),
    ]);
    return { ...tracker, fields, records };
  }

  async createTracker(projectId: number, body: any, userId?: number) {
    const name = this.cleanText(body?.name);
    if (!name) throw new BadRequestException('Tracker name is required');

    const trackerEntity = this.trackerRepo.create({
      projectId,
      name,
      description: this.cleanText(body?.description),
      trackerType: this.cleanText(body?.trackerType) || 'GENERAL',
      status: 'ACTIVE',
      locationScopeTypes: this.asStringArray(body?.locationScopeTypes),
      categoryConfig: this.normalizeCategories(body?.categoryConfig),
      chartConfig: this.asPlainObject(body?.chartConfig),
      createdByUserId: userId || null,
    });
    const tracker = await this.trackerRepo.save(trackerEntity);

    const fields = Array.isArray(body?.fields) ? body.fields : [];
    for (const field of fields) {
      await this.createField(projectId, tracker.id, field);
    }
    return this.getTracker(projectId, tracker.id);
  }

  async updateTracker(projectId: number, trackerId: number, body: any) {
    const tracker = await this.findTracker(projectId, trackerId);
    if (body?.name !== undefined) {
      const name = this.cleanText(body.name);
      if (!name) throw new BadRequestException('Tracker name is required');
      tracker.name = name;
    }
    if (body?.description !== undefined) {
      tracker.description = this.cleanText(body.description);
    }
    if (body?.trackerType !== undefined) {
      tracker.trackerType = this.cleanText(body.trackerType) || 'GENERAL';
    }
    if (body?.status !== undefined) {
      tracker.status = body.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';
    }
    if (body?.locationScopeTypes !== undefined) {
      tracker.locationScopeTypes = this.asStringArray(body.locationScopeTypes);
    }
    if (body?.categoryConfig !== undefined) {
      tracker.categoryConfig = this.normalizeCategories(body.categoryConfig);
    }
    if (body?.chartConfig !== undefined) {
      tracker.chartConfig = this.asPlainObject(body.chartConfig);
    }
    await this.trackerRepo.save(tracker);
    return this.getTracker(projectId, tracker.id);
  }

  async archiveTracker(projectId: number, trackerId: number) {
    const tracker = await this.findTracker(projectId, trackerId);
    tracker.status = 'ARCHIVED';
    await this.trackerRepo.save(tracker);
    return { archived: true };
  }

  async listFields(trackerId: number) {
    return this.fieldRepo.find({
      where: { trackerId },
      order: { sequence: 'ASC', id: 'ASC' },
    });
  }

  async createField(projectId: number, trackerId: number, body: any) {
    await this.findTracker(projectId, trackerId);
    const payload = this.normalizeField(body);
    const field = await this.fieldRepo.save(
      this.fieldRepo.create({ ...payload, trackerId }),
    );
    return field;
  }

  async updateField(
    projectId: number,
    trackerId: number,
    fieldId: number,
    body: any,
  ) {
    await this.findTracker(projectId, trackerId);
    const field = await this.fieldRepo.findOne({
      where: { id: fieldId, trackerId },
    });
    if (!field) throw new NotFoundException('Tracker field not found');
    Object.assign(field, this.normalizeField({ ...field, ...body }));
    return this.fieldRepo.save(field);
  }

  async deleteField(projectId: number, trackerId: number, fieldId: number) {
    await this.findTracker(projectId, trackerId);
    await this.fieldRepo.delete({ id: fieldId, trackerId });
    return { deleted: true };
  }

  async listRecords(projectId: number, trackerId: number, query: any = {}) {
    await this.findTracker(projectId, trackerId);
    const qb = this.recordRepo
      .createQueryBuilder('record')
      .where('record.projectId = :projectId', { projectId })
      .andWhere('record.trackerId = :trackerId', { trackerId });

    if (query.status && RECORD_STATUSES.includes(query.status)) {
      qb.andWhere('record.status = :status', { status: query.status });
    }
    if (query.epsNodeId) {
      qb.andWhere('record.epsNodeId = :epsNodeId', {
        epsNodeId: Number(query.epsNodeId),
      });
    }
    if (query.q) {
      qb.andWhere(
        '(record.locationText ILIKE :q OR record.remarks ILIKE :q OR CAST(record.values AS text) ILIKE :q OR CAST(record.categoryValues AS text) ILIKE :q)',
        { q: `%${String(query.q).trim()}%` },
      );
    }

    return qb.orderBy('record.updatedAt', 'DESC').addOrderBy('record.id', 'DESC').getMany();
  }

  async createRecord(
    projectId: number,
    trackerId: number,
    body: any,
    userId?: number,
  ) {
    const fields = await this.listFieldsForProject(projectId, trackerId);
    const values = this.normalizeValues(fields, body?.values || {});
    const progressPercent = this.normalizePercent(body?.progressPercent);
    const record = await this.recordRepo.save(
      this.recordRepo.create({
        trackerId,
        projectId,
        epsNodeId: this.asNullableNumber(body?.epsNodeId),
        locationText: this.cleanText(body?.locationText),
        categoryValues: this.asPlainObject(body?.categoryValues),
        values,
        status: this.normalizeRecordStatus(body?.status),
        progressPercent,
        remarks: this.cleanText(body?.remarks),
        createdByUserId: userId || null,
        updatedByUserId: userId || null,
      }),
    );
    return record;
  }

  async updateRecord(
    projectId: number,
    trackerId: number,
    recordId: number,
    body: any,
    userId?: number,
  ) {
    const fields = await this.listFieldsForProject(projectId, trackerId);
    const record = await this.recordRepo.findOne({
      where: { id: recordId, projectId, trackerId },
    });
    if (!record) throw new NotFoundException('Tracker record not found');

    if (body?.epsNodeId !== undefined) {
      record.epsNodeId = this.asNullableNumber(body.epsNodeId);
    }
    if (body?.locationText !== undefined) {
      record.locationText = this.cleanText(body.locationText);
    }
    if (body?.categoryValues !== undefined) {
      record.categoryValues = this.asPlainObject(body.categoryValues);
    }
    if (body?.values !== undefined) {
      record.values = this.normalizeValues(fields, body.values || {});
    }
    if (body?.status !== undefined) {
      record.status = this.normalizeRecordStatus(body.status);
    }
    if (body?.progressPercent !== undefined) {
      record.progressPercent = this.normalizePercent(body.progressPercent);
    }
    if (body?.remarks !== undefined) {
      record.remarks = this.cleanText(body.remarks);
    }
    record.updatedByUserId = userId || null;
    return this.recordRepo.save(record);
  }

  async deleteRecord(projectId: number, trackerId: number, recordId: number) {
    await this.recordRepo.delete({ id: recordId, projectId, trackerId });
    return { deleted: true };
  }

  async analytics(projectId: number, trackerId: number) {
    const tracker = await this.findTracker(projectId, trackerId);
    const [fields, records] = await Promise.all([
      this.listFields(trackerId),
      this.recordRepo.find({ where: { projectId, trackerId } }),
    ]);
    const byStatus: Record<string, number> = {};
    const byLocation: Record<string, { count: number; progressTotal: number }> =
      {};
    const byCategory: Record<string, Record<string, number>> = {};
    const fieldSummary: Record<
      string,
      { label: string; count: number; sum: number; average: number; max: number }
    > = {};

    const numericFields = fields.filter((field) =>
      ['NUMBER', 'PERCENT', 'CURRENCY'].includes(field.fieldType),
    );
    numericFields.forEach((field) => {
      fieldSummary[field.key] = {
        label: field.label,
        count: 0,
        sum: 0,
        average: 0,
        max: 0,
      };
    });

    records.forEach((record) => {
      byStatus[record.status] = (byStatus[record.status] || 0) + 1;
      const location = record.locationText || 'Unmapped';
      byLocation[location] ||= { count: 0, progressTotal: 0 };
      byLocation[location].count += 1;
      byLocation[location].progressTotal += Number(record.progressPercent || 0);

      Object.entries(record.categoryValues || {}).forEach(([key, value]) => {
        byCategory[key] ||= {};
        const label = String(value || 'Unspecified');
        byCategory[key][label] = (byCategory[key][label] || 0) + 1;
      });

      numericFields.forEach((field) => {
        const rawValue = record.values?.[field.key];
        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue)) return;
        const summary = fieldSummary[field.key];
        summary.count += 1;
        summary.sum += numericValue;
        summary.max = Math.max(summary.max, numericValue);
      });
    });

    Object.values(fieldSummary).forEach((summary) => {
      summary.average = summary.count ? summary.sum / summary.count : 0;
    });

    return {
      trackerId,
      totalRecords: records.length,
      averageProgress: records.length
        ? records.reduce(
            (sum, record) => sum + Number(record.progressPercent || 0),
            0,
          ) / records.length
        : 0,
      byStatus,
      byCategory,
      byLocation: Object.entries(byLocation).map(([location, data]) => ({
        location,
        count: data.count,
        averageProgress: data.count ? data.progressTotal / data.count : 0,
      })),
      fieldSummary,
    };
  }

  private async findTracker(projectId: number, trackerId: number) {
    const tracker = await this.trackerRepo.findOne({
      where: { id: trackerId, projectId },
    });
    if (!tracker) throw new NotFoundException('Custom tracker not found');
    return tracker;
  }

  private async listFieldsForProject(projectId: number, trackerId: number) {
    await this.findTracker(projectId, trackerId);
    return this.listFields(trackerId);
  }

  private normalizeField(body: any) {
    const label = this.cleanText(body?.label);
    if (!label) throw new BadRequestException('Field label is required');
    const key = this.slugKey(body?.key || label);
    if (!key) throw new BadRequestException('Field key is required');
    const fieldType = FIELD_TYPES.includes(body?.fieldType)
      ? body.fieldType
      : 'TEXT';
    return {
      label,
      key,
      fieldType,
      required: Boolean(body?.required),
      unit: this.cleanText(body?.unit),
      options: this.asStringArray(body?.options),
      formula: this.cleanText(body?.formula),
      sequence: Number.isFinite(Number(body?.sequence))
        ? Number(body.sequence)
        : 0,
      isKpi: Boolean(body?.isKpi),
    };
  }

  private normalizeValues(
    fields: PlanningCustomTrackerField[],
    rawValues: Record<string, any>,
  ) {
    const values: Record<string, any> = {};
    fields.forEach((field) => {
      const value = rawValues?.[field.key];
      if (
        field.required &&
        (value === undefined || value === null || String(value).trim() === '')
      ) {
        throw new BadRequestException(`${field.label} is required`);
      }
      if (value === undefined) return;
      if (['NUMBER', 'PERCENT', 'CURRENCY'].includes(field.fieldType)) {
        values[field.key] = value === '' || value === null ? null : Number(value);
        return;
      }
      if (field.fieldType === 'BOOLEAN') {
        values[field.key] = Boolean(value);
        return;
      }
      if (field.fieldType === 'MULTI_SELECT') {
        values[field.key] = this.asStringArray(value);
        return;
      }
      values[field.key] = value;
    });
    return values;
  }

  private normalizeCategories(raw: any) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const label = this.cleanText(item?.label);
        return {
          key: this.slugKey(item?.key || item?.label),
          label: label || '',
          options: this.asStringArray(item?.options),
        };
      })
      .filter((item) => item.key && item.label);
  }

  private normalizeRecordStatus(raw: any): CustomTrackerRecordStatus {
    return RECORD_STATUSES.includes(raw) ? raw : 'NOT_STARTED';
  }

  private normalizePercent(raw: any) {
    const value = Number(raw);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
  }

  private asStringArray(value: any): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => String(item || '').trim())
      .filter((item) => item.length > 0);
  }

  private asPlainObject(value: any): Record<string, any> {
    if (!value || Array.isArray(value) || typeof value !== 'object') return {};
    return value;
  }

  private asNullableNumber(value: any): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private cleanText(value: any): string | null {
    const text = String(value ?? '').trim();
    return text.length ? text : null;
  }

  private slugKey(value: any): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
  }
}
