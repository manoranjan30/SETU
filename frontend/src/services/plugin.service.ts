import api from "../api/axios";

export interface PluginDefinition {
  id: number;
  pluginKey: string;
  version: string;
  status: string;
  plugin: Record<string, any>;
  menus: any[];
  pages: any[];
  widgets: any[];
  reports: any[];
  workflows: any[];
  settings: any[];
  settingsSchema?: Record<string, any> | null;
  settingsValues?: Record<string, any>;
}

export const pluginService = {
  async listInstalls() {
    const { data } = await api.get("/plugins");
    return data;
  },

  async getInstall(id: number) {
    const { data } = await api.get(`/plugins/${id}`);
    return data;
  },

  async installBundle(bundle: Record<string, any>, approvalSource?: string) {
    const { data } = await api.post("/plugins/install", { bundle, approvalSource });
    return data;
  },

  async uploadBundle(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post("/plugins/install/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  async enable(id: number) {
    const { data } = await api.patch(`/plugins/${id}/enable`);
    return data;
  },

  async disable(id: number, reason?: string) {
    const { data } = await api.patch(`/plugins/${id}/disable`, { reason });
    return data;
  },

  async uninstall(id: number, reason?: string) {
    const { data } = await api.patch(`/plugins/${id}/uninstall`, { reason });
    return data;
  },

  async updateSettings(id: number, values: Record<string, any>) {
    const { data } = await api.patch(`/plugins/${id}/settings`, { values });
    return data;
  },

  async getRuntimeManifest(projectId?: number) {
    const { data } = await api.get("/plugins/runtime/manifest", {
      params: projectId ? { projectId } : undefined,
    });
    return data;
  },

  async runPageQuery(pluginKey: string, pageKey: string, payload?: Record<string, any>) {
    const { data } = await api.post(
      `/plugins/runtime/pages/${pluginKey}/${pageKey}/query`,
      payload ?? {},
    );
    return data;
  },

  async runReport(pluginKey: string, reportKey: string, payload?: Record<string, any>) {
    const { data } = await api.post(
      `/plugins/runtime/reports/${pluginKey}/${reportKey}/run`,
      payload ?? {},
    );
    return data;
  },
};
