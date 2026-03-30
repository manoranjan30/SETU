import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import * as xml2js from 'xml2js';
import { WbsNode } from './entities/wbs.entity';
import { ProjectProfile } from '../eps/project-profile.entity';

type ImportColumnMapping = Record<string, string>;

export interface WbsImportValidationResult {
  isValid: boolean;
  errors: string[];
  rowErrors: Record<number, string[]>;
}

export interface WbsImportPreviewSummary {
  totalRows: number;
  readyRows: number;
  skippedExistingRows: number;
  errorRows: number;
}

export interface WbsImportPreviewRow {
  __rowIndex: number;
  __rowNumber: number;
  wbscode?: string;
  wbsname?: string;
  parentwbscode?: string;
  iscontrolaccount?: string | boolean;
  activitycode?: string;
  activityname?: string;
  type?: string;
  duration?: string | number;
  responsiblerole?: string;
  responsibleuser?: string;
  importStatus?: 'READY' | 'SKIP_EXISTING' | 'ERROR';
  importMessage?: string;
}

@Injectable()
export class WbsImportService {
  constructor(
    @InjectRepository(WbsNode)
    private readonly wbsRepo: Repository<WbsNode>,
    @InjectRepository(ProjectProfile)
    private readonly profileRepo: Repository<ProjectProfile>,
  ) {}

  private readonly fieldDefinitions: Array<{
    key: keyof WbsImportPreviewRow;
    label: string;
    required?: boolean;
    aliases: string[];
  }> = [
    {
      key: 'wbscode',
      label: 'WBS Code',
      required: true,
      aliases: ['wbscode', 'wbs code', 'wbscode', 'code'],
    },
    {
      key: 'wbsname',
      label: 'WBS Name',
      required: true,
      aliases: ['wbsname', 'wbs name', 'name'],
    },
    {
      key: 'parentwbscode',
      label: 'Parent WBS Code',
      aliases: ['parentwbscode', 'parent wbs code', 'parent code'],
    },
    {
      key: 'iscontrolaccount',
      label: 'Control Account',
      aliases: [
        'iscontrolaccount',
        'is control account',
        'controlaccount',
        'control account',
      ],
    },
    {
      key: 'activitycode',
      label: 'Activity Code',
      aliases: ['activitycode', 'activity code'],
    },
    {
      key: 'activityname',
      label: 'Activity Name',
      aliases: ['activityname', 'activity name'],
    },
    {
      key: 'type',
      label: 'Type',
      aliases: ['type'],
    },
    {
      key: 'duration',
      label: 'Duration',
      aliases: ['duration', 'duration planned'],
    },
    {
      key: 'responsiblerole',
      label: 'Responsible Role',
      aliases: ['responsiblerole', 'responsible role'],
    },
    {
      key: 'responsibleuser',
      label: 'Responsible User',
      aliases: ['responsibleuser', 'responsible user'],
    },
  ];

  private normalizeHeader(value: string): string {
    return (value || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private normalizeCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }
    return String(value).trim();
  }

  private buildAutoMapping(headers: string[]): ImportColumnMapping {
    const mapping: ImportColumnMapping = {};
    const normalizedHeaders = headers.map((header) => ({
      source: header,
      normalized: this.normalizeHeader(header),
    }));

    for (const field of this.fieldDefinitions) {
      const exact = normalizedHeaders.find((header) =>
        field.aliases.includes(header.normalized),
      );
      if (exact) {
        mapping[String(field.key)] = exact.source;
        continue;
      }

      const fuzzy = normalizedHeaders.find((header) =>
        field.aliases.some(
          (candidate) =>
            header.normalized.includes(candidate) ||
            candidate.includes(header.normalized),
        ),
      );
      if (fuzzy) {
        mapping[String(field.key)] = fuzzy.source;
      }
    }

    return mapping;
  }

