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
  'FORMULA',
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
    const parentLocationRollup: Record<
      string,
      {
        level: number;
        location: string;
        count: number;
        progressTotal: number;
        sums: Record<string, number>;
      }
    > = {};
    const byCategory: Record<string, Record<string, number>> = {};
    const fieldSummary: Record<
      string,
      { label: string; count: number; sum: number; average: number; max: number }
    > = {};

    const numericFields = fields.filter((field) =>
      ['NUMBER', 'PERCENT', 'CURRENCY', 'FORMULA'].includes(field.fieldType),
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
      const locationParts = location
        .split('>')
        .map((part) => part.trim())
        .filter(Boolean);
      locationParts.forEach((_, index) => {
        const rollupKey = locationParts.slice(0, index + 1).join(' > ');
        parentLocationRollup[rollupKey] ||= {
          level: index + 1,
          location: rollupKey,
          count: 0,
          progressTotal: 0,
          sums: {},
        };
        parentLocationRollup[rollupKey].count += 1;
        parentLocationRollup[rollupKey].progressTotal += Number(
          record.progressPercent || 0,
        );
      });

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
        locationParts.forEach((_, index) => {
          const rollupKey = locationParts.slice(0, index + 1).join(' > ');
          parentLocationRollup[rollupKey] ||= {
            level: index + 1,
            location: rollupKey,
            count: 0,
            progressTotal: 0,
            sums: {},
          };
          parentLocationRollup[rollupKey].sums[field.key] =
            (parentLocationRollup[rollupKey].sums[field.key] || 0) +
            numericValue;
        });
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
      parentLocationRollup: Object.values(parentLocationRollup)
        .map((data) => ({
          level: data.level,
          location: data.location,
          count: data.count,
          averageProgress: data.count ? data.progressTotal / data.count : 0,
          sums: data.sums,
        }))
        .sort((a, b) => a.level - b.level || a.location.localeCompare(b.location)),
      fieldSummary,
    };
  }

  async exportReportCsv(projectId: number, trackerId: number) {
    const tracker = await this.findTracker(projectId, trackerId);
    const [fields, records] = await Promise.all([
      this.listFields(trackerId),
      this.recordRepo.find({ where: { projectId, trackerId } }),
    ]);
    const chartConfig = this.asPlainObject(tracker.chartConfig);
    const groupLevels = this.asStringArray(chartConfig.groupLevels).length
      ? this.asStringArray(chartConfig.groupLevels)
      : tracker.locationScopeTypes?.length
        ? tracker.locationScopeTypes
        : ['BLOCK', 'TOWER', 'FLOOR', 'UNIT'];
    const slicers = this.asPlainObject(chartConfig.slicers);
    const configuredValueKeys = this.asStringArray(chartConfig.valueFields);
    const numericFields = fields.filter((field) =>
      ['NUMBER', 'PERCENT', 'CURRENCY', 'FORMULA'].includes(field.fieldType),
    );
    const valueFields = configuredValueKeys.length
      ? numericFields.filter((field) => configuredValueKeys.includes(field.key))
      : numericFields.slice(0, 4);
    const categories = tracker.categoryConfig || [];
    const filteredRecords = records.filter((record) =>
      Object.entries(slicers).every(([key, value]) => {
        if (!value) return true;
        return (
          this.getTrackerGroupValue(record, key, categories) === String(value)
        );
      }),
    );
    const rows = this.flattenReportRows(
      this.buildReportPivotRows(
        filteredRecords,
        groupLevels,
        valueFields,
        categories,
      ),
    );
    const headers = [
      'Level',
      'Group',
      'Count',
      'Average Progress',
      ...valueFields.map((field) => `Sum ${field.label}`),
    ];
    const csvRows = rows.map((row) => [
      row.level + 1,
      row.label,
      row.count,
      row.averageProgress.toFixed(2),
      ...valueFields.map((field) => (row.sums[field.key] || 0).toFixed(2)),
    ]);
    return [headers, ...csvRows]
      .map((row) => row.map((value) => this.csvValue(value)).join(','))
      .join('\n');
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
      if (field.fieldType === 'FORMULA') return;
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
    fields
      .filter((field) => field.fieldType === 'FORMULA')
      .forEach((field) => {
        values[field.key] = this.evaluateFormula(field.formula, values);
      });
    return values;
  }

  private evaluateFormula(formula: string | null, values: Record<string, any>) {
    const expression = String(formula || '').trim();
    if (!expression) return null;
    if (!/^[a-zA-Z0-9_+\-*/().\s]+$/.test(expression)) {
      throw new BadRequestException(
        'Formula can only use field keys, numbers, and + - * / operators',
      );
    }
    const hydrated = expression.replace(
      /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g,
      (token) => {
        const value = Number(values[token]);
        return Number.isFinite(value) ? String(value) : '0';
      },
    );
    try {
      const result = this.evalArithmetic(hydrated);
      return Number.isFinite(result) ? result : null;
    } catch {
      throw new BadRequestException(`Invalid formula: ${expression}`);
    }
  }

  /** Safe arithmetic evaluator — no eval/Function. Handles +, -, *, /, parentheses. */
  private evalArithmetic(expr: string): number {
    let pos = 0;
    const skip = () => { while (expr[pos] === ' ') pos++; };
    const parseExpr = (): number => {
      let v = parseTerm();
      skip();
      while (expr[pos] === '+' || expr[pos] === '-') {
        const op = expr[pos++];
        const r = parseTerm();
        v = op === '+' ? v + r : v - r;
        skip();
      }
      return v;
    };
    const parseTerm = (): number => {
      let v = parsePrimary();
      skip();
      while (expr[pos] === '*' || expr[pos] === '/') {
        const op = expr[pos++];
        const r = parsePrimary();
        v = op === '*' ? v * r : v / r;
        skip();
      }
      return v;
    };
    const parsePrimary = (): number => {
      skip();
      if (expr[pos] === '(') {
        pos++;
        const v = parseExpr();
        skip();
        if (expr[pos] === ')') pos++;
        return v;
      }
      let s = '';
      if (expr[pos] === '-') s += expr[pos++];
      while (pos < expr.length && /[0-9.]/.test(expr[pos])) s += expr[pos++];
      const n = Number(s);
      if (!Number.isFinite(n)) throw new Error('bad number');
      return n;
    };
    const result = parseExpr();
    skip();
    if (pos !== expr.length) throw new Error('unexpected token');
    return result;
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

  private getTrackerGroupValue(
    record: PlanningCustomTrackerRecord,
    groupKey: string,
    categories: Array<{ key: string; label: string; options?: string[] }>,
  ) {
    const path = String(record.locationText || 'Unmapped')
      .split('>')
      .map((part) => part.trim())
      .filter(Boolean);
    const locationIndex = ['BLOCK', 'TOWER', 'FLOOR', 'UNIT', 'ROOM'].indexOf(
      groupKey,
    );
    if (locationIndex >= 0) return path[locationIndex] || 'Unmapped';
    if (groupKey === 'STATUS') return record.status;
    const category = categories.find((item) => item.key === groupKey);
    if (category) return record.categoryValues?.[category.key] || 'Unspecified';
    return 'Unspecified';
  }

  private buildReportPivotRows(
    records: PlanningCustomTrackerRecord[],
    groupLevels: string[],
    valueFields: PlanningCustomTrackerField[],
    categories: Array<{ key: string; label: string; options?: string[] }>,
  ) {
    type ReportRow = {
      key: string;
      label: string;
      level: number;
      count: number;
      averageProgress: number;
      sums: Record<string, number>;
      children: ReportRow[];
    };
    const roots: ReportRow[] = [];
    const index = new Map<string, ReportRow>();
    records.forEach((record) => {
      let branch = roots;
      let parentKey = '';
      groupLevels.forEach((groupKey, level) => {
        const label = this.getTrackerGroupValue(record, groupKey, categories);
        const key = `${parentKey}/${groupKey}:${label}`;
        let row = index.get(key);
        if (!row) {
          row = {
            key,
            label,
            level,
            count: 0,
            averageProgress: 0,
            sums: {},
            children: [],
          };
          index.set(key, row);
          branch.push(row);
        }
        row.count += 1;
        row.averageProgress += Number(record.progressPercent || 0);
        valueFields.forEach((field) => {
          const value = Number(record.values?.[field.key]);
          if (Number.isFinite(value)) {
            row!.sums[field.key] = (row!.sums[field.key] || 0) + value;
          }
        });
        branch = row.children;
        parentKey = key;
      });
    });
    const finalize = (rows: ReportRow[]) => {
      rows.forEach((row) => {
        row.averageProgress = row.count ? row.averageProgress / row.count : 0;
        finalize(row.children);
      });
    };
    finalize(roots);
    return roots;
  }

  private flattenReportRows<T extends { children: T[] }>(rows: T[]): T[] {
    return rows.flatMap((row) => [row, ...this.flattenReportRows(row.children)]);
  }

  private csvValue(value: unknown) {
    let text = String(value ?? '');
    // Neutralise CSV formula injection: prefix formula triggers with a literal quote
    // so spreadsheet apps (Excel, Google Sheets) treat the cell as plain text.
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
}
