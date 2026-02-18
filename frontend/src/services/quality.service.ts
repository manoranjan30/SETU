import api from '../api/axios';
import type {
    QualityUnitTemplate,
    CreateTemplateDto,
    ApplyUnitDto,
    BulkApplyDto,
    CopyStructureDto,
    QualitySnag
} from '../types/quality';

const BASE_URL = '/quality';

export const qualityService = {
    // === TEMPLATES ===
    createTemplate: async (projectId: number, data: CreateTemplateDto) => {
        const res = await api.post(`${BASE_URL}/${projectId}/structure/templates`, data);
        return res.data;
    },

    getTemplates: async (projectId: number): Promise<QualityUnitTemplate[]> => {
        const res = await api.get(`${BASE_URL}/${projectId}/structure/templates`);
        return res.data;
    },

    // === STRUCTURE ===
    addUnit: async (data: ApplyUnitDto) => {
        const res = await api.post(`${BASE_URL}/structure/apply-unit`, data);
        return res.data;
    },

    bulkAddUnits: async (data: BulkApplyDto) => {
        const res = await api.post(`${BASE_URL}/structure/bulk-apply`, data);
        return res.data;
    },

    copyStructure: async (data: CopyStructureDto) => {
        const res = await api.post(`${BASE_URL}/structure/copy`, data);
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
            headers: { 'Content-Type': 'multipart/form-data' }
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
            headers: { 'Content-Type': 'multipart/form-data' }
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
    }
};
