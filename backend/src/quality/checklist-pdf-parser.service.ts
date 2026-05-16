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

type PositionedToken = {
  str: string;
  x: number;
  y: number;
  w?: number;
  page?: number;
};

type PositionedLine = {
  text: string;
  page: number;
  y: number;
  minX: number;
  maxX: number;
  tokens: PositionedToken[];
};

type LayoutTableMetrics = {
  slNoX: number;
  descriptionLeft: number;
  descriptionRight: number;
  yesX: number;
};

@Injectable()
export class ChecklistPdfParserService {
  async parsePdf(buffer: Buffer): Promise<PdfParseResultDto> {
    const result = await pdfParse(buffer, {
      pagerender: this.renderPageTokens,
    });
    const text = result.text?.trim() ?? '';
    if (!text) {
      return this.buildLimitedSupportResult();
    }

    const positionedTokens = this.parsePositionedTokens(text);
    if (positionedTokens.length > 0) {
      const positionalResult = this.parseChecklistTextWithLayout(
        text,
        positionedTokens,
      );
      if (
        positionalResult.sections.some((section) => section.items.length > 0)
      ) {
        return positionalResult;
      }
    }

    return this.parseChecklistText(text);
  }

  private async renderPageTokens(pageData: any) {
    const textContent = await pageData.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: true,
    });

    return textContent.items
      .map((item: any) =>
        JSON.stringify({
          str: String(item.str ?? ''),
          x: Number(item.transform?.[4] ?? 0),
          y: Number(item.transform?.[5] ?? 0),
          w: Number(item.width ?? 0),
          page:
            Number(pageData.pageNumber ?? pageData.pageIndex ?? 0) || undefined,
        }),
      )
      .join('\n');
  }

  private parsePositionedTokens(text: string): PositionedToken[] {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('{') && line.endsWith('}'))
      .map((line) => {
        try {
          return JSON.parse(line) as PositionedToken;
        } catch {
          return null;
        }
      })
      .filter(
        (token): token is PositionedToken =>
          token !== null &&
          Boolean(token.str) &&
          Number.isFinite(token.x) &&
          Number.isFinite(token.y),
      );
  }

  private parseChecklistTextWithLayout(
    text: string,
    tokens: PositionedToken[],
  ): PdfParseResultDto {
    const lines = this.buildLinesFromTokens(tokens);
    if (lines.length === 0) {
      return this.parseChecklistText(text);
    }

    const plainLines = lines.map((line) => this.cleanLine(line.text)).filter(Boolean);
    const knownFormat = plainLines.some((line) =>
      /(PURAVANKARA|PROVIDENT)/i.test(line),
    );
    const checklistNo = this.extractField(
      plainLines.join('\n'),
      /Checklist\s*No[:\s]+([A-Z0-9.\-\/]+)/i,
      95,
    );
    const revNo = this.extractField(
      plainLines.join('\n'),
      /Rev(?:\.|ision)?\s*No[:\s]+([A-Z0-9.\-\/]+)/i,
      92,
    );
    const activityTitle = this.extractActivityTitle(plainLines);
    const activityType = this.extractActivityType(plainLines);
    const inferred = this.inferDisciplineAndTrade(
      activityTitle.value,
      activityType.value,
    );
    const discipline = this.extractField(
      plainLines.join('\n'),
      /Discipline[:\s]+([A-Z\s/&-]{3,})/i,
      72,
    );
    const applicableTrade = this.extractField(
      plainLines.join('\n'),
      /(?:Applicable\s+Trade|Trade)[:\s]+([A-Z\s/&-]{2,})/i,
      72,
    );

    const sections = this.detectSectionsFromLayout(lines);
    const itemWarnings = this.detectItemWarnings(sections);
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
      signatureSlots: { value: [], confidence: 100 },
      overallConfidence: knownFormat
        ? Math.min(100, overallConfidence + 8)
        : overallConfidence,
      requiresClarification: overallConfidence < 85 || warnings.length > 0,
      itemWarnings,
      parseMethod: 'digital',
      warnings,
    };
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
    const activityType = this.extractActivityType(lines);
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
      signatureSlots: { value: [], confidence: 100 },
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

    return sections;
  }

  private buildLinesFromTokens(tokens: PositionedToken[]): PositionedLine[] {
    const sorted = [...tokens].sort((left, right) => {
      const pageDiff = (left.page ?? 0) - (right.page ?? 0);
      if (pageDiff !== 0) return pageDiff;
      const yDiff = right.y - left.y;
      if (Math.abs(yDiff) > 2.5) return yDiff;
      return left.x - right.x;
    });

    const groups: PositionedLine[] = [];
    for (const token of sorted) {
      const value = String(token.str ?? '').trim();
      if (!value) continue;

      const existing = groups.find(
        (line) =>
          (line.tokens[0]?.page ?? 0) === (token.page ?? 0) &&
          Math.abs(line.y - token.y) <= 2.6,
      );

      if (existing) {
        existing.tokens.push({ ...token, str: value });
        existing.minX = Math.min(existing.minX, token.x);
        existing.maxX = Math.max(existing.maxX, token.x + (token.w ?? 0));
      } else {
        groups.push({
          text: value,
          page: token.page ?? 0,
          y: token.y,
          minX: token.x,
          maxX: token.x + (token.w ?? 0),
          tokens: [{ ...token, str: value }],
        });
      }
    }

    return groups
      .map((group) => {
        const ordered = [...group.tokens].sort((left, right) => left.x - right.x);
        return {
          ...group,
          text: ordered.map((token) => token.str).join(' ').replace(/\s+/g, ' ').trim(),
          tokens: ordered,
        };
      })
      .filter((group) => group.text.length > 0);
  }

  private detectSectionsFromLayout(lines: PositionedLine[]): ParsedChecklistStageDto[] {
    const tableMetrics = this.findLayoutTableMetrics(lines);
    const headings = lines
      .filter((line) => this.isExecutionStageHeading(line.text))
      .sort((left, right) => this.compareDocumentPosition(left, right));

    const itemRows = lines
      .map((line) => {
        const serialToken = line.tokens.find((token) => {
          const value = token.str?.trim() || '';
          if (!/^\d{1,3}$/.test(value)) return false;
          if (!tableMetrics) return token.x <= 120;
          return token.x <= tableMetrics.descriptionLeft - 4;
        });
        const slMatch = serialToken?.str?.trim().match(/^\d{1,3}$/);
        if (!slMatch) return null;
        return {
          slNo: Number(slMatch[0]),
          page: line.page,
          y: line.y,
          text: line.text,
        };
      })
      .filter(
        (
          row,
        ): row is { slNo: number; page: number; y: number; text: string } =>
          Boolean(row),
      )
      .sort((left, right) => this.compareDocumentPosition(left, right));

    const descriptionLines = lines
      .filter((line) => this.isChecklistDescriptionLine(line, tableMetrics))
      .sort((left, right) => this.compareDocumentPosition(left, right));

    const items = itemRows
      .map((row, index) => {
        const nextY = itemRows[index + 1]?.y ?? -Infinity;
        const matchedLines = descriptionLines
          .filter((line) => line.y <= row.y + 8 && line.y > nextY + 2)
          .map((line) => this.cleanDescription(line.text))
          .filter(Boolean);

        const inlineDescription = this.extractInlineChecklistDescription(row.text);
        const description = this.composeChecklistDescription(
          matchedLines,
          inlineDescription,
        );
        if (!description) return null;

        return {
          slNo: row.slNo,
          page: row.page,
          y: row.y,
          description,
          type: ChecklistItemType.YES_OR_NA as ChecklistItemType,
          confidence: 92,
          isMandatory: true,
          photoRequired: false,
        };
      })
      .filter(
        (
          item,
        ): item is {
          slNo: number;
          page: number;
          y: number;
          description: string;
          type: ChecklistItemType;
          confidence: number;
          isMandatory: boolean;
          photoRequired: boolean;
        } => Boolean(item),
      );

    if (items.length === 0) {
      return [];
    }

    const stages: ParsedChecklistStageDto[] = [];
    if (headings.length === 0) {
      stages.push({
        name: 'General',
        confidence: 70,
        sequence: 0,
        isHoldPoint: false,
        isWitnessPoint: false,
        responsibleParty: 'Contractor',
        signatureSlots: [],
        items: items.map(({ y: _y, ...item }) => item),
      });
      return stages;
    }

    const orderedHeadings = headings.sort((left, right) =>
      this.compareDocumentPosition(left, right),
    );
    const assignedItemNumbers = new Set<number>();
    const leadingItems = items
      .filter(
        (item) => this.compareDocumentPosition(item, orderedHeadings[0]) < 0,
      )
      .map(({ page: _page, y: _y, ...item }) => item);

    if (leadingItems.length > 0) {
      leadingItems.forEach((item) => assignedItemNumbers.add(item.slNo));
      stages.push({
        name: 'General Checks',
        confidence: 72,
        sequence: 0,
        isHoldPoint: false,
        isWitnessPoint: false,
        responsibleParty: 'Contractor',
        signatureSlots: [],
        items: leadingItems,
      });
    }

    orderedHeadings.forEach((heading, index) => {
      const nextHeading = orderedHeadings[index + 1] ?? null;
      const stageItems = items
        .filter(
          (item) =>
            this.compareDocumentPosition(item, heading) > 0 &&
            (!nextHeading ||
              this.compareDocumentPosition(item, nextHeading) < 0) &&
            !assignedItemNumbers.has(item.slNo),
        )
        .map(({ page: _page, y: _y, ...item }) => item);

      stageItems.forEach((item) => assignedItemNumbers.add(item.slNo));

      stages.push({
        name: heading.text,
        confidence: this.sectionConfidence(heading.text),
        sequence: stages.length,
        isHoldPoint: false,
        isWitnessPoint: false,
        responsibleParty: 'Contractor',
        signatureSlots: [],
        items: stageItems,
      });
    });

    const dedupedStages = stages.map((stage) => {
      const seen = new Set<number>();
      return {
        ...stage,
        items: stage.items.filter((item) => {
          if (item.slNo === null) return true;
          if (seen.has(item.slNo)) return false;
          seen.add(item.slNo);
          return true;
        }),
      };
    });

    return dedupedStages.filter(
      (stage, index) =>
        stage.items.length > 0 || index < orderedHeadings.length,
    );
  }

  private isExecutionStageHeading(text: string) {
    const normalized = this.cleanLine(text).toUpperCase();
    return /^(PRE-EXECUTION CHECKS|CHECKS DURING EXECUTION|POST-EXECUTION CHECKS)$/.test(
      normalized,
    );
  }

  private isChecklistDescriptionLine(
    line: PositionedLine,
    tableMetrics: LayoutTableMetrics | null,
  ) {
    const text = this.cleanLine(line.text);
    if (!text) return false;
    if (tableMetrics) {
      if (line.minX < tableMetrics.descriptionLeft - 6) return false;
      if (line.minX > tableMetrics.descriptionRight - 24) return false;
      if (line.maxX > tableMetrics.descriptionRight + 30) return false;
    } else if (line.minX < 85 || line.minX > 360) {
      return false;
    }
    if (this.isExecutionStageHeading(text)) return false;
    if (this.isFooterLine(text) || this.isSignatureLine(text)) return false;
    if (this.looksLikeMetadataLine(text)) return false;
    if (/^\d{1,3}$/.test(text)) return false;
    if (/^\[\s*\]$/.test(text)) return false;
    if (/^(DESCRIPTION|PROJECT|LOCATION|CONTRACTOR|DATE|DWG NO|SL NO|YES|NA|REMARKS|ACTIVITY)/i.test(text)) {
      return false;
    }
    return text.length > 4;
  }

  private findLayoutTableMetrics(
    lines: PositionedLine[],
  ): LayoutTableMetrics | null {
    const headerLine = lines.find((line) => {
      const text = this.cleanLine(line.text).toUpperCase();
      return (
        /SL\s*NO/.test(text) &&
        /DESCRIPTION/.test(text) &&
        /YES/.test(text) &&
        /NA/.test(text)
      );
    });
    if (!headerLine) return null;

    const sortedTokens = [...headerLine.tokens].sort((left, right) => left.x - right.x);
    const slNoToken = sortedTokens.find((token) => /SL/i.test(token.str));
    const descriptionToken = sortedTokens.find((token) =>
      /DESCRIPTION/i.test(token.str),
    );
    const yesToken = sortedTokens.find((token) => /^YES$/i.test(token.str));
    if (!slNoToken || !descriptionToken || !yesToken) {
      return null;
    }

    const slNoX = slNoToken.x;
    const yesX = yesToken.x;
    const descriptionLeft = Math.min(descriptionToken.x, slNoX + 32);
    const descriptionRight = yesX - 18;

    return {
      slNoX,
      descriptionLeft,
      descriptionRight,
      yesX,
    };
  }

  private compareDocumentPosition(
    left: { page?: number; y: number },
    right: { page?: number; y: number },
  ) {
    const pageDiff = (left.page ?? 0) - (right.page ?? 0);
    if (pageDiff !== 0) return pageDiff;
    if (Math.abs(left.y - right.y) <= 2.5) return 0;
    return right.y - left.y;
  }

  private extractInlineChecklistDescription(text: string) {
    return this.cleanDescription(
      text
        .replace(/^\d{1,3}\s*/, '')
        .replace(/\[\s*\]/g, '')
        .replace(/\b(YES|NO|NA|N\/A|REMARKS)\b/gi, ''),
    );
  }

  private composeChecklistDescription(
    matchedLines: string[],
    inlineDescription: string,
  ) {
    const cleanedInline = inlineDescription.trim();
    const joinedMatched = matchedLines.join(' ').replace(/\s+/g, ' ').trim();
    const lowerInline = cleanedInline.toLowerCase();
    const lowerMatched = joinedMatched.toLowerCase();

    if (joinedMatched && cleanedInline) {
      if (
        /^[a-z]/.test(cleanedInline) &&
        matchedLines.length > 0
      ) {
        return joinedMatched;
      }
      if (lowerMatched.includes(lowerInline)) {
        return joinedMatched;
      }
      if (lowerInline.includes(lowerMatched) && lowerMatched.length > 12) {
        return cleanedInline;
      }
      return `${joinedMatched} ${cleanedInline}`.replace(/\s+/g, ' ').trim();
    }

    return joinedMatched || cleanedInline || '';
  }

  private looksLikeMetadataLine(text: string) {
    return /^(CHECKLIST NO|REV\.? NO|DATE|DWG NO|PROJECT|LOCATION|CONTRACTOR|NOTE|PURAVANKARA|CHECKLIST FOR|ACTIVITY\s*:)/i.test(
      text,
    );
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

  private extractActivityType(
    lines: string[],
  ): ParsedChecklistHeaderField<string | null> {
    for (const line of lines.slice(0, 12)) {
      const match = line.match(/^ACTIVITY\s*:\s*(.+)$/i);
      if (match?.[1]) {
        return { value: match[1].trim(), confidence: 88 };
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
