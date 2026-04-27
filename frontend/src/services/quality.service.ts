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
} from "../types/quality";

const BASE_URL = "/quality";

export const qualityService = {
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

  submitPrePourClearanceCard: async (inspectionId: number) => {
    const res = await api.post(
      `${BASE_URL}/inspections/${inspectionId}/pre-pour-clearance/submit`,
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
          signatureSlots: stage.signatureSlots,
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
};
