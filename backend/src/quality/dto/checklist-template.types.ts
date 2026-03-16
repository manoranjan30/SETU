import { ChecklistItemType } from '../entities/quality-checklist-item-template.entity';

export interface SignatureSlotConfig {
  slotId: string;
  label: string;
  party: 'Contractor' | 'PL/PHL' | 'Consultant' | 'Client';
  role: string;
  required: boolean;
  sequence: number;
}

export interface ParsedChecklistHeaderField<T = string | boolean | null> {
  value: T;
  confidence: number;
}

export interface ParsedChecklistItemDto {
  id?: string;
  slNo: number | null;
  description: string;
  type: ChecklistItemType | 'YES_OR_NA' | 'YES_NO' | 'TEXT';
  confidence: number;
  isMandatory: boolean;
  photoRequired: boolean;
  holdPoint?: boolean;
  witnessPoint?: boolean;
}

export interface ParsedChecklistStageDto {
  id?: string;
  name: string;
  confidence: number;
  sequence: number;
  isHoldPoint: boolean;
  isWitnessPoint: boolean;
  responsibleParty: string;
  signatureSlots: SignatureSlotConfig[];
  items: ParsedChecklistItemDto[];
}

export interface ParsedChecklistPreviewDto {
  sourceName: string;
  sheetName: string;
  format: 'template' | 'freeform' | 'pdf';
  checklistNo: ParsedChecklistHeaderField<string | null>;
  revNo: ParsedChecklistHeaderField<string | null>;
  activityTitle: ParsedChecklistHeaderField<string | null>;
  activityType: ParsedChecklistHeaderField<string | null>;
  discipline: ParsedChecklistHeaderField<string | null>;
  applicableTrade: ParsedChecklistHeaderField<string | null>;
  isGlobal: ParsedChecklistHeaderField<boolean>;
  stages: ParsedChecklistStageDto[];
  signatureSlots: ParsedChecklistHeaderField<SignatureSlotConfig[]>;
  warnings: string[];
  overallConfidence: number;
  requiresClarification: boolean;
}

export interface ChecklistImportPreviewResponseDto {
  templates: ParsedChecklistPreviewDto[];
  requiresClarification: boolean;
}

export interface ItemWarningDto {
  approximateSlNo: number | null;
  description: string;
  warningType: 'possible_merge' | 'missing_number' | 'truncated_text';
  rawText: string;
}

export interface PdfParseResultDto {
  fields: {
    checklistNo: ParsedChecklistHeaderField<string | null>;
    revNo: ParsedChecklistHeaderField<string | null>;
    activityTitle: ParsedChecklistHeaderField<string | null>;
    activityType: ParsedChecklistHeaderField<string | null>;
    discipline: ParsedChecklistHeaderField<string | null>;
    applicableTrade: ParsedChecklistHeaderField<string | null>;
  };
  sections: ParsedChecklistStageDto[];
  signatureSlots: ParsedChecklistHeaderField<SignatureSlotConfig[]>;
  overallConfidence: number;
  requiresClarification: boolean;
  itemWarnings: ItemWarningDto[];
  parseMethod: 'digital' | 'ocr';
  warnings: string[];
}
