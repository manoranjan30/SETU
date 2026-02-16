
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Settings, AlertCircle, CheckCircle2, FlaskConical, Layout, FileText } from 'lucide-react';

interface SystemSetting {
    id: number;
    key: string;
    value: string;
    description: string;
    group: string;
}

const SystemSettings = () => {
    const [settings, setSettings] = useState<SystemSetting[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await axios.get(`${API_URL}/admin/settings`);
            setSettings(response.data);
            setLoading(false);
        } catch (e) {
            setError("Failed to load settings");
            setLoading(false);
        }
    };

    const handleToggle = async (key: string, currentValue: string) => {
        const newValue = currentValue === 'true' ? 'false' : 'true';
        updateSetting(key, newValue);
    };

    const updateSetting = async (key: string, value: string) => {
        setSaving(key);
        try {
            await axios.post(`${API_URL}/admin/settings/${key}`, { value });
            setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
            setSuccess(`Setting updated successfully`);
            setTimeout(() => setSuccess(null), 3000);
        } catch (e) {
            setError("Update failed");
            setTimeout(() => setError(null), 3000);
        } finally {
            setSaving(null);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Configuration...</div>;

    const designSettings = settings.filter(s => s.group === 'DESIGN');
    const generalSettings = settings.filter(s => s.group === 'GENERAL');

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
                <Settings className="w-8 h-8 text-blue-600" />
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">System Configuration</h1>
                    <p className="text-gray-500 text-sm">Manage global features and server-side toggles</p>
                </div>
            </div>

            {success && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 size={20} />
                    {success}
                </div>
            )}

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-3">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            <div className="space-y-8">
                {/* Design & CAD Section */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <FlaskConical className="w-5 h-5 text-purple-600" />
                        <h2 className="text-lg font-semibold text-gray-700">Design & CAD Engine</h2>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {designSettings.map((setting) => (
                            <SettingItem
                                key={setting.id}
                                setting={setting}
                                saving={saving === setting.key}
                                onToggle={handleToggle}
                                onUpdate={updateSetting}
                            />
                        ))}
                    </div>
                </section>

                {/* General Section */}
                {generalSettings.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <Layout className="w-5 h-5 text-blue-600" />
                            <h2 className="text-lg font-semibold text-gray-700">General Settings</h2>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {generalSettings.map((setting) => (
                                <SettingItem
                                    key={setting.id}
                                    setting={setting}
                                    saving={saving === setting.key}
                                    onToggle={handleToggle}
                                    onUpdate={updateSetting}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* Tools Section */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <h2 className="text-lg font-semibold text-gray-700">Tools</h2>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                        <Link
                            to="/dashboard/admin/template-builder"
                            className="flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors"
                        >
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-medium text-gray-800">PDF Template Builder</h3>
                                <p className="text-sm text-gray-500">Create and manage templates for extracting data from PDFs</p>
                            </div>
                            <span className="text-gray-400">→</span>
                        </Link>
                    </div>
                </section>
            </div>
        </div>
    );
};

const SettingItem = ({ setting, saving, onToggle, onUpdate }: any) => (
    <div className="p-5 border-b last:border-0 hover:bg-gray-50 transition-colors">
        <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
                <h3 className="font-mono text-sm font-bold text-gray-800 mb-1">{setting.key}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{setting.description}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
                {setting.value === 'true' || setting.value === 'false' ? (
                    <button
                        onClick={() => onToggle(setting.key, setting.value)}
                        disabled={saving}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${setting.value === 'true' ? 'bg-blue-600' : 'bg-gray-200'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${setting.value === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                ) : (
                    <input
                        type="text"
                        defaultValue={setting.value}
                        onBlur={(e) => onUpdate(setting.key, e.target.value)}
                        className="w-20 px-2 py-1 text-sm border rounded bg-gray-50 font-mono text-center"
                    />
                )}
                {saving && <span className="text-[10px] text-blue-500 animate-pulse">Syncing...</span>}
            </div>
        </div>
    </div>
);

export default SystemSettings;
