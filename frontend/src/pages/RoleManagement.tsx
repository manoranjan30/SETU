import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Briefcase,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  HardHat,
  Layers,
  Lock,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Trash,
  UserCog,
  Zap,
} from "lucide-react";
import api from "../api/axios";

interface Permission {
  id: number;
  permissionCode: string;
  permissionName: string;
  moduleName: string;
  entityName?: string;
  actionType: string;
  scopeLevel: string;
  description?: string;
}

interface Role {
  id: number;
  name: string;
  description?: string;
  isLocked?: boolean;
  isSystem?: boolean;
  isActive?: boolean;
  permissions: Permission[];
}

interface ActionPreset {
  id: number;
  code: string;
  name: string;
  description?: string;
  group: string;
  tier: 1 | 2 | 3;
  icon: string;
  isSystem: boolean;
  isLocked: boolean;
  isActive: boolean;
  permissions: string[];
}

interface RoleTemplate {
  id: number;
  code: string;
  name: string;
  description?: string;
  icon: string;
  isSystem: boolean;
  isLocked: boolean;
  isActive: boolean;
  presetCodes: string[];
  presets: Array<{
    code: string;
    name: string;
    tier: 1 | 2 | 3;
    icon: string;
  }>;
}

type ActiveTab = "builder" | "presets" | "templates";

const GROUP_ORDER = [
  "Project Execution",
  "Planning & Scheduling",
  "BOQ & Cost",
  "Quality (QA/QC)",
  "Safety (EHS)",
  "Design & Drawings",
  "Labor Management",
  "Administration",
];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Eye,
  BadgeCheck,
  HardHat,
  Layers,
  FileSpreadsheet,
  ShieldCheck,
  Settings2,
  UserCog,
  Package,
  Briefcase,
};

