import React, { useEffect, useState } from 'react';
import { type Node } from '@xyflow/react';
import api from '../../../api/axios';

interface NodePropertiesPanelProps {
    node: Node;
    onChange: (updatedData: any) => void;
    projectId: number;
}

const NodePropertiesPanel: React.FC<NodePropertiesPanelProps> = ({ node, onChange, projectId }) => {
    const data = node.data as any;
    const [users, setUsers] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, [projectId]);

    const fetchUsers = async () => {
        try {
            const res = await api.get(`/projects/${projectId}/team`);
            setUsers(res.data.map((m: any) => m.user));
        } catch (e) { }
    };

    const fetchRoles = async () => {
        try {
            const res = await api.get(`/roles`);
            setRoles(res.data);
        } catch (e) { }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        let value: any = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
        if (e.target.name === 'assignedUserId' || e.target.name === 'assignedRoleId' || e.target.name === 'stepOrder') {
            value = value ? parseInt(value, 10) : null;
        }
        onChange({ [e.target.name]: value });
    };

    return (
        <div className="h-full flex flex-col pt-16" >
            <div className="border-b px-6 py-4 bg-gray-50 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Step Properties</h3>
            </div>
            <div className="flex-1 overflow-y-auto w-full max-h-screen pb-32">
                <div className="p-6 space-y-6">

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Step Name</label>
                        <input
                            type="text"
                            name="label"
                            value={data.label || ''}
                            onChange={handleChange}
                            className="w-full border rounded-md p-2 text-sm focus:border-black"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Step Type</label>
                            <select name="stepType" value={data.stepType} onChange={handleChange} className="w-full border rounded-md p-2 text-sm">
                                <option value="RAISE_RFI">Raise RFI</option>
                                <option value="INSPECT">Inspect</option>
                                <option value="APPROVE">Approve Stage</option>
                                <option value="FINAL_APPROVE">Digital Lock</option>
                                <option value="WITNESS">Witness</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                            <input
                                type="number"
                                name="stepOrder"
                                value={data.stepOrder || 1}
                                onChange={handleChange}
                                className="w-full border rounded-md p-2 text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Assignment Mode</label>
                        <div className="flex bg-gray-100 p-1 rounded-md mb-3">
                            <button
                                className={`flex-1 py-1 text-sm rounded-sm ${data.assignmentMode === 'ROLE' ? 'bg-white shadow-sm font-semibold' : 'text-gray-500'}`}
                                onClick={() => onChange({ assignmentMode: 'ROLE', assignedUserId: null })}
                            >
                                Role
                            </button>
                            <button
                                className={`flex-1 py-1 text-sm rounded-sm ${data.assignmentMode === 'USER' ? 'bg-white shadow-sm font-semibold' : 'text-gray-500'}`}
                                onClick={() => onChange({ assignmentMode: 'USER', assignedRoleId: null })}
                            >
                                Specific User
                            </button>
                        </div>

                        {data.assignmentMode === 'USER' ? (
                            <select name="assignedUserId" value={data.assignedUserId || ''} onChange={handleChange} className="w-full border rounded-md p-2 text-sm">
                                <option value="">-- Select User --</option>
                                {users.map((u: any) => (
                                    <option key={u.id} value={u.id}>{u.username}</option>
                                ))}
                            </select>
                        ) : (
                            <select name="assignedRoleId" value={data.assignedRoleId || ''} onChange={handleChange} className="w-full border rounded-md p-2 text-sm">
                                <option value="">-- Select Role --</option>
                                {roles.map((r: any) => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="border-t pt-4">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Allowed Actions at this step</h4>
                        <div className="space-y-3">
                            {[
                                { name: 'allowRaiseRFI', label: 'Raise RFI' },
                                { name: 'allowStageApprove', label: 'Approve Stage' },
                                { name: 'allowFinalApprove', label: 'Final Approval (Digital Lock)' },
                                { name: 'allowObservation', label: 'Raise Observations' },
                                { name: 'allowReject', label: 'Reject / Terminate' },
                                { name: 'isOptional', label: 'Optional Step' },
                                { name: 'canDelegate', label: 'Delegable' },
                            ].map(opt => (
                                <label key={opt.name} className="flex items-center space-x-3 text-sm text-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name={opt.name}
                                        checked={data[opt.name] || false}
                                        onChange={handleChange}
                                        className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-black accent-black"
                                    />
                                    <span>{opt.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(NodePropertiesPanel);
