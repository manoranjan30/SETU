import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  AdminDataCorrection,
  AdminDataCorrectionAction,
} from './admin-data-correction.entity';

type ColumnMeta = {
  name: string;
  dataType: string;
  udtName: string;
  isNullable: boolean;
  isPrimary: boolean;
  isEditable: boolean;
};

type RequestMeta = {
  userId?: number | null;
  username?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const BLOCKED_TABLES = new Set([
  'admin_data_corrections',
  'audit_logs',
  'migrations',
  'auth_otp_challenges',
  'quality_signature_qr_sessions',
  'notification_log',
  'plugin_audit_log',
]);
const BLOCKED_TABLE_PATTERNS = [/token/i, /session/i, /otp/i, /password/i];
const BLOCKED_COLUMN_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /hash/i,
  /otp/i,
  /signatureData/i,
];

@Injectable()
export class AdminDataService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AdminDataCorrection)
    private readonly correctionRepo: Repository<AdminDataCorrection>,
  ) {}

  async listTables() {
    const rows = await this.dataSource.query(`
      SELECT
        c.table_name AS "tableName",
        obj_description(format('%I.%I', c.table_schema, c.table_name)::regclass) AS "description",
        COALESCE(s.n_live_tup, 0)::bigint AS "estimatedRows"
      FROM information_schema.tables c
      LEFT JOIN pg_stat_user_tables s ON s.relname = c.table_name
      WHERE c.table_schema = 'public'
        AND c.table_type = 'BASE TABLE'
      ORDER BY c.table_name ASC
    `);

    return rows
      .map((row: any) => ({
        ...row,
        isEditable: this.isTableEditable(row.tableName),
        reason:
          this.isTableEditable(row.tableName) ? null : 'Protected system table',
      }))
      .filter((row: any) => !row.tableName.startsWith('pg_'));
  }

  async describeTable(tableName: string) {
    this.assertSafeTableName(tableName);
    const columns = await this.getColumns(tableName);
    const primaryKey = columns.find((column) => column.isPrimary);
    return {
      tableName,
      isEditable: this.isTableEditable(tableName),
      primaryKeyColumn: primaryKey?.name || null,
      columns,
    };
  }

  async listRows(tableName: string, limit = 50, offset = 0, q?: string) {
    const descriptor = await this.describeTable(tableName);
    const primaryKey = this.requireSinglePrimaryKey(descriptor.columns);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const tableSql = this.quoteIdentifier(tableName);
    const pkSql = this.quoteIdentifier(primaryKey.name);
    const params: any[] = [];
    let whereSql = '';

    if (q?.trim()) {
      params.push(`%${q.trim()}%`);
      whereSql = `WHERE to_jsonb(t)::text ILIKE $${params.length}`;
    }

    params.push(safeLimit, safeOffset);
    const rows = await this.dataSource.query(
      `
        SELECT t.*
        FROM ${tableSql} t
        ${whereSql}
        ORDER BY t.${pkSql} DESC
        LIMIT $${params.length - 1}
        OFFSET $${params.length}
      `,
      params,
    );
    const countParams = q?.trim() ? [params[0]] : [];
    const countRows = await this.dataSource.query(
      `
        SELECT COUNT(*)::int AS "total"
        FROM ${tableSql} t
        ${whereSql}
      `,
      countParams,
    );

    return {
      ...descriptor,
      rows: rows.map((row: Record<string, unknown>) =>
        this.redactSensitiveRow(row, descriptor.columns),
      ),
      total: Number(countRows?.[0]?.total || 0),
      limit: safeLimit,
      offset: safeOffset,
    };
  }

  async updateRow(
    tableName: string,
    primaryKeyValue: string,
    changes: Record<string, unknown>,
    reason: string,
    meta: RequestMeta,
  ) {
    this.assertEditableTable(tableName);
    const trimmedReason = reason?.trim();
    if (!trimmedReason || trimmedReason.length < 8) {
      throw new BadRequestException('Correction reason must be at least 8 characters.');
    }
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
      throw new BadRequestException('Changes must be an object.');
    }

    return this.applyUpdate({
      tableName,
      primaryKeyValue,
      changes,
      reason: trimmedReason,
      actionType: AdminDataCorrectionAction.UPDATE,
      revertedFromCorrectionId: null,
      meta,
    });
  }

  async listCorrections(tableName?: string, primaryKeyValue?: string) {
    const query = this.correctionRepo
      .createQueryBuilder('correction')
      .orderBy('correction.createdAt', 'DESC')
      .take(100);

    if (tableName) {
      this.assertSafeTableName(tableName);
      query.andWhere('correction.tableName = :tableName', { tableName });
    }
    if (primaryKeyValue) {
      query.andWhere('correction.primaryKeyValue = :primaryKeyValue', {
        primaryKeyValue,
      });
    }
    const corrections = await query.getMany();
    return corrections.map((correction) => ({
      ...correction,
      beforeData: this.redactSensitiveRow(correction.beforeData),
      afterData: this.redactSensitiveRow(correction.afterData),
      changedFields: this.redactSensitiveChangedFields(correction.changedFields),
    }));
  }

  async revertCorrection(id: number, reason: string, meta: RequestMeta) {
    const correction = await this.correctionRepo.findOne({ where: { id } });
    if (!correction) throw new NotFoundException('Correction log not found.');
    this.assertEditableTable(correction.tableName);
    const trimmedReason = reason?.trim();
    if (!trimmedReason || trimmedReason.length < 8) {
      throw new BadRequestException('Revert reason must be at least 8 characters.');
    }

    const revertChanges: Record<string, unknown> = {};
    for (const columnName of Object.keys(correction.changedFields || {})) {
      revertChanges[columnName] = correction.beforeData[columnName];
    }

    return this.applyUpdate({
      tableName: correction.tableName,
      primaryKeyValue: correction.primaryKeyValue,
      changes: revertChanges,
      reason: trimmedReason,
      actionType: AdminDataCorrectionAction.REVERT,
      revertedFromCorrectionId: correction.id,
      meta,
    });
  }

  private async applyUpdate({
    tableName,
    primaryKeyValue,
    changes,
    reason,
    actionType,
    revertedFromCorrectionId,
    meta,
  }: {
    tableName: string;
    primaryKeyValue: string;
    changes: Record<string, unknown>;
    reason: string;
    actionType: AdminDataCorrectionAction;
    revertedFromCorrectionId: number | null;
    meta: RequestMeta;
  }) {
    const columns = await this.getColumns(tableName);
    const primaryKey = this.requireSinglePrimaryKey(columns);
    const editableColumns = new Map(
      columns.filter((column) => column.isEditable).map((column) => [column.name, column]),
    );
    const filteredChanges: Record<string, unknown> = {};

    for (const [columnName, value] of Object.entries(changes)) {
      const column = editableColumns.get(columnName);
      if (!column) {
        throw new BadRequestException(`Column "${columnName}" cannot be edited.`);
      }
      filteredChanges[columnName] = this.normalizeValue(value, column);
    }

    const changeEntries = Object.entries(filteredChanges);
    if (changeEntries.length === 0) {
      throw new BadRequestException('At least one editable field must be changed.');
    }

    const tableSql = this.quoteIdentifier(tableName);
    const pkSql = this.quoteIdentifier(primaryKey.name);

    return this.dataSource.transaction(async (manager) => {
      const beforeRows = await manager.query(
        `SELECT * FROM ${tableSql} WHERE ${pkSql} = $1 FOR UPDATE`,
        [primaryKeyValue],
      );
      const before = beforeRows[0];
      if (!before) throw new NotFoundException('Target row not found.');

      const effectiveChanges: Record<string, unknown> = {};
      const changedFields: Record<string, { before: unknown; after: unknown }> = {};
      for (const [columnName, value] of changeEntries) {
        const previous = before[columnName] ?? null;
        const next = value ?? null;
        if (JSON.stringify(previous) !== JSON.stringify(next)) {
          effectiveChanges[columnName] = value;
          changedFields[columnName] = { before: previous, after: next };
        }
      }

      if (Object.keys(effectiveChanges).length === 0) {
        throw new BadRequestException('No actual data changes detected.');
      }

      const setSql = Object.keys(effectiveChanges)
        .map((columnName, idx) => `${this.quoteIdentifier(columnName)} = $${idx + 1}`)
        .join(', ');
      const values = Object.values(effectiveChanges);
      values.push(primaryKeyValue);

      const afterRows = await manager.query(
        `
          UPDATE ${tableSql}
          SET ${setSql}
          WHERE ${pkSql} = $${values.length}
          RETURNING *
        `,
        values,
      );
      const after = afterRows[0];

      const correction = manager.getRepository(AdminDataCorrection).create({
        tableName,
        primaryKeyColumn: primaryKey.name,
        primaryKeyValue: String(primaryKeyValue),
        actionType,
        beforeData: this.redactSensitiveRow(before, columns),
        afterData: this.redactSensitiveRow(after, columns),
        changedFields: this.redactSensitiveChangedFields(changedFields),
        reason,
        revertedFromCorrectionId,
        createdByUserId: meta.userId ?? null,
        createdByName: meta.username ?? null,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
      });

      const savedCorrection = await manager
        .getRepository(AdminDataCorrection)
        .save(correction);

      return { row: after, correction: savedCorrection };
    });
  }

  private async getColumns(tableName: string): Promise<ColumnMeta[]> {
    this.assertSafeTableName(tableName);
    const rows = await this.dataSource.query(
      `
        SELECT
          c.column_name AS "name",
          c.data_type AS "dataType",
          c.udt_name AS "udtName",
          c.is_nullable = 'YES' AS "isNullable",
          EXISTS (
            SELECT 1
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema = 'public'
              AND tc.table_name = c.table_name
              AND kcu.column_name = c.column_name
          ) AS "isPrimary"
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = $1
        ORDER BY c.ordinal_position ASC
      `,
      [tableName],
    );
    if (rows.length === 0) throw new NotFoundException('Table not found.');
    return rows.map((row: any) => ({
      ...row,
      isEditable:
        this.isTableEditable(tableName) &&
        !row.isPrimary &&
        !this.isSensitiveColumn(row.name),
    }));
  }

  private requireSinglePrimaryKey(columns: ColumnMeta[]) {
    const primaryKeys = columns.filter((column) => column.isPrimary);
    if (primaryKeys.length !== 1) {
      throw new BadRequestException(
        'Only tables with one primary key column can be edited in this console.',
      );
    }
    return primaryKeys[0];
  }

  private normalizeValue(value: unknown, column: ColumnMeta) {
    if (value === '') {
      return column.isNullable ? null : value;
    }
    if (value == null) {
      if (!column.isNullable) {
        throw new BadRequestException(`Column "${column.name}" cannot be null.`);
      }
      return null;
    }
    if (
      ['integer', 'bigint', 'smallint'].includes(column.dataType) ||
      ['int2', 'int4', 'int8'].includes(column.udtName)
    ) {
      const parsed = Number(value);
      if (!Number.isInteger(parsed)) {
        throw new BadRequestException(`Column "${column.name}" requires an integer.`);
      }
      return parsed;
    }
    if (
      ['numeric', 'real', 'double precision'].includes(column.dataType) ||
      ['float4', 'float8'].includes(column.udtName)
    ) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        throw new BadRequestException(`Column "${column.name}" requires a number.`);
      }
      return parsed;
    }
    if (column.dataType === 'boolean') {
      if (typeof value === 'boolean') return value;
      if (String(value).toLowerCase() === 'true') return true;
      if (String(value).toLowerCase() === 'false') return false;
      throw new BadRequestException(`Column "${column.name}" requires true or false.`);
    }
    if (column.dataType === 'jsonb' || column.dataType === 'json') {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          throw new BadRequestException(`Column "${column.name}" requires valid JSON.`);
        }
      }
      return value;
    }
    return value;
  }

  private assertEditableTable(tableName: string) {
    this.assertSafeTableName(tableName);
    if (!this.isTableEditable(tableName)) {
      throw new ForbiddenException('This table is protected from data editor changes.');
    }
  }

  private isTableEditable(tableName: string) {
    return (
      IDENTIFIER_RE.test(tableName) &&
      !BLOCKED_TABLES.has(tableName) &&
      !BLOCKED_TABLE_PATTERNS.some((pattern) => pattern.test(tableName))
    );
  }

  private isSensitiveColumn(columnName: string) {
    return BLOCKED_COLUMN_PATTERNS.some((pattern) => pattern.test(columnName));
  }

  private redactSensitiveRow(
    row: Record<string, unknown>,
    columns?: ColumnMeta[],
  ): Record<string, unknown> {
    const columnNames = columns?.map((column) => column.name) || Object.keys(row);
    const redacted = { ...row };
    for (const columnName of columnNames) {
      if (this.isSensitiveColumn(columnName) && columnName in redacted) {
        redacted[columnName] = '[PROTECTED]';
      }
    }
    return redacted;
  }

  private redactSensitiveChangedFields(
    changedFields: Record<string, { before: unknown; after: unknown }>,
  ) {
    const redacted: Record<string, { before: unknown; after: unknown }> = {};
    for (const [columnName, value] of Object.entries(changedFields || {})) {
      redacted[columnName] = this.isSensitiveColumn(columnName)
        ? { before: '[PROTECTED]', after: '[PROTECTED]' }
        : value;
    }
    return redacted;
  }

  private assertSafeTableName(tableName: string) {
    if (!IDENTIFIER_RE.test(tableName)) {
      throw new BadRequestException('Invalid table name.');
    }
  }

  private quoteIdentifier(identifier: string) {
    if (!IDENTIFIER_RE.test(identifier)) {
      throw new BadRequestException('Invalid SQL identifier.');
    }
    return `"${identifier.replace(/"/g, '""')}"`;
  }
}
