import api from "../api/axios";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InsightTemplate {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  requiredPermission: string;
  scope: "PROJECT" | "GLOBAL";
  dataSources: { key: string; label: string; filters?: Record<string, unknown> }[];
  outputSchema: Record<string, unknown> | null;
  icon: string | null;
  tags: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type InsightRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface InsightRun {
  id: number;
  templateId: number;
  template?: Pick<InsightTemplate, "id" | "name" | "slug" | "icon">;
  projectId: number | null;
  requestedById: number;
  requestedBy?: { id: number; name: string };
  modelConfigId: number | null;
  status: InsightRunStatus;
  parameters: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  rawResponse: string | null;
  modelUsed: string | null;
  tokensUsed: number | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AiModelConfig {
  id: number;
  provider: "openrouter" | "azure" | "openai";
  apiKey: string | null;
  endpoint: string | null;
  model: string;
  maxTokens: number;
  temperature: number;
  isActive: boolean;
  label: string | null;
  notes: string | null;
  azureTenantId: string | null;
  azureClientId: string | null;
  azureClientSecret: string | null;
  azureDeployment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RunInsightPayload {
  templateId: number;
  projectId?: number | null;
  parameters?: Record<string, unknown>;
}

export interface InsightRunsResponse {
  runs: InsightRun[];
  total: number;
}

// ─── Template CRUD ────────────────────────────────────────────────────────────

export const aiInsightsService = {
  // Templates
  async listTemplates(includeInactive = false): Promise<InsightTemplate[]> {
    const { data } = await api.get("/ai-insights/templates", {
      params: includeInactive ? { includeInactive: "true" } : undefined,
    });
    return data;
  },

  async getTemplate(id: number): Promise<InsightTemplate> {
    const { data } = await api.get(`/ai-insights/templates/${id}`);
    return data;
  },

  async createTemplate(payload: Partial<InsightTemplate>): Promise<InsightTemplate> {
    const { data } = await api.post("/ai-insights/templates", payload);
    return data;
  },

  async updateTemplate(id: number, payload: Partial<InsightTemplate>): Promise<InsightTemplate> {
    const { data } = await api.put(`/ai-insights/templates/${id}`, payload);
    return data;
  },

  async deleteTemplate(id: number): Promise<void> {
    await api.delete(`/ai-insights/templates/${id}`);
  },

  // Runs
  async runInsight(payload: RunInsightPayload): Promise<InsightRun> {
    const { data } = await api.post("/ai-insights/run", payload);
    return data;
  },

  async listRuns(params?: {
    projectId?: number;
    templateId?: number;
    page?: number;
    limit?: number;
  }): Promise<InsightRunsResponse> {
    const { data } = await api.get("/ai-insights/runs", { params });
    return data;
  },

  async getRun(id: number): Promise<InsightRun> {
    const { data } = await api.get(`/ai-insights/runs/${id}`);
    return data;
  },

  // Admin — Model Configs
  async listModelConfigs(): Promise<AiModelConfig[]> {
    const { data } = await api.get("/ai-insights/admin/model-configs");
    return data;
  },

  async getActiveModelConfig(): Promise<AiModelConfig | null> {
    const { data } = await api.get("/ai-insights/admin/model-configs/active");
    return data;
  },

  async createModelConfig(payload: Partial<AiModelConfig>): Promise<AiModelConfig> {
    const { data } = await api.post("/ai-insights/admin/model-configs", payload);
    return data;
  },

  async updateModelConfig(id: number, payload: Partial<AiModelConfig>): Promise<AiModelConfig> {
    const { data } = await api.put(`/ai-insights/admin/model-configs/${id}`, payload);
    return data;
  },

  async activateModelConfig(id: number): Promise<AiModelConfig> {
    const { data } = await api.patch(`/ai-insights/admin/model-configs/${id}/activate`);
    return data;
  },

  async deleteModelConfig(id: number): Promise<void> {
    await api.delete(`/ai-insights/admin/model-configs/${id}`);
  },

  async testModelConfig(configId?: number, prompt?: string): Promise<{
    success: boolean;
    response: string;
    modelUsed: string;
    tokensUsed: number | null;
  }> {
    const { data } = await api.post("/ai-insights/admin/model-configs/test", {
      configId,
      prompt,
    });
    return data;
  },
};
