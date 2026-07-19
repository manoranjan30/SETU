import api from "../api/axios";
import type {
  QualityFloorStructure,
  QualityUnitNode,
  QualityRoomNode,
  BuildPreviewDto,
  BuildApplyDto,
  CopyStructureDto,
  QualitySnag,
  UpdateGraphDto,
  ChecklistImportPreviewResponse,
  ParsedChecklistPreview,
  PdfParseResult,
  QualityChecklistTemplatePayload,
  QualityMaterialEvidenceFile,
  QualityMaterialItpTemplate,
  QualityMaterialReceipt,
  QualityMaterialTestObligation,
  QualityMaterialTestResult,
  QualityCubeTestRegister,
  QualityConcreteGrade,
  QualityInspectionAttachment,
  RelatedChecklistOption,
} from "../types/quality";

const BASE_URL = "/quality";

const annotatedExtensionFor = (file: File | Blob) => {
  if (file.type === "image/jpeg") return ".jpg";
  if (file.type === "image/webp") return ".webp";
  return ".png";
};

export const qualityService = {
  getRfiDateSettings: async (projectId: number): Promise<{
    globalEnabled: boolean;
    projectEnabled: boolean;
    enabled: boolean;
    projectOverride?: string | null;
    projectSettingKey?: string;
  }> => {
    const res = await api.get(`${BASE_URL}/inspections/project-date-settings`, {
      params: { projectId },
    });
    return res.data;
  },

  updateRfiDateSettings: async (
    projectId: number,
    enabled: boolean,
  ): Promise<{
    globalEnabled: boolean;
    projectEnabled: boolean;
    enabled: boolean;
    projectOverride?: string | null;
    projectSettingKey?: string;
  }> => {
    const res = await api.patch(
      `${BASE_URL}/inspections/project-date-settings`,
      { enabled },
      { params: { projectId } },
    );
    return res.data;
  },

  getRelatedChecklistOptions: async (
    projectId: number,
    epsNodeId: number,
    excludeInspectionId?: number,
  ): Promise<RelatedChecklistOption[]> => {
    const res = await api.get(`${BASE_URL}/inspections/related-options`, {
      params: { projectId, epsNodeId, excludeInspectionId },
    });
    return res.data;
  },

  updateInspectionRelatedChecklists: async (
    inspectionId: number,
    relatedChecklistInspectionIds: number[],
  ) => {
    const res = await api.patch(
      `${BASE_URL}/inspections/${inspectionId}/related-checklists`,
      { relatedChecklistInspectionIds },
    );
    return res.data;
  },

  addInspectionGo: async (data: {
    projectId: number;
    epsNodeId: number;
    activityId: number;
    qualityUnitId?: number;
    qualityRoomId?: number;
  }) => {
    const res = await api.post(`${BASE_URL}/inspections/add-go`, data);
    return res.data as {
      previousTotalParts: number;
      newTotalParts: number;
      nextGoNo: number;
      nextGoLabel: string;
    };
  },

  uploadInspectionAttachmentDraft: async (
    projectId: number,
    originalFile: File,
    options?: {
      annotatedFile?: File | Blob;
      annotationData?: Record<string, unknown> | null;
      attachmentType?: "DRAWING_MARKUP" | "SUPPORTING_DOCUMENT";
      clientUploadId?: string;
    },
  ): Promise<QualityInspectionAttachment> => {
    const formData = new FormData();
    formData.append("projectId", String(projectId));
    formData.append("originalFile", originalFile);
    if (options?.annotatedFile) {
      formData.append(
        "annotatedFile",
        options.annotatedFile,
        `annotated-${originalFile.name.replace(/\.[^.]+$/, "")}${annotatedExtensionFor(options.annotatedFile)}`,
      );
    }
    formData.append(
      "attachmentType",
      options?.attachmentType || "SUPPORTING_DOCUMENT",
    );
    formData.append("clientUploadId", options?.clientUploadId || crypto.randomUUID());
    if (options?.annotationData) {
      formData.append("annotationData", JSON.stringify(options.annotationData));
    }
    const res = await api.post(
      `${BASE_URL}/inspections/attachment-drafts`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return res.data;
  },

  deleteInspectionAttachmentDraft: async (attachmentId: string) => {
    const res = await api.delete(
      `${BASE_URL}/inspections/attachment-drafts/${attachmentId}`,
    );
    return res.data;
  },

  getInspectionAttachments: async (
    inspectionId: number,
  ): Promise<QualityInspectionAttachment[]> => {
    const res = await api.get(
      `${BASE_URL}/inspections/${inspectionId}/attachments`,
    );
    return res.data;
  },

  uploadInspectionAttachment: async (
    inspectionId: number,
    originalFile: File,
    options?: {
      annotatedFile?: File | Blob;
      annotationData?: Record<string, unknown> | null;
      attachmentType?: "DRAWING_MARKUP" | "SUPPORTING_DOCUMENT";
      clientUploadId?: string;
    },
  ): Promise<QualityInspectionAttachment> => {
    const formData = new FormData();
    formData.append("originalFile", originalFile);
    if (options?.annotatedFile) {
      formData.append(
        "annotatedFile",
        options.annotatedFile,
        `annotated-${originalFile.name.replace(/\.[^.]+$/, "")}${annotatedExtensionFor(options.annotatedFile)}`,
      );
    }
    formData.append(
      "attachmentType",
      options?.attachmentType || "SUPPORTING_DOCUMENT",
    );
    formData.append("clientUploadId", options?.clientUploadId || crypto.randomUUID());
    if (options?.annotationData) {
      formData.append("annotationData", JSON.stringify(options.annotationData));
    }
    const res = await api.post(
      `${BASE_URL}/inspections/${inspectionId}/attachments`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return res.data;
  },

  deleteInspectionAttachment: async (
    inspectionId: number,
    attachmentId: string,
  ) => {
    const res = await api.delete(
      `${BASE_URL}/inspections/${inspectionId}/attachments/${attachmentId}`,
    );
    return res.data;
  },

  getFloorStructure: async (
    projectId: number,
    floorId: number,
  ): Promise<QualityFloorStructure> => {
    const res = await api.get(
      `${BASE_URL}/${projectId}/structure/floor/${floorId}`,
    );
    return res.data;
  },

  previewBuild: async (
    projectId: number,
    floorId: number,
    data: BuildPreviewDto,
  ) => {
    const res = await api.post(
      `${BASE_URL}/${projectId}/structure/floor/${floorId}/preview-build`,
      data,
    );
    return res.data;
  },

  applyBuild: async (
    projectId: number,
    floorId: number,
    data: BuildApplyDto,
  ) => {
    const res = await api.post(
      `${BASE_URL}/${projectId}/structure/floor/${floorId}/apply-build`,
      data,
    );
    return res.data;
  },

  copyStructure: async (data: CopyStructureDto) => {
    const res = await api.post(`${BASE_URL}/structure/copy-floor`, data);
    return res.data;
  },

  updateUnit: async (
    unitId: number,
    data: { name?: string; code?: string },
  ) => {
    const res = await api.put(`${BASE_URL}/structure/units/${unitId}`, data);
    return res.data as QualityUnitNode;
  },

  deleteUnit: async (unitId: number) => {
    const res = await api.delete(`${BASE_URL}/structure/units/${unitId}`);
    return res.data;
  },

  createRoom: async (
    unitId: number,
    data: { name: string; code?: string; roomType?: string },
  ) => {
    const res = await api.post(
      `${BASE_URL}/structure/units/${unitId}/rooms`,
      data,
    );
    return res.data as QualityRoomNode;
  },

  updateRoom: async (
    roomId: number,
    data: { name?: string; code?: string; roomType?: string },
  ) => {
    const res = await api.put(`${BASE_URL}/structure/rooms/${roomId}`, data);
    return res.data as QualityRoomNode;
  },

  deleteRoom: async (roomId: number) => {
    const res = await api.delete(`${BASE_URL}/structure/rooms/${roomId}`);
    return res.data;
  },

  // === SNAGS ===
  getSnags: async (projectId: number): Promise<QualitySnag[]> => {
    const res = await api.get(`${BASE_URL}/${projectId}/snags`);
    return res.data;
  },

  /**
   * Create Snag with optional Photo.
   * Expects FormData with fields:
   * - projectId, defectDescription, priority, dueDate, epsNodeId (if using structure)
   * - file (optional)
   */
  createSnag: async (formData: FormData) => {
    const res = await api.post(`${BASE_URL}/snags`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  /**
   * Update Snag Status (Rectify/Close) with optional Photo.
   * Expects FormData with:
   * - status
   * - file (optional - Rectified Photo or Verified Photo)
   */
  updateSnag: async (id: number, formData: FormData) => {
    const res = await api.put(`${BASE_URL}/snags/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  deleteSnag: async (id: number) => {
    const res = await api.delete(`${BASE_URL}/snags/${id}`);
    return res.data;
  },

  // === DASHBOARD ===
  getSummary: async (projectId: number) => {
    const res = await api.get(`${BASE_URL}/${projectId}/summary`);
    return res.data;
  },

  // === SEQUENCER ===
  getSequence: async (listId: number) => {
    const res = await api.get(`${BASE_URL}/sequences/${listId}`);
    return res.data;
  },

  saveSequence: async (listId: number, data: UpdateGraphDto) => {
    const res = await api.post(`${BASE_URL}/sequences/${listId}`, data);
    return res.data;
  },

  createActivity: async (
    listId: number,
    data: {
      activityName: string;
      description?: string;
      requiresPourCard?: boolean;
      requiresPourClearanceCard?: boolean;
      pourClearanceTriggerStageTemplateId?: number | null;
      prePourClearanceApprovalRequirement?: 'SUBMITTED' | 'APPROVED';
      pourCardTriggerStageTemplateId?: number | null;
      pourClearanceSignoffTemplate?: Array<{
        id?: string;
        department?: string;
        designation?: string | null;
        isActive?: boolean;
      }>;
    },
  ) => {
    const res = await api.post(
      `${BASE_URL}/activity-lists/${listId}/activities`,
      data,
    );
    return res.data;
  },

  getPourCard: async (inspectionId: number) => {
    const res = await api.get(`${BASE_URL}/inspections/${inspectionId}/pour-card`);
    return res.data;
  },

  savePourCard: async (inspectionId: number, data: Record<string, unknown>) => {
    const res = await api.put(
      `${BASE_URL}/inspections/${inspectionId}/pour-card`,
      data,
    );
    return res.data;
  },

  submitPourCard: async (inspectionId: number) => {
    const res = await api.post(
      `${BASE_URL}/inspections/${inspectionId}/pour-card/submit`,
    );
    return res.data;
  },

  approvePourCard: async (inspectionId: number, remarks?: string) => {
    const res = await api.post(
      `${BASE_URL}/inspections/${inspectionId}/pour-card/approve`,
      { remarks },
    );
    return res.data;
  },

  rejectPourCard: async (inspectionId: number, remarks?: string) => {
    const res = await api.post(
      `${BASE_URL}/inspections/${inspectionId}/pour-card/reject`,
      { remarks },
    );
    return res.data;
  },

  downloadPourCardPdf: async (inspectionId: number) => {
    const res = await api.get(
      `${BASE_URL}/inspections/${inspectionId}/pour-card/pdf`,
      { responseType: "blob" },
    );
    return res.data;
  },

  getPrePourClearanceCard: async (inspectionId: number) => {
    const res = await api.get(
      `${BASE_URL}/inspections/${inspectionId}/pre-pour-clearance`,
    );
    return res.data;
  },

  savePrePourClearanceCard: async (
    inspectionId: number,
    data: Record<string, unknown>,
  ) => {
    const res = await api.put(
      `${BASE_URL}/inspections/${inspectionId}/pre-pour-clearance`,
      data,
    );
    return res.data;
  },

  createPrePourClearanceSignatureQr: async (
    inspectionId: number,
    signoffId: string,
  ) => {
    const res = await api.post(
      `${BASE_URL}/inspections/${inspectionId}/pre-pour-clearance/signoffs/${encodeURIComponent(signoffId)}/qr`,
    );
    return res.data;
  },

  uploadPrePourClearanceAttachment: async (
    inspectionId: number,
    lineKey: string,
    file: File,
  ) => {
    const formData = new FormData();
    formData.append("lineKey", lineKey);
    formData.append("file", file);
    const res = await api.post(
      `${BASE_URL}/inspections/${inspectionId}/pre-pour-clearance/attachments`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return res.data;
  },

  deletePrePourClearanceAttachment: async (
    inspectionId: number,
    lineKey: string,
    attachmentId: string,
  ) => {
    const res = await api.delete(
      `${BASE_URL}/inspections/${inspectionId}/pre-pour-clearance/attachments/${encodeURIComponent(attachmentId)}`,
      { params: { lineKey } },
    );
    return res.data;
  },

  submitPrePourClearanceCard: async (inspectionId: number) => {
    const res = await api.post(
      `${BASE_URL}/inspections/${inspectionId}/pre-pour-clearance/submit`,
    );
    return res.data;
  },

  approvePrePourClearanceCard: async (inspectionId: number, remarks?: string) => {
    const res = await api.post(
      `${BASE_URL}/inspections/${inspectionId}/pre-pour-clearance/approve`,
      { remarks },
    );
    return res.data;
  },

  rejectPrePourClearanceCard: async (inspectionId: number, remarks?: string) => {
    const res = await api.post(
      `${BASE_URL}/inspections/${inspectionId}/pre-pour-clearance/reject`,
      { remarks },
    );
    return res.data;
  },

  downloadPrePourClearancePdf: async (inspectionId: number) => {
    const res = await api.get(
      `${BASE_URL}/inspections/${inspectionId}/pre-pour-clearance/pdf`,
      { responseType: "blob" },
    );
    return res.data;
  },

  getChecklistTemplates: async (projectId: number) => {
    const res = await api.get(`${BASE_URL}/checklist-templates/project/${projectId}`);
    return res.data;
  },

  createChecklistTemplate: async (
    projectId: number,
    data: QualityChecklistTemplatePayload,
  ) => {
    const res = await api.post(
      `${BASE_URL}/checklist-templates/project/${projectId}`,
      data,
    );
    return res.data;
  },

  updateChecklistTemplate: async (
    templateId: number,
    data: QualityChecklistTemplatePayload,
  ) => {
    const res = await api.put(
      `${BASE_URL}/checklist-templates/${templateId}`,
      data,
    );
    return res.data;
  },

  deleteChecklistTemplate: async (templateId: number) => {
    const res = await api.delete(`${BASE_URL}/checklist-templates/${templateId}`);
    return res.data;
  },

  migrateChecklistTemplates: async (projectId: number) => {
    const res = await api.post(
      `${BASE_URL}/checklist-templates/project/${projectId}/migrate`,
    );
    return res.data;
  },

  cloneChecklistTemplatesFromProject: async (
    targetProjectId: number,
    data: {
      sourceProjectId: number;
      templateIds?: number[];
      overwriteExisting?: boolean;
    },
  ) => {
    const res = await api.post(
      `${BASE_URL}/checklist-templates/project/${targetProjectId}/clone-from-project`,
      data,
    );
    return res.data;
  },

  previewChecklistExcelImport: async (
    projectId: number,
    file: File,
  ): Promise<ChecklistImportPreviewResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post(
      `${BASE_URL}/checklist-templates/project/${projectId}/import-excel?preview=true`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return res.data;
  },

  previewChecklistPdfImport: async (
    projectId: number,
    file: File,
  ): Promise<PdfParseResult> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post(
      `${BASE_URL}/checklist-templates/project/${projectId}/import-pdf`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return res.data;
  },

  saveChecklistImport: async (
    projectId: number,
    templates: ParsedChecklistPreview[],
    overwriteExisting = true,
  ) => {
    const payload = {
      overwriteExisting,
      templates: templates.map((template) => ({
        name: template.activityTitle.value || template.sheetName,
        description: template.warnings.join(" | "),
        checklistNo: template.checklistNo.value || undefined,
        revNo: template.revNo.value || undefined,
        activityTitle: template.activityTitle.value || undefined,
        activityType: template.activityType.value || undefined,
        discipline: template.discipline.value || undefined,
        applicableTrade: template.applicableTrade.value || undefined,
        isGlobal: Boolean(template.isGlobal.value),
        stages: template.stages.map((stage) => ({
          name: stage.name,
          sequence: stage.sequence,
          isHoldPoint: stage.isHoldPoint,
          isWitnessPoint: stage.isWitnessPoint,
          responsibleParty: stage.responsibleParty,
          signatureSlots: [],
          items: stage.items.map((item, index) => ({
            itemText: item.description,
            type: item.type,
            isMandatory: item.isMandatory,
            photoRequired: item.photoRequired,
            sequence: index,
          })),
        })),
      })),
    };

    const res = await api.post(
      `${BASE_URL}/checklist-templates/project/${projectId}/import-excel?preview=false`,
      payload,
    );
    return res.data;
  },

  getMaterialItps: async (
    projectId: number,
  ): Promise<QualityMaterialItpTemplate[]> => {
    const res = await api.get(`${BASE_URL}/${projectId}/material-itps`);
    return res.data;
  },

  createMaterialItp: async (
    projectId: number,
    data: Partial<QualityMaterialItpTemplate>,
  ): Promise<QualityMaterialItpTemplate> => {
    const res = await api.post(`${BASE_URL}/${projectId}/material-itps`, data);
    return res.data;
  },

  submitMaterialItpApproval: async (templateId: number) => {
    const res = await api.post(
      `${BASE_URL}/material-itps/${templateId}/submit-approval`,
    );
    return res.data;
  },

  approveMaterialItpStep: async (
    templateId: number,
    stepId: number,
    comments?: string,
  ) => {
    const res = await api.post(
      `${BASE_URL}/material-itps/${templateId}/approval/${stepId}/approve`,
      { comments },
    );
    return res.data;
  },

  rejectMaterialItpStep: async (
    templateId: number,
    stepId: number,
    comments?: string,
  ) => {
    const res = await api.post(
      `${BASE_URL}/material-itps/${templateId}/approval/${stepId}/reject`,
      { comments },
    );
    return res.data;
  },

  activateMaterialItp: async (templateId: number) => {
    const res = await api.post(`${BASE_URL}/material-itps/${templateId}/activate`);
    return res.data;
  },

  getMaterialReceipts: async (
    projectId: number,
  ): Promise<QualityMaterialReceipt[]> => {
    const res = await api.get(`${BASE_URL}/${projectId}/material-receipts`);
    return res.data;
  },

  createMaterialReceipt: async (
    projectId: number,
    data: Partial<QualityMaterialReceipt>,
  ): Promise<QualityMaterialReceipt> => {
    const res = await api.post(`${BASE_URL}/${projectId}/material-receipts`, data);
    return res.data;
  },

  getMaterialTestObligations: async (
    projectId: number,
  ): Promise<QualityMaterialTestObligation[]> => {
    const res = await api.get(`${BASE_URL}/${projectId}/material-test-obligations`);
    return res.data;
  },

  getMaterialTestResults: async (
    projectId: number,
  ): Promise<QualityMaterialTestResult[]> => {
    const res = await api.get(`${BASE_URL}/${projectId}/material-test-results`);
    return res.data;
  },

  getCubeTestRegister: async (
    projectId: number,
  ): Promise<QualityCubeTestRegister[]> => {
    const res = await api.get(`${BASE_URL}/${projectId}/cube-test-register`);
    return res.data;
  },

  getConcreteGrades: async (projectId: number): Promise<QualityConcreteGrade[]> => {
    const res = await api.get(`${BASE_URL}/${projectId}/concrete-grades`);
    return res.data;
  },

  createConcreteGrade: async (
    projectId: number,
    data: Partial<QualityConcreteGrade>,
  ): Promise<QualityConcreteGrade> => {
    const res = await api.post(`${BASE_URL}/${projectId}/concrete-grades`, data);
    return res.data;
  },

  updateConcreteGrade: async (
    id: number,
    data: Partial<QualityConcreteGrade>,
  ): Promise<QualityConcreteGrade> => {
    const res = await api.put(`${BASE_URL}/concrete-grades/${id}`, data);
    return res.data;
  },

  deleteConcreteGrade: async (id: number) => {
    const res = await api.delete(`${BASE_URL}/concrete-grades/${id}`);
    return res.data;
  },

  createCubeTestRegister: async (
    projectId: number,
    data: Partial<QualityCubeTestRegister>,
  ): Promise<QualityCubeTestRegister> => {
    const res = await api.post(`${BASE_URL}/${projectId}/cube-test-register`, data);
    return res.data;
  },

  updateCubeTestRegister: async (
    id: number,
    data: Partial<QualityCubeTestRegister>,
  ): Promise<QualityCubeTestRegister> => {
    const res = await api.put(`${BASE_URL}/cube-test-register/${id}`, data);
    return res.data;
  },

  approveCubeTestRegister: async (
    id: number,
    data: Partial<QualityCubeTestRegister>,
  ): Promise<QualityCubeTestRegister> => {
    const res = await api.post(`${BASE_URL}/cube-test-register/${id}/approve`, data);
    return res.data;
  },

  deleteCubeTestRegister: async (id: number) => {
    const res = await api.delete(`${BASE_URL}/cube-test-register/${id}`);
    return res.data;
  },

  createMaterialTestResult: async (
    obligationId: number,
    data: Partial<QualityMaterialTestResult>,
  ): Promise<QualityMaterialTestResult> => {
    const res = await api.post(
      `${BASE_URL}/material-test-obligations/${obligationId}/results`,
      data,
    );
    return res.data;
  },

  submitMaterialTestResultApproval: async (resultId: number) => {
    const res = await api.post(
      `${BASE_URL}/material-test-results/${resultId}/submit-approval`,
    );
    return res.data;
  },

  approveMaterialTestResultStep: async (
    resultId: number,
    stepId: number,
    comments?: string,
  ) => {
    const res = await api.post(
      `${BASE_URL}/material-test-results/${resultId}/approval/${stepId}/approve`,
      { comments },
    );
    return res.data;
  },

  rejectMaterialTestResultStep: async (
    resultId: number,
    stepId: number,
    comments?: string,
  ) => {
    const res = await api.post(
      `${BASE_URL}/material-test-results/${resultId}/approval/${stepId}/reject`,
      { comments },
    );
    return res.data;
  },

  uploadMaterialEvidence: async (
    projectId: number,
    data: FormData,
  ): Promise<QualityMaterialEvidenceFile> => {
    const res = await api.post(`${BASE_URL}/${projectId}/material-evidence`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  getMaterialEvidence: async (
    projectId: number,
    ownerType?: string,
    ownerId?: number,
  ): Promise<QualityMaterialEvidenceFile[]> => {
    const res = await api.get(`${BASE_URL}/${projectId}/material-evidence`, {
      params: { ownerType, ownerId },
    });
    return res.data;
  },
};
