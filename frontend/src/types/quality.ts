export const QualityType = {
  OBSERVATION: "OBSERVATION",
  SNAG: "SNAG",
  INCIDENT: "INCIDENT",
} as const;
export type QualityType = (typeof QualityType)[keyof typeof QualityType];

export const QualityStatus = {
  DRAFT: "DRAFT",
  OPEN: "OPEN",
  SENT_FOR_RECTIFICATION: "SENT_FOR_RECTIFICATION",
  RECTIFICATION_PENDING: "RECTIFICATION_PENDING",
  RECTIFIED: "RECTIFIED",
  VERIFICATION_PENDING: "VERIFICATION_PENDING",
  VERIFIED: "VERIFIED",
  CLOSED: "CLOSED",
  REJECTED: "REJECTED",
} as const;
export type QualityStatus = (typeof QualityStatus)[keyof typeof QualityStatus];

export const QualityPriority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type QualityPriority =
  (typeof QualityPriority)[keyof typeof QualityPriority];

export interface QualityHistory {
  id: number;
  qualityItemId: number;
  fromStatus: string;
  toStatus: string;
  actionBy: string;
  remarks?: string;
  timestamp: string;
}

export interface QualityPhoto {
  id: number;
  snagId: number;
  url: string;
  type: "INITIAL" | "RECTIFIED" | "VERIFIED";
  uploadedBy?: string;
  uploadedAt: string;
}

export interface QualityItem {
  id: number;
  projectId: number;
  type: QualityType;

  // Links
  epsNodeId?: number;
  locationName?: string;
  boqItemId?: number;

  description: string;
  trade?: string;

  status: QualityStatus;
  priority: QualityPriority;

  // Workflow
  pendingActionRole?: string;
  pendingUserId?: string;
  dueDate?: string;

  // People
  raisedBy?: string;
  assignedTo?: string;
  rectifiedBy?: string;
  verifiedBy?: string;
  closedBy?: string;

  // Timestamps
  rectifiedAt?: string;
  verifiedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;

  // Evidence
  photos: QualityPhoto[];
  history: QualityHistory[];

  // Frontend compatibility
  defectDescription?: string; // Mapped from description
}

// Re-export old types for compatibility (aliased)
export type SnagStatus = QualityStatus;
export const SnagStatus = QualityStatus; // Alias the value object
export type SnagPriority = QualityPriority;
export const SnagPriority = QualityPriority;
export type QualitySnag = QualityItem;
export type SnagPhoto = QualityPhoto;

export interface BuildPreviewDto {
  unitCount: number;
  naming: {
    prefix: string;
    startNumber: number;
    increment?: number;
    pad?: number;
  };
  defaultRooms?: Array<{ name: string; roomType?: string }>;
}

export interface BuildApplyDto {
  replaceExisting?: boolean;
  units: Array<{
    name: string;
    code?: string;
    rooms: Array<{ name: string; code?: string; roomType?: string }>;
  }>;
}

export interface CopyStructureDto {
  sourceFloorId: number;
  targetFloorIds: number[];
  collisionMode?: "REPLACE" | "SKIP" | "FAIL";
  naming?: {
    mode?: "KEEP" | "FLOOR_PREFIX_REMAP" | "REPLACE_PREFIX";
    sourcePrefix?: string;
  };
}

export interface QualityRoomNode {
  id: number;
  unitId: number;
  name: string;
  code?: string | null;
  roomType?: string | null;
  sequence: number;
}

export interface QualityUnitNode {
  id: number;
  floorStructureId: number;
  name: string;
  code?: string | null;
  sequence: number;
  rooms: QualityRoomNode[];
}

export interface QualityFloorStructure {
  id?: number;
  projectId: number;
  floorId: number;
  units: QualityUnitNode[];
}

// === SEQUENCER ===
export interface NodePositionDto {
  id: number;
  position: { x: number; y: number };
}

export interface EdgeDto {
  sourceId: number;
  targetId: number;
  constraintType: "HARD" | "SOFT";
  lagMinutes?: number;
}

export interface UpdateGraphDto {
  nodes: NodePositionDto[];
  edges: EdgeDto[];
}

export interface SignatureSlotConfig {
  slotId: string;
  label: string;
  party: "Contractor" | "PL/PHL" | "Consultant" | "Client";
  role: string;
  required: boolean;
  sequence: number;
}

export interface ChecklistHeaderField<T = string | boolean | null> {
  value: T;
  confidence: number;
}

export interface ChecklistImportItem {
  id?: string;
  slNo: number | null;
  description: string;
  type: "YES_OR_NA" | "YES_NO" | "TEXT" | "NUMERIC" | "DROPDOWN" | "PHOTO_ONLY";
  confidence: number;
  isMandatory: boolean;
  photoRequired: boolean;
  holdPoint?: boolean;
  witnessPoint?: boolean;
}

export interface ChecklistImportStage {
  id?: string;
  name: string;
  confidence: number;
  sequence: number;
  isHoldPoint: boolean;
  isWitnessPoint: boolean;
  responsibleParty: string;
  signatureSlots: SignatureSlotConfig[];
  items: ChecklistImportItem[];
}

export interface ParsedChecklistPreview {
  sourceName: string;
  sheetName: string;
  format: "template" | "freeform" | "pdf";
  checklistNo: ChecklistHeaderField<string | null>;
  revNo: ChecklistHeaderField<string | null>;
  activityTitle: ChecklistHeaderField<string | null>;
  activityType: ChecklistHeaderField<string | null>;
  discipline: ChecklistHeaderField<string | null>;
  applicableTrade: ChecklistHeaderField<string | null>;
  isGlobal: ChecklistHeaderField<boolean>;
  stages: ChecklistImportStage[];
  signatureSlots: ChecklistHeaderField<SignatureSlotConfig[]>;
  warnings: string[];
  overallConfidence: number;
  requiresClarification: boolean;
}

export interface ChecklistImportPreviewResponse {
  templates: ParsedChecklistPreview[];
  requiresClarification: boolean;
}

export interface ItemWarning {
  approximateSlNo: number | null;
  description: string;
  warningType: "possible_merge" | "missing_number" | "truncated_text";
  rawText: string;
}

export interface PdfParseResult {
  fields: {
    checklistNo: ChecklistHeaderField<string | null>;
    revNo: ChecklistHeaderField<string | null>;
    activityTitle: ChecklistHeaderField<string | null>;
    activityType: ChecklistHeaderField<string | null>;
    discipline: ChecklistHeaderField<string | null>;
    applicableTrade: ChecklistHeaderField<string | null>;
  };
  sections: ChecklistImportStage[];
  signatureSlots: ChecklistHeaderField<SignatureSlotConfig[]>;
  overallConfidence: number;
  requiresClarification: boolean;
  itemWarnings: ItemWarning[];
  parseMethod: "digital" | "ocr";
  warnings: string[];
  preview: ParsedChecklistPreview;
}

export interface QualityChecklistTemplatePayload {
  name: string;
  description?: string;
  checklistNo?: string;
  revNo?: string;
  activityTitle?: string;
  activityType?: string;
  discipline?: string;
  applicableTrade?: string;
  isGlobal?: boolean;
  stages: Array<{
    name: string;
    sequence?: number;
    isHoldPoint?: boolean;
    isWitnessPoint?: boolean;
    responsibleParty?: string;
    signatureSlots?: SignatureSlotConfig[];
    items: Array<{
      itemText: string;
      type: ChecklistImportItem["type"];
      isMandatory?: boolean;
      photoRequired?: boolean;
      sequence?: number;
    }>;
  }>;
}
