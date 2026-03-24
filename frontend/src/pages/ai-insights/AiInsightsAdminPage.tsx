import React, { useEffect, useState, useCallback } from "react";
import {
  Brain, Plus, Trash2, CheckCircle2, XCircle, Loader2,
  Zap, Settings, FlaskConical, ChevronDown, ChevronUp,
  Edit3, Save, X,
} from "lucide-react";
import { aiInsightsService } from "../../services/aiInsights.service";
import type { AiModelConfig, InsightTemplate } from "../../services/aiInsights.service";

// ─── Tabs ──────────────────────────────────────────────────────────────────

type Tab = "providers" | "templates";

const AiInsightsAdminPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>("providers");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Brain size={24} className="text-indigo-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">AI Insights — Admin</h1>
          <p className="text-sm text-gray-500">Manage AI providers and insight templates.</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["providers", "templates"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition
              ${tab === t
                ? "bg-white shadow text-indigo-700"
                : "text-gray-500 hover:text-gray-800"
              }`}
          >
            {t === "providers" ? "AI Providers" : "Templates"}
          </button>
        ))}
      </div>

      {tab === "providers" && <ProviderPanel />}
      {tab === "templates" && <TemplatesPanel />}
    </div>
  );
};

// ─── Provider Panel ────────────────────────────────────────────────────────

const EMPTY_CONFIG: Partial<AiModelConfig> = {
  provider: "openrouter",
  model: "meta-llama/llama-3.3-70b-instruct:free",
  maxTokens: 4096,
  temperature: 0.2,
  isActive: false,
  label: "",
};

const ProviderPanel: React.FC = () => {
  const [configs, setConfigs] = useState<AiModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<AiModelConfig> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [testResult, setTestResult] = useState<{
    configId: number;
    ok: boolean;
    msg: string;
  } | null>(null);
  const [testing, setTesting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConfigs(await aiInsightsService.listModelConfigs());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing) return;
    try {
      if (isNew) {
        await aiInsightsService.createModelConfig(editing);
      } else if (editing.id) {
        await aiInsightsService.updateModelConfig(editing.id, editing);
      }
      setEditing(null);
      setIsNew(false);
      load();
    } catch (e) {
      alert("Save failed: " + e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this AI provider config?")) return;
    try {
      await aiInsightsService.deleteModelConfig(id);
      load();
    } catch (e) {
      alert("Delete failed: " + e);
    }
  };

  const handleActivate = async (id: number) => {
    try {
      await aiInsightsService.activateModelConfig(id);
      load();
    } catch (e) {
      alert("Activation failed: " + e);
    }
  };

  const handleTest = async (id: number) => {
    setTesting(id);
    setTestResult(null);
    try {
      const r = await aiInsightsService.testModelConfig(id);
      setTestResult({ configId: id, ok: r.success, msg: r.response.slice(0, 200) });
    } catch (e) {
      setTestResult({ configId: id, ok: false, msg: String(e) });
    } finally {
      setTesting(null);
    }
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-700">AI Provider Configurations</h2>
        <button
          onClick={() => { setEditing({ ...EMPTY_CONFIG }); setIsNew(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus size={14} /> Add Provider
        </button>
      </div>

      {/* Config List */}
      <div className="space-y-3">
        {configs.map((c) => (
          <div
            key={c.id}
            className={`bg-white rounded-xl border p-4 ${c.isActive ? "border-indigo-300 ring-1 ring-indigo-200" : "border-gray-200"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 text-sm">
                    {c.label || `${c.provider} / ${c.model}`}
                  </p>
                  {c.isActive && (
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {c.provider} · {c.model} · {c.maxTokens} tokens · temp {c.temperature}
                </p>
                {c.notes && <p className="text-xs text-gray-400 mt-1 italic">{c.notes}</p>}
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                {!c.isActive && (
                  <button
                    onClick={() => handleActivate(c.id)}
                    title="Set as active"
                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition"
                  >
                    <Zap size={15} />
                  </button>
                )}
                <button
                  onClick={() => handleTest(c.id)}
                  disabled={testing === c.id}
                  title="Test connection"
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                >
                  {testing === c.id ? <Loader2 size={15} className="animate-spin" /> : <FlaskConical size={15} />}
                </button>
                <button
                  onClick={() => { setEditing({ ...c }); setIsNew(false); }}
                  title="Edit"
                  className="p-1.5 text-gray-500 hover:bg-gray-50 rounded transition"
                >
                  <Settings size={15} />
                </button>
                {!c.isActive && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    title="Delete"
                    className="p-1.5 text-red-400 hover:bg-red-50 rounded transition"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Test result */}
            {testResult?.configId === c.id && (
              <div className={`mt-3 p-3 rounded-lg text-xs ${testResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                <div className="flex items-center gap-1.5 font-semibold mb-1">
                  {testResult.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  {testResult.ok ? "Connection OK" : "Connection Failed"}
                </div>
                <code className="break-all">{testResult.msg}</code>
              </div>
            )}
          </div>
        ))}

        {configs.length === 0 && (
          <p className="text-sm text-gray-400 italic">No AI provider configured yet.</p>
        )}
      </div>

      {/* Edit / Create Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">
                {isNew ? "Add AI Provider" : "Edit AI Provider"}
              </h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <Field label="Label (display name)">
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={editing.label ?? ""}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  placeholder="e.g. OpenRouter – Llama 3.3 70B"
                />
              </Field>

              <Field label="Provider">
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={editing.provider ?? "openrouter"}
                  onChange={(e) =>
                    setEditing({ ...editing, provider: e.target.value as AiModelConfig["provider"] })
                  }
                >
                  <option value="openrouter">OpenRouter</option>
                  <option value="openai">OpenAI</option>
                  <option value="azure">Azure OpenAI</option>
                </select>
              </Field>

              <Field label="Model / Deployment Name">
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={editing.model ?? ""}
                  onChange={(e) => setEditing({ ...editing, model: e.target.value })}
                  placeholder="meta-llama/llama-3.3-70b-instruct:free"
                />
              </Field>

              <Field label="API Key (leave blank to use AI_API_KEY env var)">
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  type="password"
                  value={editing.apiKey ?? ""}
                  onChange={(e) => setEditing({ ...editing, apiKey: e.target.value || null })}
                  placeholder="sk-or-..."
                />
              </Field>

              <Field label="Base URL (optional, for self-hosted / custom endpoints)">
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={editing.endpoint ?? ""}
                  onChange={(e) => setEditing({ ...editing, endpoint: e.target.value || null })}
                  placeholder="https://openrouter.ai/api/v1"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Max Tokens">
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    type="number"
                    value={editing.maxTokens ?? 4096}
                    onChange={(e) => setEditing({ ...editing, maxTokens: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Temperature (0–2)">
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    type="number"
                    step="0.1"
                    min={0}
                    max={2}
                    value={editing.temperature ?? 0.2}
                    onChange={(e) => setEditing({ ...editing, temperature: Number(e.target.value) })}
                  />
                </Field>
              </div>

              {/* Azure-specific fields */}
              {editing.provider === "azure" && (
                <div className="space-y-3 border border-blue-100 rounded-xl p-4 bg-blue-50">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                    Azure Service Principal (optional — use if not using API key)
                  </p>
                  <Field label="Tenant ID">
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300" value={editing.azureTenantId ?? ""} onChange={(e) => setEditing({ ...editing, azureTenantId: e.target.value || null })} />
                  </Field>
                  <Field label="Client ID">
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300" value={editing.azureClientId ?? ""} onChange={(e) => setEditing({ ...editing, azureClientId: e.target.value || null })} />
                  </Field>
                  <Field label="Client Secret">
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300" type="password" value={editing.azureClientSecret ?? ""} onChange={(e) => setEditing({ ...editing, azureClientSecret: e.target.value || null })} />
                  </Field>
                  <Field label="Deployment Name">
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300" value={editing.azureDeployment ?? ""} onChange={(e) => setEditing({ ...editing, azureDeployment: e.target.value || null })} />
                  </Field>
                </div>
              )}

              <Field label="Notes (internal)">
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  rows={2}
                  value={editing.notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value || null })}
                />
              </Field>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.isActive ?? false}
                  onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                  className="w-4 h-4 rounded accent-indigo-600"
                />
                <span className="text-sm text-gray-700">Set as active provider</span>
              </label>
            </div>

            <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                <Save size={14} /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Templates Panel ───────────────────────────────────────────────────────

const TemplatesPanel: React.FC = () => {
  const [templates, setTemplates] = useState<InsightTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<InsightTemplate>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await aiInsightsService.listTemplates(true));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (t: InsightTemplate) => {
    setEditingId(t.id);
    setEditDraft({ ...t });
  };

  const startCreate = () => {
    setEditingId("new");
    setEditDraft({
      name: "",
      slug: "",
      scope: "PROJECT",
      isActive: true,
      isSystem: false,
      requiredPermission: "AI.INSIGHTS.RUN",
      dataSources: [],
      promptTemplate: "",
      icon: "Brain",
      tags: [],
      sortOrder: 99,
    });
  };

  const handleSave = async () => {
    try {
      if (editingId === "new") {
        await aiInsightsService.createTemplate(editDraft);
      } else if (typeof editingId === "number") {
        await aiInsightsService.updateTemplate(editingId, editDraft);
      }
      setEditingId(null);
      load();
    } catch (e) {
      alert("Save failed: " + e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this template?")) return;
    try {
      await aiInsightsService.deleteTemplate(id);
      load();
    } catch (e) {
      alert("Delete failed: " + e);
    }
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-700">Insight Templates</h2>
        <button
          onClick={startCreate}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus size={14} /> New Template
        </button>
      </div>

      <div className="space-y-2">
        {templates.map((t) => (
          <div
            key={t.id}
            className={`bg-white rounded-xl border ${!t.isActive ? "opacity-60" : ""} border-gray-200 overflow-hidden`}
          >
            <button
              className="w-full text-left px-4 py-3 flex items-center gap-3"
              onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
            >
              <span className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500 flex-shrink-0">
                <Brain size={14} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                  {t.isSystem && (
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">system</span>
                  )}
                  {!t.isActive && (
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-600 text-xs rounded">inactive</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate">{t.slug} · {t.scope}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(t); }}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                >
                  <Edit3 size={14} />
                </button>
                {!t.isSystem && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                {expandedId === t.id
                  ? <ChevronUp size={14} className="text-gray-400" />
                  : <ChevronDown size={14} className="text-gray-400" />
                }
              </div>
            </button>

            {expandedId === t.id && (
              <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-2">
                <p className="text-sm text-gray-600">{t.description}</p>
                <div className="text-xs text-gray-400 space-y-1">
                  <p><strong>Data sources:</strong> {t.dataSources.map((d: { key: string }) => d.key).join(", ")}</p>
                  <p><strong>Permission:</strong> {t.requiredPermission}</p>
                  <p><strong>Tags:</strong> {t.tags.join(", ") || "—"}</p>
                </div>
                <details className="mt-2">
                  <summary className="text-xs text-indigo-600 cursor-pointer">View prompt template</summary>
                  <pre className="mt-2 text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap text-gray-600">
                    {t.promptTemplate}
                  </pre>
                </details>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Template Edit Modal */}
      {editingId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">
                {editingId === "new" ? "New Template" : "Edit Template"}
              </h3>
              <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name">
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300" value={editDraft.name ?? ""} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
                </Field>
                <Field label="Slug (URL-safe ID)">
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300" value={editDraft.slug ?? ""} onChange={(e) => setEditDraft({ ...editDraft, slug: e.target.value })} />
                </Field>
              </div>

              <Field label="Description">
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300" rows={2} value={editDraft.description ?? ""} onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Scope">
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300" value={editDraft.scope ?? "PROJECT"} onChange={(e) => setEditDraft({ ...editDraft, scope: e.target.value as "PROJECT" | "GLOBAL" })}>
                    <option value="PROJECT">PROJECT</option>
                    <option value="GLOBAL">GLOBAL</option>
                  </select>
                </Field>
                <Field label="Required Permission">
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300" value={editDraft.requiredPermission ?? "AI.INSIGHTS.RUN"} onChange={(e) => setEditDraft({ ...editDraft, requiredPermission: e.target.value })} />
                </Field>
              </div>

              <Field label="Data Sources (JSON array)">
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono text-xs"
                  rows={4}
                  value={JSON.stringify(editDraft.dataSources ?? [], null, 2)}
                  onChange={(e) => {
                    try {
                      setEditDraft({ ...editDraft, dataSources: JSON.parse(e.target.value) });
                    } catch {}
                  }}
                />
              </Field>

              <Field label="Prompt Template (use {{variable}} placeholders)">
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono text-xs"
                  rows={10}
                  value={editDraft.promptTemplate ?? ""}
                  onChange={(e) => setEditDraft({ ...editDraft, promptTemplate: e.target.value })}
                />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Icon (Lucide name)">
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300" value={editDraft.icon ?? "Brain"} onChange={(e) => setEditDraft({ ...editDraft, icon: e.target.value })} />
                </Field>
                <Field label="Tags (comma separated)">
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    value={(editDraft.tags ?? []).join(", ")}
                    onChange={(e) => setEditDraft({ ...editDraft, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                  />
                </Field>
                <Field label="Sort Order">
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300" type="number" value={editDraft.sortOrder ?? 0} onChange={(e) => setEditDraft({ ...editDraft, sortOrder: Number(e.target.value) })} />
                </Field>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editDraft.isActive ?? true}
                  onChange={(e) => setEditDraft({ ...editDraft, isActive: e.target.checked })}
                  className="w-4 h-4 rounded accent-indigo-600"
                />
                <span className="text-sm text-gray-700">Active (visible to users)</span>
              </label>
            </div>

            <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setEditingId(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                <Save size={14} /> Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Field helper ─────────────────────────────────────────────────────────────

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    {children}
  </div>
);

export default AiInsightsAdminPage;
