import { BadRequestException, Injectable } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import {
  ItemWarningDto,
  ParsedChecklistHeaderField,
  ParsedChecklistStageDto,
  PdfParseResultDto,
  SignatureSlotConfig,
} from './dto/checklist-template.types';
import { ChecklistItemType } from './entities/quality-checklist-item-template.entity';

@Injectable()
export class ChecklistPdfParserService {
  async parsePdf(buffer: Buffer): Promise<PdfParseResultDto> {
    const result = await pdfParse(buffer);
    const text = result.text?.trim() ?? '';
    if (!text) {
      return this.buildLimitedSupportResult();
    }

    return this.parseChecklistText(text);
  }

  private parseChecklistText(text: string): PdfParseResultDto {
    const lines = text
      .split(/\r?\n/)
      .map((line) => this.cleanLine(line))
      .filter(Boolean);

    if (lines.length === 0) {
      throw new BadRequestException(
        'PDF does not contain readable checklist content',
      );
    }

    const knownFormat = lines.some((line) =>
      /(PURAVANKARA|PROVIDENT)/i.test(line),
    );
    const checklistNo = this.extractField(
      text,
      /Checklist\s*No[:\s]+([A-Z0-9.\-\/]+)/i,
      95,
    );
    const revNo = this.extractField(
      text,
      /Rev(?:\.|ision)?\s*No[:\s]+([A-Z0-9.\-\/]+)/i,
      92,
    );
    const activityTitle = this.extractActivityTitle(lines);
    const activityType = this.extractField(
      text,
      /Activity[:\s]+([A-Z0-9\s/&\-()]{3,})/i,
      88,
    );
    const inferred = this.inferDisciplineAndTrade(
      activityTitle.value,
      activityType.value,
    );
    const discipline = this.extractField(
      text,
      /Discipline[:\s]+([A-Z\s/&-]{3,})/i,
      72,
    );
    const applicableTrade = this.extractField(
      text,
      /(?:Applicable\s+Trade|Trade)[:\s]+([A-Z\s/&-]{2,})/i,
      72,
    );

    const sections = this.detectSections(lines);
    const itemWarnings = this.detectItemWarnings(sections);
    const signatureSlots = this.detectSignatureSlots(text);
    const warnings: string[] = [];

    if (sections.length === 0) {
      warnings.push('No checklist rows could be detected from the PDF text.');
    }
    if (!knownFormat) {
      warnings.push(
        'Puravankara letterhead was not detected. Manual confirmation is recommended.',
      );
    }
    if (itemWarnings.length > 0) {
      warnings.push('Some PDF rows may require manual review.');
    }

    const overallConfidence = this.minConfidence([
      checklistNo.confidence,
      revNo.confidence,
      activityTitle.confidence,
      activityType.value ? activityType.confidence : activityTitle.confidence - 10,
      discipline.value ? discipline.confidence : inferred.discipline ? 68 : 35,
      applicableTrade.value
        ? applicableTrade.confidence
        : inferred.applicableTrade
          ? 68
          : 35,
      signatureSlots.confidence,
      ...sections.map((section) => section.confidence),
    ]);

    return {
      fields: {
        checklistNo: this.boostField(checklistNo, knownFormat),
        revNo: this.boostField(revNo, knownFormat),
        activityTitle: this.boostField(activityTitle, knownFormat),
        activityType: this.boostField(
          activityType.value
            ? activityType
            : {
                value: this.deriveActivityType(activityTitle.value),
                confidence: activityTitle.value ? 76 : 35,
              },
          knownFormat,
        ),
        discipline: this.boostField(
          discipline.value
            ? discipline
            : { value: inferred.discipline, confidence: inferred.discipline ? 68 : 35 },
          knownFormat,
        ),
        applicableTrade: this.boostField(
          applicableTrade.value
            ? applicableTrade
            : {
                value: inferred.applicableTrade,
                confidence: inferred.applicableTrade ? 68 : 35,
              },
          knownFormat,
        ),
      },
      sections,
      signatureSlots,
      overallConfidence: knownFormat
        ? Math.min(100, overallConfidence + 8)
        : overallConfidence,
      requiresClarification: overallConfidence < 85 || warnings.length > 0,
      itemWarnings,
      parseMethod: 'digital',
      warnings,
    };
  }

