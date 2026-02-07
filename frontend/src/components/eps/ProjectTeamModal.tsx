import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { X, Plus, Trash2, Users, ChevronRight, ChevronDown, Folder, Grid, Component, Layers } from 'lucide-react';
import clsx from 'clsx';

interface ProjectTeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
    projectName: string;
}

interface TeamMember {
    id: number;
    user: { id: number; username: string };
    role: { id: number; name: string };
    scopeType: 'FULL' | 'LIMITED';
    scopeNodeId?: number;
    status: 'ACTIVE' | 'INACTIVE';
}

interface User {
    id: number;
    username: string;
}

interface Role {
    id: number;
    name: string;
}

interface EpsNode {
    id: number;
    name: string;
    type: string;
    children?: EpsNode[];
}

const ProjectTeamModal: React.FC<ProjectTeamModalProps> = ({ isOpen, onClose, projectId, projectName }) => {
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [projectTree, setProjectTree] = useState<EpsNode[]>([]);
    const [loading, setLoading] = useState(false);

    // Form
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [scopeType, setScopeType] = useState<'FULL' | 'LIMITED'>('FULL');
    const [selectedScopeNodeId, setSelectedScopeNodeId] = useState<number | null>(null);
    const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});

    useEffect(() => {
        if (isOpen && projectId) {
            fetchData();
        }
    }, [isOpen, projectId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Parallel fetch for speed
            const [teamRes, usersRes, rolesRes, epsRes] = await Promise.allSettled([
                api.get(`/projects/${projectId}/team`),
                api.get('/users'),
                api.get('/roles'),
                api.get('/eps') // Fetch full tree, we will filter for this project
            ]);

            if (teamRes.status === 'fulfilled') setMembers(teamRes.value.data);
            if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data);
            if (rolesRes.status === 'fulfilled') setRoles(rolesRes.value.data);

            if (epsRes.status === 'fulfilled') {
                // Find the project node in the full tree
                const fullTree = buildTree(epsRes.value.data);
                const projectNode = findNodeInTree(fullTree, projectId);
                setProjectTree(projectNode ? [projectNode] : []);
                if (projectNode) {
                    setExpandedNodes({ [projectNode.id]: true });
                }
            }

        } catch (error) {
            console.error('Failed to load team data', error);
        } finally {
            setLoading(false);
        }
    };

    // Helper: Build Tree (Duplicate from EpsPage, ideally shared utility in future)
    const buildTree = (flatList: any[]): EpsNode[] => {
        const map = new Map<number, EpsNode>();
        const roots: EpsNode[] = [];
        flatList.forEach(node => map.set(node.id, { ...node, children: [] }));
        flatList.forEach(node => {
            const mappedNode = map.get(node.id)!;
            if (node.parentId) {
                const parent = map.get(node.parentId);
                if (parent) parent.children?.push(mappedNode);
            } else {
                roots.push(mappedNode);
            }
        });
        return roots;
    };

    const findNodeInTree = (nodes: EpsNode[], targetId: number): EpsNode | null => {
        for (const node of nodes) {
            if (node.id === targetId) return node;
            if (node.children) {
                const found = findNodeInTree(node.children, targetId);
                if (found) return found;
            }
        }
        return null;
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();

        if (scopeType === 'LIMITED' && !selectedScopeNodeId) {
            alert('Please select a hierarchy node for Limited Scope.');
            return;
        }

        try {
            await api.post(`/projects/${projectId}/assign`, {
                userId: parseInt(selectedUser),
                roleId: parseInt(selectedRole),
                scopeType: scopeType,
                scopeNodeId: scopeType === 'LIMITED' ? selectedScopeNodeId : null
            });

            // Reset & Refresh
            setSelectedUser('');
            setSelectedRole('');
            setScopeType('FULL');
            setSelectedScopeNodeId(null);

            // Re-fetch only team to update list
            const res = await api.get(`/projects/${projectId}/team`);
            setMembers(res.data);
        } catch (error: any) {
            console.error(error);
            alert(error.response?.data?.message || 'Failed to add team member');
        }
    };

    const handleRemove = async (userId: number) => {
        if (!confirm('Remove this user from the project?')) return;
        try {
            await api.delete(`/projects/${projectId}/users/${userId}`);
            const res = await api.get(`/projects/${projectId}/team`);
            setMembers(res.data);
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to remove team member');
        }
    };

    const toggleExpand = (id: number) => {
        setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const renderScopeTree = (nodes: EpsNode[]) => {
        return nodes.map(node => (
            <div key={node.id} className="ml-2 border-l border-gray-200 pl-2 py-0.5">
                <div
                    className={clsx("flex items-center group cursor-pointer p-1 rounded", {
                        "bg-blue-100 ring-1 ring-blue-500": selectedScopeNodeId === node.id,
                        "hover:bg-gray-100": selectedScopeNodeId !== node.id
                    })}
                    onClick={() => {
                        // Prevent selecting the Project root itself as "Limited" - that's just "Full"
                        if (node.id === projectId) {
                            alert("Selecting the Project Root is equivalent to Full Access. Please select 'Full Project' instead.");
                            setScopeType('FULL');
                            return;
                        }
                        setSelectedScopeNodeId(node.id);
                    }}
                >
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
                        className="mr-1 p-0.5 hover:bg-gray-200 rounded text-gray-500"
                        style={{ visibility: (node.children && node.children.length > 0) ? 'visible' : 'hidden' }}
                    >
                        {expandedNodes[node.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>

                    <span className={clsx("mr-1", {
                        'text-blue-600': node.type === 'PROJECT',
                        'text-purple-600': node.type === 'BLOCK',
                        'text-orange-600': node.type === 'TOWER',
                        'text-green-600': node.type === 'FLOOR',
                    })}>
                        {node.type === 'PROJECT' && <Folder className="w-3 h-3" />}
                        {node.type === 'BLOCK' && <Grid className="w-3 h-3" />}
                        {node.type === 'TOWER' && <Component className="w-3 h-3" />}
                        {node.type === 'FLOOR' && <Layers className="w-3 h-3" />}
                    </span>
                    <span className="text-sm text-gray-700">{node.name}</span>
                </div>
                {expandedNodes[node.id] && node.children && (
                    <div className="ml-1">
                        {renderScopeTree(node.children)}
                    </div>
                )}
            </div>
        ));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">Project Team</h2>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">{projectName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex gap-6">
                    {/* LEFT: Add Member Form */}
                    <div className="flex-1">
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mb-6 shadow-sm">
                            <h3 className="text-sm font-bold text-blue-800 mb-3 flex items-center">
                                <Plus className="w-4 h-4 mr-1" /> Add Assignment
                            </h3>
                            <form onSubmit={handleAddMember} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">User</label>
                                    <select
                                        className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                                        value={selectedUser}
                                        onChange={e => setSelectedUser(e.target.value)}
                                        required
                                    >
                                        <option value="">Select User...</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
                                    <select
                                        className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                                        value={selectedRole}
                                        onChange={e => setSelectedRole(e.target.value)}
                                        required
                                    >
                                        <option value="">Select Role...</option>
                                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Access Scope</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center text-sm cursor-pointer">
                                            <input
                                                type="radio"
                                                name="scope"
                                                value="FULL"
                                                checked={scopeType === 'FULL'}
                                                onChange={() => setScopeType('FULL')}
                                                className="mr-2"
                                            />
                                            Full Project
                                        </label>
                                        <label className="flex items-center text-sm cursor-pointer">
                                            <input
                                                type="radio"
                                                name="scope"
                                                value="LIMITED"
                                                checked={scopeType === 'LIMITED'}
                                                onChange={() => setScopeType('LIMITED')}
                                                className="mr-2"
                                            />
                                            Limited Hierarchy
                                        </label>
                                    </div>
                                </div>

                                {scopeType === 'LIMITED' && (
                                    <div className="border border-gray-300 rounded bg-white mt-2 max-h-48 overflow-y-auto p-2">
                                        <div className="text-xs text-gray-500 mb-2 uppercase font-bold tracking-wider">Select Scope Root:</div>
                                        {projectTree.length > 0 ? (
                                            renderScopeTree(projectTree)
                                        ) : (
                                            <div className="text-xs text-red-500">Project structure not loaded or empty.</div>
                                        )}
                                        {selectedScopeNodeId && (
                                            <div className="mt-2 text-xs bg-green-50 text-green-700 p-1 rounded border border-green-200">
                                                Selected ID: {selectedScopeNodeId}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || (scopeType === 'LIMITED' && !selectedScopeNodeId)}
                                    className="w-full bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                                >
                                    Assign to Team
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* RIGHT: Team List */}
                    <div className="flex-[1.5] border-l border-gray-100 pl-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4 border-b pb-2">Current Team ({members.length})</h3>

                        {loading && members.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">Loading team data...</div>
                        ) : members.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded border border-dashed text-gray-400">
                                No team members assigned yet.
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                                {members.map(m => (
                                    <div key={m.id} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200 hover:border-blue-300 transition-colors shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs ring-2 ring-white">
                                                {m.user.username.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900 text-sm">{m.user.username}</div>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-medium border border-gray-200">{m.role.name}</span>
                                                    {m.scopeType === 'FULL' ? (
                                                        <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">Full Access</span>
                                                    ) : (
                                                        <span className="text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100" title={`Limited to Node ID: ${m.scopeNodeId}`}>
                                                            Limited Scope
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleRemove(m.user.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Remove from Project"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectTeamModal;