const tierClass: Record<1 | 2 | 3, string> = {
  1: "bg-slate-100 text-slate-700 border-slate-200",
  2: "bg-blue-50 text-blue-700 border-blue-200",
  3: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const emptyPresetForm = {
  id: null as number | null,
  code: "",
  name: "",
  description: "",
  group: GROUP_ORDER[0],
  tier: 1 as 1 | 2 | 3,
  icon: "ShieldCheck",
  permissionCodes: [] as string[],
};

const emptyTemplateForm = {
  id: null as number | null,
  code: "",
  name: "",
  description: "",
  icon: "Briefcase",
  presetCodes: [] as string[],
};

const RoleManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("builder");
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [presets, setPresets] = useState<ActionPreset[]>([]);
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>(
    [],
  );
  const [selectedPresetCodes, setSelectedPresetCodes] = useState<string[]>([]);
  const [selectedTemplateCode, setSelectedTemplateCode] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");

  const [presetForm, setPresetForm] = useState(emptyPresetForm);
  const [presetSearch, setPresetSearch] = useState("");
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);

  useEffect(() => {
    void loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [rolesRes, permissionsRes, presetsRes, templatesRes] =
        await Promise.all([
          api.get<Role[]>("/roles"),
          api.get<Permission[]>("/permissions"),
          api.get<ActionPreset[]>("/role-presets"),
          api.get<RoleTemplate[]>("/role-templates"),
        ]);
      setRoles(rolesRes.data);
      setPermissions(permissionsRes.data);
      setPresets(presetsRes.data);
      setTemplates(templatesRes.data);
    } finally {
      setLoading(false);
    }
  };

  const permissionByCode = useMemo(
    () => new Map(permissions.map((permission) => [permission.permissionCode, permission])),
    [permissions],
  );

  const permissionsByModule = useMemo(() => {
    const filtered = permissions.filter((permission) => {
      const query = permissionSearch.trim().toLowerCase();
      if (!query) return true;
      return (
        permission.permissionCode.toLowerCase().includes(query) ||
        permission.permissionName.toLowerCase().includes(query) ||
        permission.moduleName.toLowerCase().includes(query)
      );
    });

    return filtered.reduce(
      (acc, permission) => {
        const bucket = acc[permission.moduleName] ?? [];
        bucket.push(permission);
        acc[permission.moduleName] = bucket.sort((a, b) =>
          a.permissionCode.localeCompare(b.permissionCode),
        );
        return acc;
      },
      {} as Record<string, Permission[]>,
    );
  }, [permissions, permissionSearch]);

  const presetGroups = useMemo(() => {
    return presets.reduce(
      (acc, preset) => {
        if (!acc[preset.group]) acc[preset.group] = [];
        acc[preset.group].push(preset);
        return acc;
      },
      {} as Record<string, ActionPreset[]>,
    );
  }, [presets]);

  const affectedModules = useMemo(
    () =>
      Array.from(
        new Set(
          selectedPermissionIds
            .map((id) => permissions.find((permission) => permission.id === id)?.moduleName)
            .filter(Boolean),
        ),
      ),
    [permissions, selectedPermissionIds],
  );

  const builderSummary = {
    permissions: selectedPermissionIds.length,
    presets: selectedPresetCodes.length,
    modules: affectedModules.length,
  };

  const togglePermissionId = (permissionId: number) => {
    setSelectedPermissionIds((current) =>
      current.includes(permissionId)
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId],
    );
  };

  const resetRoleBuilder = () => {
    setEditingRole(null);
    setName("");
    setDescription("");
    setSelectedPermissionIds([]);
    setSelectedPresetCodes([]);
    setSelectedTemplateCode("");
    setPermissionSearch("");
  };

  const applyPresetToBuilder = (preset: ActionPreset) => {
    const ids = preset.permissions
      .map((code) => permissionByCode.get(code)?.id)
      .filter(Boolean) as number[];

    setSelectedPermissionIds((current) => Array.from(new Set([...current, ...ids])));
    setSelectedPresetCodes((current) =>
      current.includes(preset.code) ? current : [...current, preset.code],
    );
    setActiveTab("builder");
  };

  const applyTemplateToBuilder = (template: RoleTemplate) => {
    const templateCodes = Array.from(
      new Set(
        template.presetCodes.flatMap(
          (presetCode) =>
            presets.find((preset) => preset.code === presetCode)?.permissions ?? [],
        ),
      ),
    );

    const ids = templateCodes
      .map((code) => permissionByCode.get(code)?.id)
      .filter(Boolean) as number[];

    setSelectedPermissionIds(ids);
    setSelectedPresetCodes(template.presetCodes);
    setSelectedTemplateCode(template.code);
    if (!editingRole) {
      setName(template.name);
      setDescription(template.description ?? "");
    }
    setActiveTab("builder");
  };

  const startEditRole = (role: Role) => {
    setEditingRole(role);
    setName(role.name);
    setDescription(role.description ?? "");
    setSelectedPermissionIds(role.permissions.map((permission) => permission.id));
    setSelectedPresetCodes([]);
    setSelectedTemplateCode("");
    setActiveTab("builder");
  };

  const saveRole = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = { name, description, permissionIds: selectedPermissionIds };

    try {
      if (editingRole) {
        await api.put(`/roles/${editingRole.id}`, payload);
      } else {
        await api.post("/roles", payload);
      }
      await loadAll();
      resetRoleBuilder();
    } catch (error: any) {
      alert(error?.response?.data?.message || "Failed to save role");
    }
  };

  const deleteRole = async (role: Role) => {
    if (role.isLocked) return;
    if (!confirm(`Delete role "${role.name}"?`)) return;
    try {
      await api.delete(`/roles/${role.id}`);
      await loadAll();
      if (editingRole?.id === role.id) resetRoleBuilder();
    } catch (error: any) {
      alert(error?.response?.data?.message || "Failed to delete role");
    }
  };

  const savePreset = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (presetForm.id) {
        await api.put(`/role-presets/${presetForm.id}`, presetForm);
      } else {
        await api.post("/role-presets", presetForm);
      }
      setPresetForm(emptyPresetForm);
      await loadAll();
    } catch (error: any) {
      alert(error?.response?.data?.message || "Failed to save preset");
    }
  };

  const editPreset = (preset: ActionPreset) => {
    if (preset.isLocked) return;
    setPresetForm({
      id: preset.id,
      code: preset.code,
      name: preset.name,
      description: preset.description ?? "",
      group: preset.group,
      tier: preset.tier,
      icon: preset.icon,
      permissionCodes: preset.permissions,
    });
    setActiveTab("presets");
  };

  const clonePreset = async (preset: ActionPreset) => {
    await api.post(`/role-presets/${preset.id}/clone`);
    await loadAll();
    setActiveTab("presets");
  };

  const archivePreset = async (preset: ActionPreset) => {
    if (preset.isLocked) return;
    if (!confirm(`Archive preset "${preset.name}"?`)) return;
    await api.delete(`/role-presets/${preset.id}`);
    await loadAll();
    if (presetForm.id === preset.id) setPresetForm(emptyPresetForm);
  };

  const togglePresetPermissionCode = (permissionCode: string) => {
    setPresetForm((current) => ({
      ...current,
      permissionCodes: current.permissionCodes.includes(permissionCode)
        ? current.permissionCodes.filter((code) => code !== permissionCode)
        : [...current.permissionCodes, permissionCode],
    }));
  };

  const saveTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (templateForm.id) {
        await api.put(`/role-templates/${templateForm.id}`, templateForm);
      } else {
        await api.post("/role-templates", templateForm);
      }
      setTemplateForm(emptyTemplateForm);
      await loadAll();
    } catch (error: any) {
      alert(error?.response?.data?.message || "Failed to save template");
    }
  };

  const editTemplate = (template: RoleTemplate) => {
    if (template.isLocked) return;
    setTemplateForm({
      id: template.id,
      code: template.code,
      name: template.name,
      description: template.description ?? "",
      icon: template.icon,
      presetCodes: template.presetCodes,
    });
    setActiveTab("templates");
  };

  const cloneTemplate = async (template: RoleTemplate) => {
    await api.post(`/role-templates/${template.id}/clone`);
    await loadAll();
    setActiveTab("templates");
  };

  const archiveTemplate = async (template: RoleTemplate) => {
    if (template.isLocked) return;
    if (!confirm(`Archive template "${template.name}"?`)) return;
    await api.delete(`/role-templates/${template.id}`);
    await loadAll();
    if (templateForm.id === template.id) setTemplateForm(emptyTemplateForm);
  };

  const toggleTemplatePresetCode = (presetCode: string) => {
    setTemplateForm((current) => ({
      ...current,
      presetCodes: current.presetCodes.includes(presetCode)
        ? current.presetCodes.filter((code) => code !== presetCode)
        : [...current.presetCodes, presetCode],
    }));
  };

  const filteredPresetFormPermissions = useMemo(() => {
    const query = presetSearch.trim().toLowerCase();
    return permissions.filter((permission) => {
      if (!query) return true;
      return (
        permission.permissionCode.toLowerCase().includes(query) ||
        permission.permissionName.toLowerCase().includes(query) ||
        permission.moduleName.toLowerCase().includes(query)
      );
    });
  }, [permissions, presetSearch]);

  const presetFormPermissionsByModule = useMemo(
    () =>
      filteredPresetFormPermissions.reduce(
        (acc, permission) => {
          const bucket = acc[permission.moduleName] ?? [];
          bucket.push(permission);
          acc[permission.moduleName] = bucket;
          return acc;
        },
        {} as Record<string, Permission[]>,
      ),
    [filteredPresetFormPermissions],
  );

  if (loading) {
    return <div className="p-6 text-sm text-text-muted">Loading permissions...</div>;
  }

  return (
    <div className="ui-shell p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="ui-title text-4xl">Role Authority</h1>
          <p className="text-sm text-text-muted mt-2">
            Build roles from reusable action presets and locked system templates,
            while keeping Admin fully protected.
          </p>
        </div>
        <div className="flex gap-2">
          {[
            { key: "builder", label: "Role Builder", icon: ShieldCheck },
            { key: "presets", label: "Action Presets", icon: Zap },
            { key: "templates", label: "Role Templates", icon: Layers },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as ActiveTab)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === key
                  ? "border-primary bg-primary-muted text-primary"
                  : "border-border-default bg-surface-card text-text-secondary hover:bg-surface-raised"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "builder" && (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <form className="ui-card p-6 space-y-6" onSubmit={saveRole}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-text-primary">
                  {editingRole ? "Edit Role" : "Create Role"}
                </h2>
                <p className="text-sm text-text-muted mt-1">
                  Start with a template or stack presets, then fine-tune only if you need to.
                </p>
              </div>
              {editingRole && (
                <button
                  type="button"
                  className="ui-btn-secondary text-sm"
                  onClick={resetRoleBuilder}
                >
                  Reset
                </button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Role Name
                </span>
                <input
                  className="ui-input w-full"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Site Engineer"
                  required
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Description
                </span>
                <input
                  className="ui-input w-full"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Short summary of this role"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-border-default bg-surface-base p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-text-primary">Quick Start</h3>
                  <p className="text-sm text-text-muted">
                    Use a role template for a full starting point, then keep stacking presets if needed.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {templates.slice(0, 6).map((template) => (
                  <button
                    key={template.code}
                    type="button"
                    onClick={() => applyTemplateToBuilder(template)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      selectedTemplateCode === template.code
                        ? "border-primary bg-primary-muted"
                        : "border-border-default bg-surface-card hover:bg-surface-raised"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-text-muted" />
                      <span className="font-semibold text-text-primary">{template.name}</span>
                      {template.isLocked && <Lock className="h-3.5 w-3.5 text-text-muted" />}
                    </div>
                    <p className="mt-2 text-sm text-text-muted line-clamp-2">
                      {template.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border-default bg-surface-base p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-text-primary">Applied Presets</h3>
                  <p className="text-sm text-text-muted">
                    Presets stay additive. Template application resets the permission base, then presets can extend it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("presets")}
                  className="text-sm font-semibold text-primary"
                >
                  Browse presets
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {selectedPresetCodes.length === 0 && (
                  <span className="text-sm text-text-muted">No presets applied yet.</span>
                )}
                {selectedPresetCodes.map((code) => {
                  const preset = presets.find((item) => item.code === code);
                  if (!preset) return null;
                  return (
                    <span
                      key={code}
                      className="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface-card px-3 py-1 text-xs font-semibold text-text-secondary"
                    >
                      <Zap className="h-3 w-3" />
                      {preset.name}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border-default bg-surface-base p-4">
                <div className="text-xs uppercase tracking-wider text-text-muted">Permissions</div>
                <div className="mt-2 text-2xl font-semibold text-text-primary">
                  {builderSummary.permissions}
                </div>
              </div>
              <div className="rounded-xl border border-border-default bg-surface-base p-4">
                <div className="text-xs uppercase tracking-wider text-text-muted">Presets</div>
                <div className="mt-2 text-2xl font-semibold text-text-primary">
                  {builderSummary.presets}
                </div>
              </div>
              <div className="rounded-xl border border-border-default bg-surface-base p-4">
                <div className="text-xs uppercase tracking-wider text-text-muted">Modules</div>
                <div className="mt-2 text-2xl font-semibold text-text-primary">
                  {builderSummary.modules}
                </div>
              </div>
            </div>

            <details className="rounded-2xl border border-border-default bg-surface-base">
              <summary className="cursor-pointer list-none px-4 py-3 font-semibold text-text-primary">
                Advanced Permission Review
              </summary>
              <div className="border-t border-border-default p-4 space-y-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
                  <input
                    className="ui-input w-full pl-10"
                    value={permissionSearch}
                    onChange={(event) => setPermissionSearch(event.target.value)}
                    placeholder="Filter permissions by code, name, or module"
                  />
                </div>
                <div className="space-y-4 max-h-[420px] overflow-auto pr-1">
                  {Object.entries(permissionsByModule).map(([moduleName, modulePermissions]) => (
                    <div key={moduleName} className="rounded-xl border border-border-default bg-surface-card p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-semibold text-text-primary">{moduleName}</h4>
                        <span className="text-xs text-text-muted">{modulePermissions.length} permissions</span>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {modulePermissions.map((permission) => (
                          <label
                            key={permission.id}
                            className="flex items-start gap-3 rounded-lg border border-border-subtle px-3 py-2 text-sm hover:bg-surface-raised"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPermissionIds.includes(permission.id)}
                              onChange={() => togglePermissionId(permission.id)}
                              className="mt-1"
                            />
                            <div>
                              <div className="font-medium text-text-primary">
                                {permission.permissionName}
                              </div>
                              <div className="text-xs text-text-muted font-mono">
                                {permission.permissionCode}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>

            <div className="flex items-center justify-between gap-4 border-t border-border-default pt-4">
              <div className="text-sm text-text-muted">
                Built-in Admin stays locked and outside this editor.
              </div>
              <button type="submit" className="ui-btn-primary">
                {editingRole ? "Save Role" : "Create Role"}
              </button>
            </div>
          </form>

          <div className="space-y-6">
            <div className="ui-card p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-text-primary">Role Directory</h2>
                  <p className="text-sm text-text-muted mt-1">
                    Locked system roles stay visible, but only custom roles are editable.
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className="rounded-xl border border-border-default bg-surface-base p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-text-primary">{role.name}</span>
                          {role.isLocked && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-card px-2 py-0.5 text-[11px] font-semibold text-text-muted">
                              <Lock className="h-3 w-3" />
                              Locked
                            </span>
                          )}
                          {role.name === "Admin" && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              Full Access
                            </span>
                          )}
                        </div>
                        {role.description && (
                          <p className="mt-1 text-sm text-text-muted">{role.description}</p>
                        )}
                        <div className="mt-2 text-xs text-text-disabled">
                          {role.permissions.length} permissions
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!role.isLocked && role.name !== "Admin" && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditRole(role)}
                              className="ui-btn-secondary"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteRole(role)}
                              className="ui-btn-secondary text-error"
                            >
                              <Trash className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {role.permissions.slice(0, 6).map((permission) => (
                        <span
                          key={permission.id}
                          className="rounded-lg border border-border-default bg-surface-card px-2 py-1 text-[11px] font-mono text-text-muted"
                        >
                          {permission.permissionCode}
                        </span>
                      ))}
                      {role.permissions.length > 6 && (
                        <span className="rounded-lg border border-border-default bg-surface-card px-2 py-1 text-[11px] text-text-muted">
                          +{role.permissions.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "presets" && (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            {GROUP_ORDER.map((group) => {
              const groupPresets = presetGroups[group] ?? [];
              if (groupPresets.length === 0) return null;
              return (
                <div key={group} className="ui-card p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-text-primary">{group}</h2>
                    <span className="text-xs text-text-muted">{groupPresets.length} presets</span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {groupPresets.map((preset) => {
                      const Icon = ICON_MAP[preset.icon] ?? Zap;
                      return (
                        <div
                          key={preset.code}
                          className="rounded-xl border border-border-default bg-surface-base p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-text-muted" />
                              <div>
                                <div className="font-semibold text-text-primary">{preset.name}</div>
                                <div className="text-xs font-mono text-text-disabled">
                                  {preset.code}
                                </div>
                              </div>
                            </div>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tierClass[preset.tier]}`}
                            >
                              Tier {preset.tier}
                            </span>
                          </div>
                          <p className="mt-3 text-sm text-text-muted">{preset.description}</p>
                          <div className="mt-3 text-xs text-text-disabled">
                            {preset.permissions.length} permissions
                            {preset.isLocked ? " · locked system preset" : ""}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => applyPresetToBuilder(preset)}
                              className="ui-btn-primary text-sm"
                            >
                              <ChevronRight className="h-4 w-4" />
                              Apply
                            </button>
                            <button
                              type="button"
                              onClick={() => clonePreset(preset)}
                              className="ui-btn-secondary text-sm"
                            >
                              <RefreshCw className="h-4 w-4" />
                              Clone
                            </button>
                            {!preset.isLocked && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => editPreset(preset)}
                                  className="ui-btn-secondary text-sm"
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => archivePreset(preset)}
                                  className="ui-btn-secondary text-sm text-error"
                                >
                                  <Trash className="h-4 w-4" />
                                  Archive
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <form className="ui-card p-6 space-y-5" onSubmit={savePreset}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-text-primary">
                  {presetForm.id ? "Edit Action Preset" : "Create Action Preset"}
                </h2>
                <p className="text-sm text-text-muted mt-1">
                  Build a reusable permission bundle for real job functions.
                </p>
              </div>
              {presetForm.id && (
                <button
                  type="button"
                  className="ui-btn-secondary text-sm"
                  onClick={() => setPresetForm(emptyPresetForm)}
                >
                  Reset
                </button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="ui-input"
                placeholder="Code"
                value={presetForm.code}
                onChange={(event) =>
                  setPresetForm((current) => ({ ...current, code: event.target.value }))
                }
                required
              />
              <input
                className="ui-input"
                placeholder="Name"
                value={presetForm.name}
                onChange={(event) =>
                  setPresetForm((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
              <select
                className="ui-input"
                value={presetForm.group}
                onChange={(event) =>
                  setPresetForm((current) => ({ ...current, group: event.target.value }))
                }
              >
                {GROUP_ORDER.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
              <select
                className="ui-input"
                value={presetForm.tier}
                onChange={(event) =>
                  setPresetForm((current) => ({
                    ...current,
                    tier: Number(event.target.value) as 1 | 2 | 3,
                  }))
                }
              >
                <option value={1}>Tier 1</option>
                <option value={2}>Tier 2</option>
                <option value={3}>Tier 3</option>
              </select>
            </div>

            <input
              className="ui-input"
              placeholder="Icon"
              value={presetForm.icon}
              onChange={(event) =>
                setPresetForm((current) => ({ ...current, icon: event.target.value }))
              }
            />

            <textarea
              className="ui-input min-h-[90px]"
              placeholder="Description"
              value={presetForm.description}
              onChange={(event) =>
                setPresetForm((current) => ({ ...current, description: event.target.value }))
              }
            />

            <div className="rounded-2xl border border-border-default bg-surface-base p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-text-primary">Permission Set</h3>
                  <p className="text-sm text-text-muted">
                    Choose exactly what this preset grants.
                  </p>
                </div>
                <span className="text-xs text-text-muted">
                  {presetForm.permissionCodes.length} selected
                </span>
              </div>
              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
                <input
                  className="ui-input w-full pl-10"
                  value={presetSearch}
                  onChange={(event) => setPresetSearch(event.target.value)}
                  placeholder="Filter permissions"
                />
              </div>
              <div className="mt-4 max-h-[420px] space-y-4 overflow-auto pr-1">
                {Object.entries(presetFormPermissionsByModule).map(([moduleName, modulePermissions]) => (
                  <div key={moduleName}>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                      {moduleName}
                    </div>
                    <div className="grid gap-2">
                      {modulePermissions.map((permission) => (
                        <label
                          key={permission.id}
                          className="flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-card px-3 py-2 text-sm hover:bg-surface-raised"
                        >
                          <input
                            type="checkbox"
                            checked={presetForm.permissionCodes.includes(permission.permissionCode)}
                            onChange={() =>
                              togglePresetPermissionCode(permission.permissionCode)
                            }
                            className="mt-1"
                          />
                          <div>
                            <div className="font-medium text-text-primary">
                              {permission.permissionName}
                            </div>
                            <div className="text-xs font-mono text-text-muted">
                              {permission.permissionCode}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="ui-btn-primary">
                <Plus className="h-4 w-4" />
                {presetForm.id ? "Save Preset" : "Create Preset"}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === "templates" && (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <div className="ui-card p-6 space-y-4">
              <h2 className="text-xl font-semibold text-text-primary">Role Templates</h2>
              <p className="text-sm text-text-muted">
                Templates stack presets into role-ready starting points. Locked system templates can be cloned, not edited.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {templates.map((template) => (
                  <div
                    key={template.code}
                    className="rounded-xl border border-border-default bg-surface-base p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-text-muted" />
                          <span className="font-semibold text-text-primary">{template.name}</span>
                          {template.isLocked && <Lock className="h-3.5 w-3.5 text-text-muted" />}
                        </div>
                        <div className="mt-1 text-xs font-mono text-text-disabled">
                          {template.code}
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-text-muted">{template.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {template.presets.map((preset) => (
                        <span
                          key={preset.code}
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tierClass[preset.tier]}`}
                        >
                          {preset.name}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => applyTemplateToBuilder(template)}
                        className="ui-btn-primary text-sm"
                      >
                        <ChevronRight className="h-4 w-4" />
                        Apply
                      </button>
                      <button
                        type="button"
                        onClick={() => cloneTemplate(template)}
                        className="ui-btn-secondary text-sm"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Clone
                      </button>
                      {!template.isLocked && (
                        <>
                          <button
                            type="button"
                            onClick={() => editTemplate(template)}
                            className="ui-btn-secondary text-sm"
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => archiveTemplate(template)}
                            className="ui-btn-secondary text-sm text-error"
                          >
                            <Trash className="h-4 w-4" />
                            Archive
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <form className="ui-card p-6 space-y-5" onSubmit={saveTemplate}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-text-primary">
                  {templateForm.id ? "Edit Role Template" : "Create Role Template"}
                </h2>
                <p className="text-sm text-text-muted mt-1">
                  Compose templates from reusable presets so roles stay consistent.
                </p>
              </div>
              {templateForm.id && (
                <button
                  type="button"
                  className="ui-btn-secondary text-sm"
                  onClick={() => setTemplateForm(emptyTemplateForm)}
                >
                  Reset
                </button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="ui-input"
                placeholder="Code"
                value={templateForm.code}
                onChange={(event) =>
                  setTemplateForm((current) => ({ ...current, code: event.target.value }))
                }
                required
              />
              <input
                className="ui-input"
                placeholder="Name"
                value={templateForm.name}
                onChange={(event) =>
                  setTemplateForm((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
            </div>

            <input
              className="ui-input"
              placeholder="Icon"
              value={templateForm.icon}
              onChange={(event) =>
                setTemplateForm((current) => ({ ...current, icon: event.target.value }))
              }
            />

            <textarea
              className="ui-input min-h-[90px]"
              placeholder="Description"
              value={templateForm.description}
              onChange={(event) =>
                setTemplateForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />

            <div className="rounded-2xl border border-border-default bg-surface-base p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-text-primary">Preset Stack</h3>
                  <p className="text-sm text-text-muted">
                    Choose the presets that make up this template.
                  </p>
                </div>
                <span className="text-xs text-text-muted">
                  {templateForm.presetCodes.length} selected
                </span>
              </div>
              <div className="mt-4 space-y-3 max-h-[420px] overflow-auto pr-1">
                {GROUP_ORDER.map((group) => {
                  const groupPresets = presetGroups[group] ?? [];
                  if (!groupPresets.length) return null;
                  return (
                    <div key={group}>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                        {group}
                      </div>
                      <div className="grid gap-2">
                        {groupPresets.map((preset) => (
                          <label
                            key={preset.code}
                            className="flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-card px-3 py-2 text-sm hover:bg-surface-raised"
                          >
                            <input
                              type="checkbox"
                              checked={templateForm.presetCodes.includes(preset.code)}
                              onChange={() => toggleTemplatePresetCode(preset.code)}
                              className="mt-1"
                            />
                            <div>
                              <div className="font-medium text-text-primary">
                                {preset.name}
                              </div>
                              <div className="text-xs text-text-muted font-mono">
                                {preset.code}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="ui-btn-primary">
                <Plus className="h-4 w-4" />
                {templateForm.id ? "Save Template" : "Create Template"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;