  private detectSections(lines: string[]): ParsedChecklistStageDto[] {
    const sections: ParsedChecklistStageDto[] = [];
    const itemType = lines.some((line) => /\bNO\b/.test(line))
      ? ChecklistItemType.YES_NO
      : ChecklistItemType.YES_OR_NA;

    let current: ParsedChecklistStageDto | null = null;
    let index = this.findTableStart(lines);
    if (index === -1) {
      index = 0;
    } else {
      index += 1;
    }

    while (index < lines.length) {
      const line = lines[index];
      if (!line || this.isFooterLine(line) || this.isSignatureLine(line)) {
        index += 1;
        continue;
      }

      if (this.isSectionHeading(line)) {
        current = {
          name: line,
          confidence: this.sectionConfidence(line),
          sequence: sections.length,
          isHoldPoint: false,
          isWitnessPoint: false,
          responsibleParty: 'Contractor',
          signatureSlots: [],
          items: [],
        };
        sections.push(current);
        index += 1;
        continue;
      }

      const itemMatch = line.match(/^(\d{1,3})[.)\s-]+(.+)$/);
      if (!itemMatch) {
        if (
          current?.items.length &&
          this.isLikelyContinuation(line) &&
          !this.isSectionHeading(line)
        ) {
          const lastItem = current.items[current.items.length - 1];
          lastItem.description = `${lastItem.description} ${this.cleanDescription(line)}`.trim();
        }
        index += 1;
        continue;
      }

      if (!current) {
        current = {
          name: 'General',
          confidence: 65,
          sequence: sections.length,
          isHoldPoint: false,
          isWitnessPoint: false,
          responsibleParty: 'Contractor',
          signatureSlots: [],
          items: [],
        };
        sections.push(current);
      }

      let description = this.cleanDescription(itemMatch[2]);
      let lookahead = index + 1;
      while (lookahead < lines.length) {
        const next = lines[lookahead];
        if (
          !next ||
          this.isFooterLine(next) ||
          this.isSignatureLine(next) ||
          this.isSectionHeading(next) ||
          /^(\d{1,3})[.)\s-]+/.test(next)
        ) {
          break;
        }

        if (this.isLikelyContinuation(next)) {
          description = `${description} ${this.cleanDescription(next)}`.trim();
        }
        lookahead += 1;
      }