  private parseWorkbookRows(fileBuffer: Buffer): Record<string, unknown>[] {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
    });
  }

  private canonicalizeRows(
    rawRows: Record<string, unknown>[],
    mapping: ImportColumnMapping,
  ): WbsImportPreviewRow[] {
    return rawRows.map((row, index) => {
      const normalizedRow: WbsImportPreviewRow = {
        __rowIndex: index,
        __rowNumber: index + 2,
      };

      for (const field of this.fieldDefinitions) {
        const sourceHeader = mapping[String(field.key)];
        if (!sourceHeader) continue;
        ((normalizedRow as unknown) as Record<string, unknown>)[String(field.key)] =
          this.normalizeCell(row[sourceHeader]);
      }

      return normalizedRow;
    });
  }

  private resolveParentCode(
    row: WbsImportPreviewRow,
    projectPrefix: string,
  ): string | null {
    const explicitParent = this.normalizeCell(row.parentwbscode);
    if (explicitParent) {
      return explicitParent === projectPrefix ? null : explicitParent;
    }

    if (row.activitycode) {
      const activityParent = this.normalizeCell(row.wbscode);
      return activityParent || null;
    }

    const code = this.normalizeCell(row.wbscode);
    if (!code || !code.includes('.')) return null;
    const inferredParent = code.split('.').slice(0, -1).join('.');
    return inferredParent === projectPrefix ? null : inferredParent;
  }

  private async resolveProjectPrefix(projectId: number): Promise<string> {
    const profile = await this.profileRepo.findOne({
      where: { epsNode: { id: projectId } },
    });
    return profile?.projectCode || `PROJ-${projectId}`;
  }

  private toProjectScopedCode(rawCode: string, projectPrefix: string): string {
    const normalized = this.normalizeCell(rawCode);
    if (!normalized) return '';
    if (!projectPrefix) return normalized;
    if (
      normalized === projectPrefix ||
      normalized.startsWith(`${projectPrefix}.`)
    ) {
      return normalized;
    }
    return `${projectPrefix}.${normalized}`;
  }

  private applyProjectPrefix(
    rows: WbsImportPreviewRow[],
    projectPrefix: string,
  ): WbsImportPreviewRow[] {
    return rows.map((row) => {
      const nextRow: WbsImportPreviewRow = { ...row };
      const normalizedWbsCode = this.normalizeCell(row.wbscode);
      if (normalizedWbsCode) {
        nextRow.wbscode = this.toProjectScopedCode(
          normalizedWbsCode,
          projectPrefix,
        );
      }

      const normalizedParentCode = this.normalizeCell(row.parentwbscode);
      if (normalizedParentCode) {
        nextRow.parentwbscode = this.toProjectScopedCode(
          normalizedParentCode,
          projectPrefix,
        );
      }

      return nextRow;
    });
  }

  private buildRowErrors(
    data: WbsImportPreviewRow[],
    existingCodes: Set<string>,
    projectPrefix: string,
  ): WbsImportValidationResult {
    const errors: string[] = [];
    const rowErrors = new Map<number, string[]>();

    const addRowError = (row: WbsImportPreviewRow, message: string) => {
      const current = rowErrors.get(row.__rowIndex) || [];
      current.push(message);
      rowErrors.set(row.__rowIndex, current);
      errors.push(`Row ${row.__rowNumber}: ${message}`);
    };

    const wbsRows = data.filter((row) => !this.normalizeCell(row.activitycode));
    const fileCodes = new Map<string, WbsImportPreviewRow[]>();

    for (const row of wbsRows) {
      const code = this.normalizeCell(row.wbscode);
      if (!code) {
        addRowError(row, 'Missing WBS Code');
        continue;
      }

      const bucket = fileCodes.get(code) || [];
      bucket.push(row);
      fileCodes.set(code, bucket);
    }

    for (const [code, rows] of fileCodes.entries()) {
      if (rows.length > 1) {
        for (const row of rows) {
          addRowError(
            row,
            `Duplicate WBS Code '${code}' found in the uploaded file.`,
          );
        }
      }
    }

    const availableCodes = new Set<string>(existingCodes);
    for (const row of wbsRows) {
      const code = this.normalizeCell(row.wbscode);
      if (code) {
        availableCodes.add(code);
      }
    }

    for (const row of data) {
      if (!this.normalizeCell(row.wbscode)) {
        addRowError(row, 'Missing WBS Code');
      }

      if (!this.normalizeCell(row.wbsname)) {
        addRowError(row, 'Missing WBS Name');
      }

      const parentCode = this.resolveParentCode(row, projectPrefix);
      if (parentCode && !availableCodes.has(parentCode)) {
        addRowError(
          row,
          `Parent WBS Code '${parentCode}' was not found in the project or the uploaded file.`,
        );
      }

      const durationValue = this.normalizeCell(row.duration);
      if (durationValue) {
        const parsed = Number(durationValue);
        if (!Number.isFinite(parsed)) {
          addRowError(row, `Invalid Duration '${durationValue}'.`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      rowErrors: Object.fromEntries(rowErrors.entries()),
    };
  }

  private annotateRowStatuses(
    data: WbsImportPreviewRow[],
    validation: WbsImportValidationResult,
    existingCodes: Set<string>,
  ): WbsImportPreviewRow[] {
    return data.map((row) => {
      const rowValidationErrors = validation.rowErrors[row.__rowIndex] || [];
      if (rowValidationErrors.length > 0) {
        return {
          ...row,
          importStatus: 'ERROR',
          importMessage: rowValidationErrors[0],
        };
      }

      const code = this.normalizeCell(row.wbscode);
      if (!this.normalizeCell(row.activitycode) && code && existingCodes.has(code)) {
        return {
          ...row,
          importStatus: 'SKIP_EXISTING',
          importMessage: `WBS Code '${code}' already exists in this project and will be skipped.`,
        };
      }

      return {
        ...row,
        importStatus: 'READY',
        importMessage: 'Ready to import.',
      };
    });
  }

  private summarizeRows(data: WbsImportPreviewRow[]): WbsImportPreviewSummary {
    return data.reduce<WbsImportPreviewSummary>(
      (summary, row) => {
        summary.totalRows += 1;
        if (row.importStatus === 'READY') summary.readyRows += 1;
        if (row.importStatus === 'SKIP_EXISTING') summary.skippedExistingRows += 1;
        if (row.importStatus === 'ERROR') summary.errorRows += 1;
        return summary;
      },
      {
        totalRows: 0,
        readyRows: 0,
        skippedExistingRows: 0,
        errorRows: 0,
      },
    );
  }

  async parseAndPreview(
    projectId: number,
    fileBuffer: Buffer,
    mapping?: ImportColumnMapping,
  ) {
    const projectPrefix = await this.resolveProjectPrefix(projectId);
    const fileHeader = fileBuffer.slice(0, 5).toString('utf-8');
    let normalizedRows: WbsImportPreviewRow[];
    let effectiveMapping = mapping || {};

    if (fileHeader.trim().startsWith('<') || fileHeader.includes('<?xml')) {
      normalizedRows = (await this.parseXml(fileBuffer)).map((row, index) => ({
        __rowIndex: index,
        __rowNumber: index + 2,
        ...row,
      }));
    } else {
      const rawRows = this.parseWorkbookRows(fileBuffer);
      if (rawRows.length === 0) {
        throw new BadRequestException('Sheet is empty');
      }

      const headers = Object.keys(rawRows[0] || {});
      effectiveMapping =
        mapping && Object.keys(mapping).length > 0
          ? mapping
          : this.buildAutoMapping(headers);

      const missingRequired = this.fieldDefinitions
        .filter((field) => field.required)
        .filter((field) => !effectiveMapping[String(field.key)])
        .map((field) => field.label);

      if (missingRequired.length > 0) {
        throw new BadRequestException(
          `Missing required columns: ${missingRequired.join(', ')}`,
        );
      }

      normalizedRows = this.canonicalizeRows(rawRows, effectiveMapping);
    }

    normalizedRows = this.applyProjectPrefix(normalizedRows, projectPrefix);

    const existingNodes = await this.wbsRepo.find({
      where: { projectId },
      select: {
        id: true,
        wbsCode: true,
        wbsName: true,
        parentId: true,
        wbsLevel: true,
      },
    });
    const existingCodes = new Set(
      existingNodes.map((node) => this.normalizeCell(node.wbsCode)).filter(Boolean),
    );

    const validation = this.buildRowErrors(
      normalizedRows,
      existingCodes,
      projectPrefix,
    );
    const data = this.annotateRowStatuses(normalizedRows, validation, existingCodes);
    const summary = this.summarizeRows(data);

    return {
      data,
      validation,
      summary,
      mapping: effectiveMapping,
    };
  }

  private async parseXml(fileBuffer: Buffer) {
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: true,
    });
    try {
      const result = await parser.parseStringPromise(fileBuffer.toString());
      const project = result.Project || result.project;

      if (!project || !project.Tasks || !project.Tasks.Task) {
        throw new Error(
          'Invalid MSP XML Structure: Missing Project/Tasks/Task',
        );
      }

      let tasks = project.Tasks.Task;
      if (!Array.isArray(tasks)) tasks = [tasks];

      const parsedData: any[] = [];
      const taskMap = new Map<string, any>();

      tasks.forEach((t: any) => {
        const uid = t.UID;
        const name = t.Name;
        const durationStr = t.Duration;
        const start = t.Start;
        const finish = t.Finish;
        const wbs = t.WBS;
        const summary = t.Summary === '1';

        if (!name) return;

        let durationDays = 0;
        if (durationStr && durationStr.startsWith('PT')) {
          const hMatch = durationStr.match(/(\d+)H/);
          const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
          durationDays = Math.ceil(hours / 8);
        }

        const row: any = {
          wbscode: wbs,
          wbsname: name,
          activitycode: summary ? undefined : wbs || uid,
          activityname: name,
          duration: durationDays,
          startdateplanned: start,
          finishdateplanned: finish,
          type: summary ? 'WBS' : 'TASK',
        };

        parsedData.push(row);
        taskMap.set(uid, row);
      });

      tasks.forEach((t: any) => {
        if (t.PredecessorLink) {
          let preds = t.PredecessorLink;
          if (!Array.isArray(preds)) preds = [preds];

          const predList: string[] = [];
          preds.forEach((p: any) => {
            const pUid = p.PredecessorUID;
            const pTask = taskMap.get(pUid);
            if (pTask && pTask.activitycode) {
              predList.push(pTask.activitycode);
            }
          });

          if (predList.length > 0) {
            const myRow = taskMap.get(t.UID);
            if (myRow) myRow.predecessors = predList.join(';');
          }
        }
      });

      return parsedData;
    } catch (e) {
      throw new BadRequestException('Failed to parse XML: ' + e.message);
    }
  }
}
