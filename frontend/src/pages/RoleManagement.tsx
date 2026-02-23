import React, { useEffect, useState, useMemo } from 'react';
import api from '../api/axios';
import {
    Plus, Trash, Edit, X, Zap, ShieldCheck, ChevronRight,
    Eye, ClipboardCheck, BadgeCheck, CalendarDays, Settings2,
    FileSpreadsheet, Database, Search, Users, UserCog, FileImage,
    Upload, ShieldAlert, HardHat, Package, Terminal, Briefcase,
    LayoutGrid, Layers, CheckCircle2, GanttChart, ClipboardList,
    BookOpen, RefreshCw,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Permission {
    id: number;
    permissionCode: string;
    permissionName: string;
    moduleName: string;
}

interface Role {
    id: number;
    name: string;
    description?: string;
    permissions: Permission[];
}

interface PermissionPreset {
    id: string;
    name: string;
    description: string;
    group: string;
    tier: 1 | 2 | 3;
    icon: string;
    permissions: string[];
}

interface CompositeRoleTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    presetIds: string[];
}

// ─── Icon Map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
    Eye, ClipboardCheck, BadgeCheck, CalendarDays, GanttChart, Settings2,
    FileSpreadsheet, ClipboardList, Database, Search, ShieldCheck,
    ShieldAlert, HardHat, FileImage, Upload, Users, UserCog,
    Package, Terminal, Briefcase, BookOpen,
};

const PresetIcon: React.FC<{ name: string; className?: string }> = ({ name, className }) => {
    const Icon = ICON_MAP[name] ?? Zap;
    return <Icon className={className} />;
};

// ─── Tier Helpers ─────────────────────────────────────────────────────────────