      current.items.push({
        slNo: Number(itemMatch[1]),
        description,
        type: itemType,
        confidence: 90,
        isMandatory: true,
        photoRequired: false,
      });
      index = lookahead;
    }

    const slots = this.detectSignatureSlots(lines.join(' ')).value;
    const targetSection =
      sections.find((section) => section.items.length > 0) ??
      sections[sections.length - 1];
    if (targetSection && slots.length > 0) {
      targetSection.signatureSlots = slots;
    }

    return sections;
  }

  private findTableStart(lines: string[]) {
    return lines.findIndex(
      (line) =>
        /SL\s*NO/i.test(line) &&
        /DESCRIPTION/i.test(line) &&
        /(YES|NO|NA)/i.test(line),
    );
  }

  private detectItemWarnings(sections: ParsedChecklistStageDto[]): ItemWarningDto[] {
    const warnings: ItemWarningDto[] = [];
    for (const section of sections) {
      let previous: number | null = null;
      for (const item of section.items) {
        if (typeof item.slNo !== 'number') continue;
        if (previous !== null && item.slNo !== previous + 1) {
          warnings.push({
            approximateSlNo: item.slNo,
            description: `Item numbering gap detected near ${item.slNo} in "${section.name}"`,
            warningType: 'missing_number',
            rawText: item.description,
          });
        }
        if (item.description.length > 220) {
          warnings.push({
            approximateSlNo: item.slNo,
            description: `Item ${item.slNo} may contain merged text`,
            warningType: 'possible_merge',
            rawText: item.description,
          });
        }
        previous = item.slNo;
      }
    }
    return warnings;
  }

  private detectSignatureSlots(text: string) {
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
        /puravankara.*qa\s*&\s*pe\s+incharge|qa\s*&\s*pe/i,
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

    const slots = definitions
      .filter(([pattern]) => pattern.test(text))
      .map(([, slot], index) => ({ ...slot, sequence: index + 1 }));

    return {
      value: slots,
      confidence: slots.length > 0 ? 90 : 45,
    };
  }

  private extractField(
    text: string,
    regex: RegExp,
    hitConfidence: number,
  ): ParsedChecklistHeaderField<string | null> {
    const match = text.match(regex);
    if (!match) {
      return { value: null, confidence: 35 };
    }
    return { value: match[1].trim(), confidence: hitConfidence };
  }

  private extractActivityTitle(
    lines: string[],
  ): ParsedChecklistHeaderField<string | null> {
    for (const line of lines.slice(0, 10)) {
      const match = line.match(/CHECKLIST\s*(?:FOR|-)\s*(.+)/i);
      if (match?.[1]) {
        return { value: match[1].trim(), confidence: 92 };
      }
    }
    return { value: null, confidence: 35 };
  }

  private deriveActivityType(activityTitle: string | null) {
    if (!activityTitle) return null;
    return activityTitle.replace(/^CHECKLIST\s*(?:FOR|-)\s*/i, '').trim();
  }

  private inferDisciplineAndTrade(
    activityTitle: string | null,
    activityType: string | null,
  ) {
    const corpus = `${activityTitle ?? ''} ${activityType ?? ''}`.toUpperCase();
    const map: Array<{ pattern: RegExp; discipline: string; trade: string }> = [
      {
        pattern: /GLAZING|ACP|FACADE|ALUMINIUM/,
        discipline: 'Finishing',
        trade: 'Structural Glazing',
      },
      {
        pattern: /CONCRET|RCC|REINFORCEMENT|SHUTTER/,
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
    return {
      discipline: match?.discipline ?? null,
      applicableTrade: match?.trade ?? null,
    };
  }

  private isSectionHeading(line: string) {
    const trimmed = line.trim();
    return (
      trimmed === trimmed.toUpperCase() &&
      /^[A-Z0-9\s\-\/&()]{5,}$/.test(trimmed) &&
      !/^\d/.test(trimmed) &&
      !/(CHECKLIST NO|REV|DATE|DESCRIPTION|REMARKS|PROJECT|LOCATION|CONTRACTOR)/i.test(
        trimmed,
      )
    );
  }

  private sectionConfidence(line: string) {
    return /PRE-EXECUTION|POST-EXECUTION|DURING EXECUTION|CHECKS/i.test(line)
      ? 95
      : 82;
  }

  private isLikelyContinuation(line: string) {
    return (
      line.length > 10 &&
      !/^\d{1,3}$/.test(line) &&
      !/\b(NAME|DATE|SIGNATURE)\b/i.test(line)
    );
  }

  private isFooterLine(line: string) {
    return /^(NOTE|NAME|DATE|SIGNATURE)\b/i.test(line);
  }

  private isSignatureLine(line: string) {
    return /(site in charge|qa\/qc|qa\s*&\s*pe|consultant|client|signature)/i.test(
      line,
    );
  }

  private cleanDescription(value: string) {
    return value
      .replace(/\[\s*\]/g, '')
      .replace(/\b(YES|NO|NA|N\/A|REMARKS)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanLine(value: string) {
    return value.replace(/\s+/g, ' ').trim();
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
        ? Math.min(100, field.confidence + 8)
        : field.confidence,
    };
  }

  private buildLimitedSupportResult(): PdfParseResultDto {
    return {
      fields: {
        checklistNo: { value: null, confidence: 20 },
        revNo: { value: null, confidence: 20 },
        activityTitle: { value: null, confidence: 20 },
        activityType: { value: null, confidence: 20 },
        discipline: { value: null, confidence: 20 },
        applicableTrade: { value: null, confidence: 20 },
      },
      sections: [],
      signatureSlots: { value: [], confidence: 20 },
      overallConfidence: 20,
      requiresClarification: true,
      itemWarnings: [],
      parseMethod: 'ocr',
      warnings: [
        'This PDF does not contain extractable text. OCR hardening is not implemented in this phase.',
      ],
    };
  }
}
