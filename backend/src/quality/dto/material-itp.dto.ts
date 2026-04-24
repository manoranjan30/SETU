export class MaterialItpCheckpointDto {
  id?: number;
  sequence?: number;
  section?: string;
  slNo?: string;
  characteristic: string;
  testSpecification?: string;
  unit?: string;
  verifyingDocument?: string;
  frequencyType?: string;
  frequencyValue?: number;
  frequencyUnit?: string;
  acceptanceCriteria?: any;
  applicableGrades?: string[];
  inspectionCategory?: any;
  contractorAction?: any;
  pmcAction?: any;
  isMandatory?: boolean;
  requiresDocument?: boolean;
  requiresPhotoEvidence?: boolean;
  requiresNumericResult?: boolean;
  requiresLabReport?: boolean;
  requiresThirdParty?: boolean;
  requiredEvidenceTypes?: string[];
  minPhotoCount?: number;
  dueOffsetHours?: number;
  expiryWindowDays?: number;
}

export class CreateMaterialItpTemplateDto {
  materialName: string;
  materialCode?: string;
  itpNo: string;
  revNo?: string;
  title: string;
  description?: string;
  standardRefs?: string[];
  isGlobal?: boolean;
  checkpoints?: MaterialItpCheckpointDto[];
}

export class CreateMaterialReceiptDto {
  itpTemplateId?: number;
  materialName: string;
  materialCode?: string;
  brand?: string;
  grade?: string;
  supplier?: string;
  manufacturer?: string;
  batchNumber: string;
  lotNumber?: string;
  challanNumber?: string;
  quantity?: string | number;
  uom?: string;
  receivedDate: string;
  manufactureDate?: string;
  packingWeekNo?: string;
}

export class CreateMaterialTestResultDto {
  testDate?: string;
  testedByName?: string;
  labType?: string;
  documentType?: string;
  primaryDocumentUrl?: string;
  numericValue?: string | number;
  textValue?: string;
  observedGrade?: string;
  result?: string;
  remarks?: string;
}

export class MaterialApprovalActionDto {
  comments?: string;
}