const TIER_CONFIG = {
    1: { label: 'Viewer', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
    2: { label: 'Contributor', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
    3: { label: 'Full Control', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
} as const;

const TierBadge: React.FC<{ tier: 1 | 2 | 3 }> = ({ tier }) => {
    const cfg = TIER_CONFIG[tier];
    return (
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            T{tier} {cfg.label}
        </span>
    );
};

// ─── Preset Group Order ────────────────────────────────────────────────────────

const GROUP_ORDER = [
    'Project Execution',
    'Planning & Scheduling',
    'BOQ & Cost',
    'Quality (QA/QC)',
    'Safety (EHS)',
    'Design & Drawings',
    'Labor Management',
    'Administration',
];

// ─── Active Tab Type ──────────────────────────────────────────────────────────

type ActiveTab = 'roles' | 'presets' | 'templates';

// ─── Main Component ───────────────────────────────────────────────────────────

const RoleManagement: React.FC = () => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
    const [allPresets, setAllPresets] = useState<PermissionPreset[]>([]);
    const [allTemplates, setAllTemplates] = useState<CompositeRoleTemplate[]>([]);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [activeTab, setActiveTab] = useState<ActiveTab>('roles');

    // Applied preset IDs (for visual feedback only — actual state is selectedPermissionIds)
    const [appliedPresetIds, setAppliedPresetIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchRoles();
        fetchPermissions();
        fetchPresets();
        fetchTemplates();
    }, []);

    const fetchRoles = async () => {
        try {
            const res = await api.get('/roles');
            setRoles(res.data);
        } catch { /* silent */ }
    };

    const fetchPermissions = async () => {
        try {
            const res = await api.get('/permissions');
            setAllPermissions(res.data);
        } catch { /* silent */ }
    };

    const fetchPresets = async () => {
        try {
            const res = await api.get('/roles/presets');
            setAllPresets(res.data);
        } catch { /* silent */ }
    };

    const fetchTemplates = async () => {
        try {
            const res = await api.get('/roles/templates');
            setAllTemplates(res.data);
        } catch { /* silent */ }
    };

    // ─── Form Handlers ────────────────────────────────────────────────────────

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingRole) {
                await api.put(`/roles/${editingRole.id}`, { name, description, permissionIds: selectedPermissionIds });
            } else {
                await api.post('/roles', { name, description, permissionIds: selectedPermissionIds });
            }
            resetForm();
            fetchRoles();
        } catch {
            alert('Failed to save role.');
        }
    };

    const startEdit = (role: Role) => {
        setEditingRole(role);
        setName(role.name);
        setDescription(role.description ?? '');
        setSelectedPermissionIds(role.permissions.map(p => p.id));
        setAppliedPresetIds(new Set());
        setActiveTab('roles');
    };

    const resetForm = () => {
        setEditingRole(null);
        setName('');
        setDescription('');
        setSelectedPermissionIds([]);
        setAppliedPresetIds(new Set());
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this role? This cannot be undone.')) return;
        try {
            await api.delete(`/roles/${id}`);
            fetchRoles();
        } catch {
            alert('Failed to delete role.');
        }
    };

    // ─── Permission Toggles ───────────────────────────────────────────────────

    const togglePermission = (id: number) => {
        setSelectedPermissionIds(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    /** Apply a single preset — adds its permissions to the current selection */
    const applyPreset = (preset: PermissionPreset) => {
        const idsToSelect = allPermissions
            .filter(p => preset.permissions.includes(p.permissionCode))
            .map(p => p.id);

        setSelectedPermissionIds(prev => Array.from(new Set([...prev, ...idsToSelect])));
        setAppliedPresetIds(prev => new Set([...prev, preset.id]));
        setActiveTab('roles');
    };

    /** Apply a composite template — stacks all its presets */
    const applyTemplate = (template: CompositeRoleTemplate) => {
        const presetCodes = allPresets
            .filter(p => template.presetIds.includes(p.id))
            .flatMap(p => p.permissions);

        const idsToSelect = allPermissions
            .filter(p => presetCodes.includes(p.permissionCode))
            .map(p => p.id);

        setSelectedPermissionIds(Array.from(new Set(idsToSelect)));
        setAppliedPresetIds(new Set(template.presetIds));

        // Pre-fill the role name if creating new
        if (!editingRole && !name) {
            setName(template.name);
            setDescription(template.description);
        }
        setActiveTab('roles');
    };

    // ─── Derived state ────────────────────────────────────────────────────────

    const groupedPermissions = useMemo(() =>
        allPermissions.reduce((acc, perm) => {
            if (!acc[perm.moduleName]) acc[perm.moduleName] = [];
            acc[perm.moduleName].push(perm);
            return acc;
        }, {} as Record<string, Permission[]>),
        [allPermissions]
    );

    const groupedPresets = useMemo(() =>
        GROUP_ORDER.reduce((acc, group) => {
            acc[group] = allPresets.filter(p => p.group === group);
            return acc;
        }, {} as Record<string, PermissionPreset[]>),
        [allPresets]
    );

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="p-4 max-w-7xl mx-auto min-h-screen">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                <div>
                    <h2 className="text-4xl font-black text-brand-black tracking-tight">Role Authority</h2>
                    <p className="text-gray-500 font-medium mt-1">Manage roles using atomic presets or full composite templates.</p>
                </div>

                <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200 shadow-inner">
                    {([
                        { key: 'roles', icon: ShieldCheck, label: 'Role Editor' },
                        { key: 'presets', icon: Zap, label: 'Action Presets' },
                        { key: 'templates', icon: Layers, label: 'Role Templates' },
                    ] as { key: ActiveTab; icon: React.FC<any>; label: string }[]).map(({ key, icon: Icon, label }) => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center space-x-2 ${activeTab === key
                                    ? 'bg-white shadow-md text-blue-600 scale-105'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            <span className="text-sm">{label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ═══ TAB: ROLE EDITOR ══════════════════════════════════════════════ */}
            {activeTab === 'roles' && (
                <div className="space-y-10">
                    <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
                        <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-50">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-800">
                                    {editingRole ? 'Update Role' : 'New Role'}
                                </h3>
                                <p className="text-blue-500 font-bold text-xs uppercase tracking-widest mt-1">
                                    {appliedPresetIds.size > 0
                                        ? `${appliedPresetIds.size} preset(s) applied`
                                        : 'Configure Access Control'}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {selectedPermissionIds.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedPermissionIds([]); setAppliedPresetIds(new Set()); }}
                                        className="text-gray-400 hover:text-red-500 text-xs font-bold px-3 py-2 rounded-xl hover:bg-red-50 transition-all flex items-center gap-1.5"
                                    >
                                        <X className="w-3.5 h-3.5" /> Clear All
                                    </button>
                                )}
                                {editingRole && (
                                    <button onClick={resetForm} className="text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl flex items-center text-sm font-bold transition-all border border-transparent hover:border-red-100">
                                        <X className="w-4 h-4 mr-2" /> Cancel Edit
                                    </button>
                                )}
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 uppercase mb-2 ml-1">Role Name *</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="e.g. Site Engineer"
                                        className="block w-full border-2 border-gray-100 rounded-2xl p-4 focus:ring-4 focus:ring-blue-50 focus:border-blue-400 transition-all font-bold text-lg text-brand-black"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 uppercase mb-2 ml-1">Description</label>
                                    <input
                                        type="text"
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Optional description"
                                        className="block w-full border-2 border-gray-100 rounded-2xl p-4 focus:ring-4 focus:ring-blue-50 focus:border-blue-400 transition-all text-gray-700"
                                    />
                                </div>
                            </div>

                            {/* Shortcut bar */}
                            <div className="flex gap-3 flex-wrap">
                                <span className="text-xs font-bold text-gray-400 uppercase self-center mr-1">Quick Apply:</span>
                                <button type="button" onClick={() => setActiveTab('presets')}
                                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all border border-blue-100">
                                    <Zap className="w-3.5 h-3.5" /> Atomic Presets
                                </button>
                                <button type="button" onClick={() => setActiveTab('templates')}
                                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100">
                                    <Layers className="w-3.5 h-3.5" /> Role Templates
                                </button>
                            </div>

                            {/* Permission Matrix */}
                            <div>
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                                            <ShieldCheck className="w-6 h-6 text-white" />
                                        </div>
                                        <h4 className="text-xl font-bold text-gray-800">Permission Matrix</h4>
                                    </div>
                                    <div className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                                        {selectedPermissionIds.length} of {allPermissions.length} selected
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {Object.entries(groupedPermissions).sort().map(([module, perms]) => (
                                        <div key={module} className="bg-gray-50/30 rounded-3xl border border-gray-100 p-5 hover:bg-white hover:shadow-xl hover:border-blue-100 transition-all group">
                                            <div className="flex items-center justify-between mb-5 border-b border-gray-100 pb-3">
                                                <h5 className="font-extrabold text-brand-black uppercase tracking-wider text-xs">{module}</h5>
                                                <div className="bg-gray-100 text-gray-500 text-[10px] font-black px-2 py-1 rounded-lg">
                                                    {perms.filter(p => selectedPermissionIds.includes(p.id)).length}/{perms.length}
                                                </div>
                                            </div>
                                            <div className="space-y-2.5">
                                                {perms.map(perm => {
                                                    const isSelected = selectedPermissionIds.includes(perm.id);
                                                    return (
                                                        <label
                                                            key={perm.id}
                                                            className={`flex items-start p-3.5 rounded-2xl cursor-pointer transition-all border ${isSelected
                                                                    ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-100'
                                                                    : 'bg-white border-gray-100 hover:border-gray-300'
                                                                }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => togglePermission(perm.id)}
                                                                className="hidden"
                                                            />
                                                            <div className="flex flex-col">
                                                                <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                                                                    {perm.permissionName}
                                                                </span>
                                                                <span className={`text-[10px] font-mono mt-1 ${isSelected ? 'text-blue-100 opacity-80' : 'text-gray-400'}`}>
                                                                    {perm.permissionCode}
                                                                </span>
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-6 flex items-center justify-between border-t border-gray-50">
                                <div className="text-gray-400 text-sm font-medium">
                                    {selectedPermissionIds.length} permissions will be saved to this role.
                                </div>
                                <button
                                    type="submit"
                                    className={`px-10 py-4 rounded-3xl font-black text-white shadow-2xl transition-all transform hover:scale-105 active:scale-95 flex items-center space-x-3 ${editingRole ? 'bg-blue-600 shadow-blue-200' : 'bg-green-600 shadow-green-200'
                                        }`}
                                >
                                    {editingRole ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                    <span>{editingRole ? 'Save Changes' : 'Create Role'}</span>
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Roles Directory Table */}
                    <div className="bg-white rounded-[40px] shadow-2xl border border-gray-50 overflow-hidden">
                        <div className="px-10 py-8 bg-gray-50/50 border-b border-gray-100">
                            <h3 className="text-2xl font-black text-gray-800">Role Directory</h3>
                            <p className="text-gray-500 text-sm mt-1">{roles.length} roles defined in the system</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-100">
                                <thead>
                                    <tr className="bg-white">
                                        <th className="px-10 py-5 text-left text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">#</th>
                                        <th className="px-10 py-5 text-left text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Role Name</th>
                                        <th className="px-10 py-5 text-left text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Permissions</th>
                                        <th className="px-10 py-5 text-right text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-50">
                                    {roles.map(role => (
                                        <tr key={role.id} className="hover:bg-blue-50/20 transition-all group">
                                            <td className="px-10 py-6 text-xs font-black text-gray-300 font-mono">#{role.id}</td>
                                            <td className="px-10 py-6 whitespace-nowrap">
                                                <div className="flex items-center space-x-3">
                                                    <div className={`w-3 h-3 rounded-full ${role.name === 'Admin' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                                                    <div>
                                                        <div className="text-lg font-extrabold text-brand-black">{role.name}</div>
                                                        {role.description && (
                                                            <div className="text-xs text-gray-400 mt-0.5">{role.description}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-10 py-6 max-w-lg">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {role.permissions?.slice(0, 8).map(p => (
                                                        <span key={p.id} className="inline-flex px-2 py-1 rounded-lg text-[10px] font-bold bg-gray-50 text-gray-500 border border-gray-100">
                                                            {p.permissionCode}
                                                        </span>
                                                    ))}
                                                    {(role.permissions?.length ?? 0) > 8 && (
                                                        <span className="inline-flex px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                                                            +{role.permissions.length - 8} more
                                                        </span>
                                                    )}
                                                    {(!role.permissions || role.permissions.length === 0) && (
                                                        <span className="text-sm italic text-gray-300">No permissions</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-10 py-6 whitespace-nowrap text-right">
                                                {role.name !== 'Admin' ? (
                                                    <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => startEdit(role)} className="p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-2xl transition-all" title="Edit">
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDelete(role.id)} className="p-2.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-2xl transition-all" title="Delete">
                                                            <Trash className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex px-5 py-2 rounded-2xl text-xs font-black bg-indigo-600 text-white uppercase tracking-widest">
                                                        Immutable
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TAB: ACTION PRESETS ══════════════════════════════════════════ */}
            {activeTab === 'presets' && (
                <div className="space-y-10">
                    {/* Hero */}
                    <div className="bg-blue-600 p-10 rounded-[50px] shadow-2xl relative overflow-hidden">
                        <div className="relative z-10 max-w-2xl">
                            <h3 className="text-4xl font-black text-white mb-3">Atomic Action Presets</h3>
                            <p className="text-blue-100 text-base font-medium leading-relaxed">
                                22 focused permission bundles organised by job function.
                                Each preset adds to your current editor selection — you can stack multiple presets.
                            </p>
                        </div>
                        <Zap className="absolute right-[-40px] bottom-[-40px] w-72 h-72 text-blue-500 opacity-15 transform rotate-12" />
                    </div>

                    {/* Tier legend */}
                    <div className="flex items-center gap-6 px-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">Tiers:</span>
                        {([1, 2, 3] as const).map(t => <TierBadge key={t} tier={t} />)}
                        <span className="text-xs text-gray-400 ml-2">Click "Deploy" to merge into current role editor</span>
                    </div>

                    {/* Grouped presets */}
                    {GROUP_ORDER.map(group => {
                        const presets = groupedPresets[group] ?? [];
                        if (presets.length === 0) return null;
                        return (
                            <div key={group}>
                                <div className="flex items-center gap-3 mb-5">
                                    <LayoutGrid className="w-5 h-5 text-gray-400" />
                                    <h4 className="text-lg font-black text-gray-700">{group}</h4>
                                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">{presets.length} presets</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    {presets.map(preset => {
                                        const isApplied = appliedPresetIds.has(preset.id);
                                        return (
                                            <div
                                                key={preset.id}
                                                className={`bg-white p-7 rounded-[28px] border-2 transition-all flex flex-col shadow-lg ${isApplied ? 'border-blue-400 shadow-blue-100' : 'border-transparent hover:border-blue-200 hover:shadow-xl'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isApplied ? 'bg-blue-600' : 'bg-gray-50'
                                                        }`}>
                                                        <PresetIcon name={preset.icon} className={`w-6 h-6 ${isApplied ? 'text-white' : 'text-blue-600'}`} />
                                                    </div>
                                                    <TierBadge tier={preset.tier} />
                                                </div>

                                                <h5 className="text-lg font-black text-gray-800 mb-2">{preset.name}</h5>
                                                <p className="text-gray-500 text-sm leading-relaxed mb-5 flex-1">{preset.description}</p>

                                                <div className="flex flex-wrap gap-1.5 mb-5">
                                                    {preset.permissions.slice(0, 5).map(code => (
                                                        <span key={code} className="bg-gray-50 text-gray-400 text-[10px] font-mono px-2 py-1 rounded-lg border border-gray-100">
                                                            {code}
                                                        </span>
                                                    ))}
                                                    {preset.permissions.length > 5 && (
                                                        <span className="bg-blue-50 text-blue-500 text-[10px] font-bold px-2 py-1 rounded-lg">
                                                            +{preset.permissions.length - 5} more
                                                        </span>
                                                    )}
                                                </div>

                                                <button
                                                    onClick={() => applyPreset(preset)}
                                                    className={`w-full py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${isApplied
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-gray-900 text-white hover:bg-blue-600 hover:shadow-xl hover:shadow-blue-200 active:scale-95'
                                                        }`}
                                                >
                                                    {isApplied ? (
                                                        <><CheckCircle2 className="w-4 h-4" /> Applied</>
                                                    ) : (
                                                        <><Zap className="w-4 h-4" /> Deploy Preset</>
                                                    )}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {/* Architecture note */}
                    <div className="bg-amber-50 border border-amber-100 p-7 rounded-3xl flex items-start gap-5">
                        <div className="bg-amber-100 p-3 rounded-2xl flex-shrink-0">
                            <ShieldCheck className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <h5 className="font-black text-amber-900 text-base mb-1">How Presets Work</h5>
                            <p className="text-amber-700 text-sm font-medium leading-relaxed">
                                Clicking "Deploy" adds permissions to your current Role Editor selection without removing any existing ones.
                                Presets are <strong>additive and stackable</strong>. Once deployed, switch to the <strong>Role Editor</strong> tab to review the final permission list and click Save.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TAB: ROLE TEMPLATES ══════════════════════════════════════════ */}
            {activeTab === 'templates' && (
                <div className="space-y-8">
                    {/* Hero */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-10 rounded-[50px] shadow-2xl relative overflow-hidden">
                        <div className="relative z-10 max-w-2xl">
                            <h3 className="text-4xl font-black text-white mb-3">Composite Role Templates</h3>
                            <p className="text-slate-300 text-base font-medium leading-relaxed">
                                8 pre-built role configurations that stack multiple presets in one click.
                                Applying a template overwrites the editor to that role's complete permission set.
                            </p>
                        </div>
                        <Layers className="absolute right-[-30px] bottom-[-30px] w-72 h-72 text-slate-700 opacity-40" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {allTemplates.map(template => {
                            const templatePresets = allPresets.filter(p => template.presetIds.includes(p.id));
                            const totalCodes = new Set(templatePresets.flatMap(p => p.permissions));

                            return (
                                <div
                                    key={template.id}
                                    className="bg-white p-8 rounded-[32px] border-2 border-transparent hover:border-slate-200 hover:shadow-2xl transition-all flex flex-col shadow-lg"
                                >
                                    <div className="flex items-start gap-4 mb-5">
                                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                                            <PresetIcon name={template.icon} className="w-7 h-7 text-slate-700" />
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-black text-gray-800">{template.name}</h4>
                                            <p className="text-gray-500 text-sm mt-1">{template.description}</p>
                                        </div>
                                    </div>

                                    {/* Preset stack */}
                                    <div className="mb-5">
                                        <p className="text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Preset Stack ({template.presetIds.length})</p>
                                        <div className="flex flex-wrap gap-2">
                                            {templatePresets.map(p => (
                                                <span key={p.id} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-50 text-slate-600 border border-slate-100">
                                                    <PresetIcon name={p.icon} className="w-3.5 h-3.5" />
                                                    {p.name}
                                                    <TierBadge tier={p.tier} />
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    <div className="flex items-center gap-3 mb-6 px-3 py-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                                        <CheckCircle2 className="w-4 h-4 text-slate-400" />
                                        <span className="text-sm font-bold text-slate-600">
                                            {totalCodes.size} unique permissions
                                        </span>
                                    </div>

                                    <button
                                        onClick={() => applyTemplate(template)}
                                        className="mt-auto w-full py-3.5 rounded-2xl bg-slate-900 text-white font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-600 hover:shadow-xl hover:shadow-blue-200 transition-all active:scale-95"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Apply Full Template
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Warning note */}
                    <div className="bg-orange-50 border border-orange-100 p-6 rounded-3xl flex items-start gap-4">
                        <div className="bg-orange-100 p-3 rounded-2xl flex-shrink-0">
                            <RefreshCw className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <h5 className="font-black text-orange-900 text-sm mb-1">Template applies a full replacement</h5>
                            <p className="text-orange-700 text-sm leading-relaxed">
                                Unlike Presets (which add to existing selections), applying a Role Template will
                                <strong> replace</strong> the editor's current permission selection with the template's full stack.
                                Go to the <strong>Role Editor</strong> tab afterwards to adjust, then click Save.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoleManagement;
