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
    data: { activityName: string; description?: string },
  ) => {
    const res = await api.post(
      `${BASE_URL}/activity-lists/${listId}/activities`,
      data,
    );
    return res.data;
  },
};
