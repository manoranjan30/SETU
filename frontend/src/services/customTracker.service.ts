import api from "../api/axios";

export type CustomTrackerStatus = "ACTIVE" | "ARCHIVED";
export type CustomTrackerRecordStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "BLOCKED"
  | "ON_HOLD";
export type CustomTrackerFieldType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "BOOLEAN"
  | "SELECT"
  | "MULTI_SELECT"
  | "PERCENT"
  | "STATUS"
  | "USER"
  | "CURRENCY";

export interface CustomTrackerCategory {
  key: string;
  label: string;
  options?: string[];
}

export interface CustomTrackerField {
  id: number;
  trackerId: number;
  label: string;
  key: string;
  fieldType: CustomTrackerFieldType;
  required: boolean;
  unit?: string | null;
  options?: string[];
  formula?: string | null;
  sequence: number;
  isKpi: boolean;
}

export interface CustomTrackerRecord {
  id: number;
  trackerId: number;
  projectId: number;
  epsNodeId?: number | null;
  locationText?: string | null;
  categoryValues: Record<string, string>;
  values: Record<string, any>;
  status: CustomTrackerRecordStatus;
  progressPercent: number;
  remarks?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomTracker {
  id: number;
  projectId: number;
  name: string;
  description?: string | null;
  trackerType: string;
  status: CustomTrackerStatus;
  locationScopeTypes?: string[];
  categoryConfig?: CustomTrackerCategory[];
  chartConfig?: Record<string, any>;
  fields?: CustomTrackerField[];
  records?: CustomTrackerRecord[];
  recordCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomTrackerAnalytics {
  trackerId: number;
  totalRecords: number;
  averageProgress: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, Record<string, number>>;
  byLocation: Array<{
    location: string;
    count: number;
    averageProgress: number;
  }>;
  fieldSummary: Record<
    string,
    { label: string; count: number; sum: number; average: number; max: number }
  >;
}

export type CustomTrackerPayload = Partial<Omit<CustomTracker, "fields">> & {
  fields?: Partial<CustomTrackerField>[];
};

const base = (projectId: number) => `/planning/projects/${projectId}/custom-trackers`;

export const customTrackerService = {
  list(projectId: number, includeArchived = false): Promise<CustomTracker[]> {
    return api
      .get(base(projectId), { params: { includeArchived } })
      .then((response) => response.data);
  },
  get(projectId: number, trackerId: number): Promise<CustomTracker> {
    return api.get(`${base(projectId)}/${trackerId}`).then((response) => response.data);
  },
  create(projectId: number, payload: CustomTrackerPayload): Promise<CustomTracker> {
    return api.post(base(projectId), payload).then((response) => response.data);
  },
  update(
    projectId: number,
    trackerId: number,
    payload: CustomTrackerPayload,
  ): Promise<CustomTracker> {
    return api.patch(`${base(projectId)}/${trackerId}`, payload).then((response) => response.data);
  },
  archive(projectId: number, trackerId: number): Promise<{ archived: boolean }> {
    return api.delete(`${base(projectId)}/${trackerId}`).then((response) => response.data);
  },
  analytics(projectId: number, trackerId: number): Promise<CustomTrackerAnalytics> {
    return api
      .get(`${base(projectId)}/${trackerId}/analytics`)
      .then((response) => response.data);
  },
  createField(
    projectId: number,
    trackerId: number,
    payload: Partial<CustomTrackerField>,
  ): Promise<CustomTrackerField> {
    return api
      .post(`${base(projectId)}/${trackerId}/fields`, payload)
      .then((response) => response.data);
  },
  updateField(
    projectId: number,
    trackerId: number,
    fieldId: number,
    payload: Partial<CustomTrackerField>,
  ): Promise<CustomTrackerField> {
    return api
      .patch(`${base(projectId)}/${trackerId}/fields/${fieldId}`, payload)
      .then((response) => response.data);
  },
  deleteField(
    projectId: number,
    trackerId: number,
    fieldId: number,
  ): Promise<{ deleted: boolean }> {
    return api
      .delete(`${base(projectId)}/${trackerId}/fields/${fieldId}`)
      .then((response) => response.data);
  },
  listRecords(
    projectId: number,
    trackerId: number,
    params?: Record<string, any>,
  ): Promise<CustomTrackerRecord[]> {
    return api
      .get(`${base(projectId)}/${trackerId}/records`, { params })
      .then((response) => response.data);
  },
  createRecord(
    projectId: number,
    trackerId: number,
    payload: Partial<CustomTrackerRecord>,
  ): Promise<CustomTrackerRecord> {
    return api
      .post(`${base(projectId)}/${trackerId}/records`, payload)
      .then((response) => response.data);
  },
  updateRecord(
    projectId: number,
    trackerId: number,
    recordId: number,
    payload: Partial<CustomTrackerRecord>,
  ): Promise<CustomTrackerRecord> {
    return api
      .patch(`${base(projectId)}/${trackerId}/records/${recordId}`, payload)
      .then((response) => response.data);
  },
  deleteRecord(
    projectId: number,
    trackerId: number,
    recordId: number,
  ): Promise<{ deleted: boolean }> {
    return api
      .delete(`${base(projectId)}/${trackerId}/records/${recordId}`)
      .then((response) => response.data);
  },
};
