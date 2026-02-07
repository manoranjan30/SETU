import React, { useEffect, useState } from 'react';
import { X, Save } from 'lucide-react';
import api from '../../api/axios';
import ActivityList from './ActivityList';
import clsx from 'clsx';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
    parent: any | null;
    editingNode: any | null;
}

const WbsModal: React.FC<Props> = ({ isOpen, onClose, projectId, parent, editingNode }) => {
    const [formData, setFormData] = useState({
        wbsName: '',
        isControlAccount: false,
        responsibleRoleId: '' as any,
        responsibleUserId: '' as any
    });

    // Dropdowns (mocked or fetched)
    const [users, setUsers] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    const [activeTab, setActiveTab] = useState<'properties' | 'activities'>('properties');

    useEffect(() => {
        if (isOpen) {
            setActiveTab('properties'); // Reset tab on open
            fetchMeta();
            if (editingNode) {
                setFormData({
                    wbsName: editingNode.wbsName,
                    isControlAccount: editingNode.isControlAccount,
                    responsibleRoleId: editingNode.responsibleRoleId || '',
                    responsibleUserId: editingNode.responsibleUserId || ''
                });
            } else {
                setFormData({ wbsName: '', isControlAccount: false, responsibleRoleId: '', responsibleUserId: '' });
            }
        }
    }, [isOpen, editingNode]);

    const fetchMeta = async () => {
        try {
            // In a real app, we should have a team-members endpoint for the project
            // For now, fetching global users/roles for simplicity, but WBS strictly requires Project Team
            const [u, r] = await Promise.all([
                api.get('/users'),
                api.get('/roles')
            ]);
            setUsers(u.data);
            setRoles(r.data);
        } catch (e) {
            console.error("Failed to load meta", e);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingNode) {
                const payload = { ...formData };
                if (payload.responsibleRoleId === '') payload.responsibleRoleId = null;
                if (payload.responsibleUserId === '') payload.responsibleUserId = null;

                await api.patch(`/projects/${projectId}/wbs/${editingNode.id}`, payload);
            } else {
                const payload = { ...formData };
                if (payload.responsibleRoleId === '') payload.responsibleRoleId = null;
                if (payload.responsibleUserId === '') payload.responsibleUserId = null;

                await api.post(`/projects/${projectId}/wbs`, {
                    ...payload,
                    parentId: parent?.id
                });
            }
            onClose();
        } catch (err) {
            alert('Failed to save WBS Node');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[90vh] flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800">
                        {editingNode ? 'Edit WBS Node' : 'Add WBS Node'}
                    </h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
                </div>

                {/* Tabs */}
                {editingNode && (
                    <div className="flex border-b border-gray-100 px-6">
                        <button
                            onClick={() => setActiveTab('properties')}
                            className={clsx("py-2 mr-4 text-sm font-medium border-b-2 transition-colors", activeTab === 'properties' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700")}
                        >
                            Properties
                        </button>
                        <button
                            onClick={() => setActiveTab('activities')}
                            className={clsx("py-2 text-sm font-medium border-b-2 transition-colors", activeTab === 'activities' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700")}
                        >
                            Activities
                        </button>
                    </div>
                )}

                <div className="p-6 overflow-y-auto">
                    {activeTab === 'properties' ? (
                        <form onSubmit={handleSave}>
                            {parent && !editingNode && (
                                <div className="mb-4 p-3 bg-blue-50 text-blue-700 text-sm rounded border border-blue-100">
                                    Adding child to: <strong>{parent.wbsName}</strong> ({parent.wbsCode})
                                </div>
                            )}

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">WBS Name *</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.wbsName}
                                    onChange={e => setFormData({ ...formData, wbsName: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="mb-4">
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 text-blue-600 rounded"
                                        checked={formData.isControlAccount}
                                        onChange={e => setFormData({ ...formData, isControlAccount: e.target.checked })}
                                    />
                                    <span className="ml-2 text-sm text-gray-700 font-medium">Control Account</span>
                                </label>
                                <p className="text-xs text-gray-500 ml-6 mt-1">Check this if cost/schedule aggregation happens here.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Responsible Role</label>
                                    <select
                                        className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
                                        value={formData.responsibleRoleId}
                                        onChange={e => setFormData({ ...formData, responsibleRoleId: e.target.value })}
                                    >
                                        <option value="">None</option>
                                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Responsible User</label>
                                    <select
                                        className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
                                        value={formData.responsibleUserId}
                                        onChange={e => setFormData({ ...formData, responsibleUserId: e.target.value })}
                                    >
                                        <option value="">None</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={onClose} className="px-4 py-2 hover:bg-gray-100 text-gray-700 rounded transition-colors">Cancel</button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center"
                                    disabled={saving}
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <ActivityList projectId={projectId} wbsNodeId={editingNode.id} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default WbsModal;
