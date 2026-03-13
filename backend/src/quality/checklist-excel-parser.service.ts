import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import {
  ChecklistImportPreviewResponseDto,
  ParsedChecklistHeaderField,
  ParsedChecklistPreviewDto,
  ParsedChecklistStageDto,
  PdfParseResultDto,
  SignatureSlotConfig,
} from './dto/checklist-template.types';
import { ChecklistItemType } from './entities/quality-checklist-item-template.entity';

type RowValue = string | number | boolean | null | undefined;
type ParsedRow = string[];

interface KeywordInference {
  discipline: string | null;
  applicableTrade: string | null;
}

@Injectable()
export class ChecklistExcelParserService {
  parseWorkbook(
    buffer: Buffer,
    sourceName: string,
  ): ChecklistImportPreviewResponseDto {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer', cellStyles: true });
    } catch {
      throw new BadRequestException('Invalid Excel file');
    }

    const templates = workbook.SheetNames.map((sheetName) =>
      this.parseSheet(workbook.Sheets[sheetName], sourceName, sheetName),
    );

    return {
      templates,
      requiresClarification: templates.some(
        (template) => template.requiresClarification,
      ),
    };
  }

  toPreviewFromPdf(
    sourceName: string,
    result: PdfParseResultDto,
  ): ParsedChecklistPreviewDto {
    return {
      sourceName,
      sheetName: sourceName,
      format: 'pdf',
      checklistNo: result.fields.checklistNo,
      revNo: result.fields.revNo,
      activityTitle: result.fields.activityTitle,
      activityType: result.fields.activityType,
      discipline: result.fields.discipline,
      applicableTrade: result.fields.applicableTrade,
      isGlobal: { value: false, confidence: 100 },
      stages: result.sections,
      signatureSlots: result.signatureSlots,
      warnings: result.warnings.concat(
        result.itemWarnings.map((item) => item.description),
      ),
      overallConfidence: result.overallConfidence,
      requiresClarification: result.requiresClarification,
    };
  }

  private parseSheet(
    sheet: XLSX.WorkSheet,
    sourceName: string,
    sheetName: string,
  ): ParsedChecklistPreviewDto {
    const rows = XLSX.utils.sheet_to_json<RowValue[]>(sheet, {
      header: 1,
      raw: false,
      blankrows: false,
      defval: '',
    });

    if (rows.length === 0) {
      throw new BadRequestException(`Sheet "${sheetName}" is empty`);
    }

    const format = this.detectSheetFormat(rows);
    return format === 'template'
      ? this.parseTemplateSheet(rows, sourceName, sheetName)
      : this.parseFreeformSheet(rows, sourceName, sheetName);
  }

  private detectSheetFormat(rows: RowValue[][]): 'template' | 'freeform' {
    const a1 = String(rows[0]?.[0] ?? '').trim().toLowerCase();
    if (a1 === 'checklistno') {
      return 'template';
    }

    const row2 = (rows[1] ?? []).map((value) =>
      String(value ?? '').trim().toLowerCase(),
    );
    if (['slno', 'section', 'description'].every((key) => row2.includes(key))) {
      return 'template';
    }

    return 'freeform';
  }

  private parseTemplateSheet(
    rows: RowValue[][],
    sourceName: string,
    sheetName: string,
  ): ParsedChecklistPreviewDto {
    const metadataHeaders = (rows[0] ?? []).map((cell) => this.normalize(cell));
    const metadataValues = rows[1] ?? [];
    const dataHeaders = (rows[2] ?? []).map((cell) => this.normalize(cell));
    const dataRows = rows.slice(3);

    const meta = new Map<string, string>();
    metadataHeaders.forEach((header, index) => {
      if (header) {
        meta.set(header, String(metadataValues[index] ?? '').trim());
      }
    });

    const indexByHeader = new Map<string, number>();
    dataHeaders.forEach((header, index) => {
      if (header) {
        indexByHeader.set(header, index);
      }
    });

    const sections = new Map<string, ParsedChecklistStageDto>();
    for (const row of dataRows) {
      const description = String(
        row[indexByHeader.get('description') ?? -1] ?? '',
      ).trim();
      if (!description) continue;

      const sectionName =
        String(row[indexByHeader.get('section') ?? -1] ?? '').trim() || 'General';
      const section = sections.get(sectionName) ?? {
        name: sectionName,
        confidence: 100,
        sequence: sections.size,
        isHoldPoint: false,
        isWitnessPoint: false,
        responsibleParty: 'Contractor',
        signatureSlots: this.parseSignatureSlots(
          String(row[indexByHeader.get('signatureslots') ?? -1] ?? ''),
        ),
        items: [],
      };

      const itemTypeRaw = String(
        row[indexByHeader.get('type') ?? -1] ?? '',
      ).trim();
      section.items.push({
        slNo: this.toNumber(row[indexByHeader.get('slno') ?? -1]),
        description,
        type: this.mapItemType(itemTypeRaw),
        confidence: 100,
        isMandatory: this.toBoolean(row[indexByHeader.get('mandatory') ?? -1]),
        photoRequired: this.toBoolean(
          row[indexByHeader.get('photorequired') ?? -1],
        ),
        holdPoint: this.toBoolean(row[indexByHeader.get('holdpoint') ?? -1]),
        witnessPoint: this.toBoolean(
          row[indexByHeader.get('witnesspoint') ?? -1],
        ),
      });
      sections.set(sectionName, section);
    }

    return {
      sourceName,
      sheetName,
      format: 'template',
      checklistNo: { value: meta.get('checklistno') ?? sheetName, confidence: 100 },
      revNo: { value: meta.get('revno') ?? '01', confidence: 100 },
      activityTitle: {
        value: meta.get('activitytitle') ?? meta.get('name') ?? sheetName,
        confidence: 100,
      },
      activityType: { value: meta.get('activitytype') ?? '', confidence: 100 },
      discipline: { value: meta.get('discipline') ?? '', confidence: 100 },
      applicableTrade: {
        value: meta.get('applicabletrade') ?? '',
        confidence: 100,
      },
      isGlobal: {
        value: this.toBoolean(meta.get('isglobal')),
        confidence: 100,
      },
      stages: Array.from(sections.values()),
      signatureSlots: { value: [], confidence: 100 },
      warnings: [],
      overallConfidence: 100,
      requiresClarification: false,
    };
  }

  private parseFreeformSheet(
    rows: RowValue[][],
    sourceName: string,
    sheetName: string,
  ): ParsedChecklistPreviewDto {
    const parsedRows = rows.map((row) =>
      row.map((value) => this.cleanCell(value)).filter((value) => value.length > 0),
    );
    const allLines = parsedRows
      .slice(0, 15)
      .map((row) => row.join(' '))
      .filter(Boolean);
    const knownFormat = allLines.some((line) =>
      /(PURAVANKARA|PROVIDENT)/i.test(line),
    );

    const checklistNo = this.extractLabeledValue(
      rows,
      /checklist\s*(no|number|#)|cl\.?\s*no/i,
    );
    const revNo = this.extractLabeledValue(
      rows,
      /rev(?:ision)?\s*(no|number|#|\.|:)?/i,
    );
    const activityType = this.extractLabeledValue(rows, /^activity$/i);
    const discipline = this.extractLabeledValue(rows, /discipline|disc\./i);
    const applicableTrade = this.extractLabeledValue(
      rows,
      /applicable\s*trade|trade/i,
    );
    const activityTitle = this.extractTitle(rows);
    const inferred = this.inferDisciplineAndTrade(
      activityTitle.value,
      activityType.value,
    );

    const stages: ParsedChecklistStageDto[] = [];
    const warnings: string[] = [];
    const signatureSlots = this.extractSignatureSlotsFromRows(parsedRows);
    const tableHeaderIndex = this.findChecklistHeaderRow(parsedRows);
    const itemType = this.detectDefaultItemType(parsedRows, tableHeaderIndex);

    if (tableHeaderIndex === -1) {
      warnings.push(
        'Checklist table header was not detected clearly. Parsed output may need review.',
      );
    }

    let currentStage: ParsedChecklistStageDto | null = null;
    let lastItem: ParsedChecklistStageDto['items'][number] | null = null;
    const startIndex = tableHeaderIndex === -1 ? 0 : tableHeaderIndex + 1;

    for (let index = startIndex; index < parsedRows.length; index += 1) {
      const row = parsedRows[index];
      if (row.length === 0) continue;

      const rowText = row.join(' ');
      if (this.isSignatureRow(rowText) || this.isFooterRow(rowText)) {
        continue;
      }

      const sectionName = this.extractSectionHeading(row);
      if (sectionName) {
        currentStage = {
          name: sectionName,
          confidence: this.scoreSectionHeading(sectionName),
          sequence: stages.length,
          isHoldPoint: false,
          isWitnessPoint: false,
          responsibleParty: 'Contractor',
          signatureSlots: [],
          items: [],
        };
        stages.push(currentStage);
        lastItem = null;
        continue;
      }

      const item = this.parseFreeformItemRow(row, itemType);
      if (item) {
        if (!currentStage) {
          currentStage = {
            name: 'General',
            confidence: 70,
            sequence: stages.length,
            isHoldPoint: false,
            isWitnessPoint: false,
            responsibleParty: 'Contractor',
            signatureSlots: [],
            items: [],
          };
          stages.push(currentStage);
          warnings.push(
            'Items were detected before any section header. Grouped under "General".',
          );
        }
        currentStage.items.push(item);
        lastItem = item;
        continue;
      }

      if (
        lastItem &&
        this.isLikelyContinuationRow(row) &&
        !this.looksLikeMetadataRow(rowText)
      ) {
        lastItem.description = `${lastItem.description} ${row.join(' ')}`.trim();
      }
    }

    const targetStage =
      stages.find((stage) => stage.items.length > 0) ?? stages[stages.length - 1];
    if (targetStage && signatureSlots.length > 0) {
      targetStage.signatureSlots = signatureSlots;
    }

    const sequenceWarnings = this.detectSequenceWarnings(stages);
    warnings.push(...sequenceWarnings);
    if (stages.length === 0) {
      warnings.push('No checklist items were detected in the uploaded sheet.');
    }

    const overallConfidence = this.minConfidence([
      checklistNo.confidence,
      revNo.confidence,
      activityTitle.confidence,
      Math.max(activityType.confidence, activityTitle.confidence - 5),
      Math.max(discipline.confidence, inferred.discipline ? 70 : 35),
      Math.max(applicableTrade.confidence, inferred.applicableTrade ? 70 : 35),
      ...stages.map((stage) => stage.confidence),
      signatureSlots.length > 0 ? 90 : 50,
    ]);

    const boostedOverall = knownFormat
      ? Math.min(100, overallConfidence + 10)
      : overallConfidence;

    return {
      sourceName,
      sheetName,
      format: 'freeform',
      checklistNo: this.boostField(checklistNo, knownFormat),
      revNo: this.boostField(revNo, knownFormat),
      activityTitle: this.boostField(activityTitle, knownFormat),
      activityType: this.boostField(
        activityType.value
          ? activityType
          : {
              value: this.deriveActivityType(activityTitle.value),
              confidence: activityTitle.value ? 72 : 35,
            },
        knownFormat,
      ),
      discipline: this.boostField(
        discipline.value
          ? discipline
          : { value: inferred.discipline, confidence: inferred.discipline ? 70 : 35 },
        knownFormat,
      ),
      applicableTrade: this.boostField(
        applicableTrade.value
          ? applicableTrade
          : {
              value: inferred.applicableTrade,
              confidence: inferred.applicableTrade ? 70 : 35,
            },
        knownFormat,
      ),
      isGlobal: { value: false, confidence: 100 },
      stages,
      signatureSlots: {
        value: signatureSlots,
        confidence: signatureSlots.length > 0 ? 90 : 45,
      },
      warnings,
      overallConfidence: boostedOverall,
      requiresClarification: boostedOverall < 85 || warnings.length > 0,
    };
  }

  private findChecklistHeaderRow(rows: ParsedRow[]) {
    return rows.findIndex((row) => {
      const normalized = row.map((cell) => this.normalize(cell));
      return (
        normalized.some((cell) => ['slno', 'slnumber', 'sl'].includes(cell)) &&
        normalized.some((cell) => cell.includes('description')) &&
        normalized.some((cell) => ['yes', 'na', 'no', 'remarks'].includes(cell))
      );
    });
  }

  private detectDefaultItemType(rows: ParsedRow[], headerIndex: number) {
    const headerRow = rows[headerIndex] ?? [];
    const normalized = headerRow.map((cell) => this.normalize(cell));
    return normalized.includes('no')
      ? ChecklistItemType.YES_NO
      : ChecklistItemType.YES_OR_NA;
  }

  private extractLabeledValue(
    rows: RowValue[][],
    pattern: RegExp,
  ): ParsedChecklistHeaderField<string | null> {
    for (const row of rows.slice(0, 15)) {
      const cleaned = row.map((value) => this.cleanCell(value));
      for (let index = 0; index < cleaned.length; index += 1) {
        const raw = cleaned[index];
        if (!raw) continue;
        if (!pattern.test(raw)) continue;

        const inlineValue = raw
          .replace(pattern, '')
          .replace(/^[:\-.#\s]+/, '')
          .trim();
        if (inlineValue) {
          return { value: inlineValue, confidence: 92 };
        }

        const right = cleaned[index + 1]?.replace(/^[:\-.#\s]+/, '').trim();
        if (right) {
          return { value: right, confidence: 88 };
        }

        const fullRow = cleaned.join(' ');
        const colonSplit = fullRow.split(':');
        if (colonSplit.length > 1) {
          const candidate = colonSplit.slice(1).join(':').trim();
          if (candidate) {
            return { value: candidate, confidence: 84 };
          }
        }
      }
    }

    return { value: null, confidence: 30 };
  }

  private extractTitle(rows: RowValue[][]): ParsedChecklistHeaderField<string | null> {
    for (const row of rows.slice(0, 8)) {
      const line = row
        .map((cell) => this.cleanCell(cell))
        .filter(Boolean)
        .join(' ');
      if (!line) continue;

      const checklistMatch = line.match(/CHECKLIST\s*(?:FOR|-)\s*(.+)/i);
      if (checklistMatch?.[1]) {
        return { value: checklistMatch[1].trim(), confidence: 92 };
      }

      if (/^CHECKLIST\b/i.test(line)) {
        return { value: line.trim(), confidence: 80 };
      }
    }

    return { value: null, confidence: 35 };
  }

  private deriveActivityType(activityTitle: string | null) {
    if (!activityTitle) return null;
    return activityTitle
      .replace(/^CHECKLIST\s*(?:FOR|-)\s*/i, '')
      .trim();
  }

  private inferDisciplineAndTrade(
    activityTitle: string | null,
    activityType: string | null,
  ): KeywordInference {
    const corpus = `${activityTitle ?? ''} ${activityType ?? ''}`.toUpperCase();
    const map: Array<{
      pattern: RegExp;
      discipline: string;
      trade: string;
    }> = [
      {
        pattern: /GLAZING|ACP|FACADE|ALUMINIUM/,
        discipline: 'Finishing',
        trade: 'Structural Glazing',
      },
      {
        pattern: /CONCRET|RCC|REINFORCEMENT|SHUTTER/i,
        discipline: 'Structural',
        trade: 'RCC',
      },
      {
        pattern: /PLUMBING|SANITARY|DRAINAGE/,
        discipline: 'MEP',
        trade: 'Plumbing',
      },
      {
        pattern: /ELECTRICAL|ELV|LIGHTING/,
        discipline: 'MEP',
        trade: 'Electrical',
      },
      {
        pattern: /PAINT|PLASTER|TILE|FLOORING/,
        discipline: 'Finishing',
        trade: 'Finishes',
      },
    ];

    const match = map.find((entry) => entry.pattern.test(corpus));
    if (!match) {
      return { discipline: null, applicableTrade: null };
    }

    return {
      discipline: match.discipline,
      applicableTrade: match.trade,
    };
  }

  private extractSectionHeading(row: ParsedRow) {
    const longestCell = row.reduce(
      (best, cell) => (cell.length > best.length ? cell : best),
      '',
    );
    const normalized = longestCell.trim();
    if (!normalized) return null;
    if (!this.isSectionHeading(normalized)) return null;
    if (/CHECKLIST|DESCRIPTION|REMARKS|NOTE/i.test(normalized)) return null;
    return normalized;
  }

  private isSectionHeading(text: string) {
    return (
      /^[A-Z0-9\s\-\/&()]{5,}$/.test(text.trim()) &&
      !/^\d/.test(text.trim()) &&
      text.trim() === text.trim().toUpperCase()
    );
  }

  private scoreSectionHeading(text: string) {
    if (
      /PRE-EXECUTION|DURING EXECUTION|POST-EXECUTION|POST EXECUTION|BEFORE COMMENCEMENT|MATERIAL/i.test(
        text,
      )
    ) {
      return 96;
    }
    return 82;
  }

  private parseFreeformItemRow(
    row: ParsedRow,
    defaultType: ChecklistItemType,
  ) {
    const serialIndex = row.findIndex((cell) => /^\d{1,3}$/.test(cell));
    if (serialIndex === -1) return null;

    const slNo = Number(row[serialIndex]);
    const rawDescription = row
      .slice(serialIndex + 1)
      .filter((cell) => !this.isCheckboxCell(cell) && !this.isMarkerCell(cell))
      .join(' ')
      .trim();
    const description = this.cleanDescription(rawDescription);
    if (!description || description.length < 4) {
      return null;
    }

    return {
      slNo,
      description,
      type: defaultType,
      confidence: 92,
      isMandatory: true,
      photoRequired: false,
    };
  }

  private isLikelyContinuationRow(row: ParsedRow) {
    if (row.some((cell) => /^\d{1,3}$/.test(cell))) return false;
    if (row.some((cell) => this.isCheckboxCell(cell))) return false;
    const text = row.join(' ').trim();
    if (!text) return false;
    return text.length > 12;
  }

  private extractSignatureSlotsFromRows(rows: ParsedRow[]) {
    const text = rows.flat().join(' ');
    return this.extractSignatureSlots(text);
  }

  private extractSignatureSlots(text: string): SignatureSlotConfig[] {
    const definitions: Array<[RegExp, SignatureSlotConfig]> = [
      [
        /contractor\s+site\s+in\s+charge|site\s+in\s+charge/i,
        {
          slotId: 'site_in_charge',
          label: 'Contractor Site In Charge',
          party: 'Contractor',
          role: 'SITE_ENGINEER',
          required: true,
          sequence: 1,
        },
      ],
      [
        /contractor\s+qa\/qc\s+incharge|qa\/qc\s+incharge|qc\s+engineer|quality\s+engineer/i,
        {
          slotId: 'contractor_qaqc',
          label: 'Contractor QA/QC Incharge',
          party: 'Contractor',
          role: 'QC_ENGINEER',
          required: true,
          sequence: 2,
        },
      ],
      [
        /puravankara.*qa\s*&\s*pe\s+incharge|qa\s*&\s*pe|qa\s+&\s+pe/i,
        {
          slotId: 'qa_pe',
          label: 'Puravankara QA & PE Incharge',
          party: 'PL/PHL',
          role: 'QA_PE',
          required: true,
          sequence: 3,
        },
      ],
      [
        /consultant/i,
        {
          slotId: 'consultant',
          label: 'Consultant',
          party: 'Consultant',
          role: 'CONSULTANT',
          required: true,
          sequence: 4,
        },
      ],
      [
        /client/i,
        {
          slotId: 'client',
          label: 'Client',
          party: 'Client',
          role: 'CLIENT',
          required: true,
          sequence: 5,
        },
      ],
    ];

    return definitions
      .filter(([pattern]) => pattern.test(text))
      .map(([, slot], index) => ({ ...slot, sequence: index + 1 }));
  }

  private isSignatureRow(text: string) {
    return /(site in charge|qa\/qc|qa\s*&\s*pe|signature|consultant|client)/i.test(
      text,
    );
  }

  private isFooterRow(text: string) {
    return /^(name|date|signature)\s*:?\s*$/i.test(text) || /^note[:\s]/i.test(text);
  }

  private looksLikeMetadataRow(text: string) {
    return /(project|location|contractor|checklist|rev|activity|date|dwg)/i.test(
      text,
    );
  }

  private detectSequenceWarnings(stages: ParsedChecklistStageDto[]) {
    const warnings: string[] = [];
    for (const stage of stages) {
      const numbers = stage.items
        .map((item) => item.slNo)
        .filter((value): value is number => typeof value === 'number');
      for (let index = 1; index < numbers.length; index += 1) {
        if (numbers[index] !== numbers[index - 1] + 1) {
          warnings.push(
            `Section "${stage.name}" has non-sequential item numbering.`,
          );
          break;
        }
      }
    }
    return warnings;
  }

  private parseSignatureSlots(raw: string): SignatureSlotConfig[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private mapItemType(raw: string): ChecklistItemType {
    const normalized = raw.trim().toUpperCase();
    if (normalized in ChecklistItemType) {
      return ChecklistItemType[normalized as keyof typeof ChecklistItemType];
    }
    return ChecklistItemType.YES_OR_NA;
  }

  private cleanCell(value: RowValue) {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .replace(/[□■]/g, '')
      .trim();
  }

  private cleanDescription(value: string) {
    return value
      .replace(/\[\s*\]/g, '')
      .replace(/\b(YES|NO|NA|N\/A|REMARKS)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isCheckboxCell(value: string) {
    return /^\[?\s*[xX]?\s*\]?$/.test(value) || /^(YES|NO|NA|N\/A)$/i.test(value);
  }

  private isMarkerCell(value: string) {
    return /^(REMARKS?|YES|NO|NA|N\/A)$/i.test(value);
  }

  private normalize(value: RowValue) {
    return String(value ?? '')
      .trim()
      .replace(/[^a-z0-9]+/gi, '')
      .toLowerCase();
  }

  private toBoolean(value: RowValue) {
    return ['true', 'yes', '1'].includes(
      String(value ?? '').trim().toLowerCase(),
    );
  }

  private toNumber(value: RowValue) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private minConfidence(values: number[]) {
    return values.length === 0 ? 0 : Math.min(...values);
  }

  private boostField<T>(
    field: ParsedChecklistHeaderField<T>,
    knownFormat: boolean,
  ) {
    return {
      value: field.value,
      confidence: knownFormat
        ? Math.min(100, field.confidence + 10)
        : field.confidence,
    };
  }
}
