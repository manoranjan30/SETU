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

export interface QualityMaterialItpCheckpoint {
  id?: number;
  templateId?: number;
  sequence: number;
  section?: string;
  slNo?: string | null;
  characteristic: string;
  testSpecification?: string | null;
  unit?: string | null;
  verifyingDocument?: string;
  frequencyType?: string;
  frequencyValue?: number | null;
  frequencyUnit?: string | null;
  acceptanceCriteria?: any;
  isMandatory?: boolean;
  requiresDocument?: boolean;
  requiresPhotoEvidence?: boolean;
  requiresNumericResult?: boolean;
  requiresLabReport?: boolean;
  requiredEvidenceTypes?: string[] | null;
  minPhotoCount?: number;
  dueOffsetHours?: number | null;
  expiryWindowDays?: number | null;
}

export interface QualityMaterialItpTemplate {
  id: number;
  projectId: number;
  materialName: string;
  materialCode?: string | null;
  itpNo: string;
  revNo: string;
  title: string;
  description?: string | null;
  status: string;
  approvalStatus: string;
  approvalRunId?: number | null;
  approvalRun?: QualityMaterialApprovalRun | null;
  checkpoints: QualityMaterialItpCheckpoint[];
  createdAt: string;
  updatedAt: string;
}

export interface QualityMaterialReceipt {
  id: number;
  projectId: number;
  itpTemplateId: number;
  materialName: string;
  materialCode?: string | null;
  brand?: string | null;
  grade?: string | null;
  supplier?: string | null;
  manufacturer?: string | null;
  batchNumber: string;
  lotNumber?: string | null;
  challanNumber?: string | null;
  quantity?: string | null;
  uom?: string | null;
  receivedDate: string;
  manufactureDate?: string | null;
  status: string;
  obligations?: QualityMaterialTestObligation[];
}

export interface QualityMaterialTestObligation {
  id: number;
  projectId: number;
  receiptId?: number | null;
  templateId: number;
  checkpointId: number;
  materialName: string;
  brand?: string | null;
  grade?: string | null;
  dueDate?: string | null;
  warningDate?: string | null;
  status: string;
  priority: string;
  reason?: string | null;
  lastResultId?: number | null;
  checkpoint?: QualityMaterialItpCheckpoint;
  receipt?: QualityMaterialReceipt;
}

export interface QualityMaterialTestResult {
  id: number;
  projectId: number;
  obligationId: number;
  receiptId?: number | null;
  templateId: number;
  checkpointId: number;
  testDate: string;
  testedByName?: string | null;
  labType: string;
  numericValue?: string | null;
  textValue?: string | null;
  result: string;
  reviewStatus: string;
  approvalRun?: QualityMaterialApprovalRun | null;
  remarks?: string | null;
  checkpoint?: QualityMaterialItpCheckpoint;
  obligation?: QualityMaterialTestObligation;
}

export interface QualityMaterialEvidenceFile {
  id: number;
  projectId: number;
  ownerType: string;
  ownerId: number;
  evidenceType: string;
  fileKind: string;
  originalName: string;
  relativeUrl: string;
  uploadedAt: string;
  isLocked: boolean;
}

export interface QualityMaterialApprovalStep {
  id: number;
  runId: number;
  stepOrder: number;
  stepName?: string | null;
  approverMode?: string | null;
  assignedUserId?: number | null;
  assignedUserIds?: number[] | null;
  assignedRoleId?: number | null;
  minApprovalsRequired: number;
  currentApprovalCount: number;
  approvedUserIds?: number[] | null;
  status: string;
  signedBy?: string | null;
  signerDisplayName?: string | null;
  completedAt?: string | null;
  comments?: string | null;
}

export interface QualityMaterialApprovalRun {
  id: number;
  projectId: number;
  documentType: string;
  documentId: number;
  processCode: string;
  strategyName: string;
  status: string;
  currentStepOrder: number;
  steps: QualityMaterialApprovalStep[];
}
