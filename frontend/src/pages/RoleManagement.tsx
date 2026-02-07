import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Plus, Trash, Edit, X } from 'lucide-react';

interface Permission {
    id: number;
    permissionCode: string;
    permissionName: string;
    moduleName: string;
}

interface Role {
    id: number;
    name: string;
    permissions: Permission[];
}

const RoleManagement = () => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
    const [name, setName] = useState('');
    const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);
    const [editingRole, setEditingRole] = useState<Role | null>(null);

    useEffect(() => {
        fetchRoles();
        fetchPermissions();
    }, []);

    const fetchRoles = async () => {
        try {
            const res = await api.get('/roles');
            setRoles(res.data);
        } catch (error) {
            console.error('Failed to fetch roles');
        }
    };

    const fetchPermissions = async () => {
        try {
            const res = await api.get('/permissions');
            setAllPermissions(res.data);
        } catch (error) {
            console.error('Failed to fetch permissions');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingRole) {
                await api.put(`/roles/${editingRole.id}`, { name, permissionIds: selectedPermissionIds });
            } else {
                await api.post('/roles', { name, permissionIds: selectedPermissionIds });
            }
            resetForm();
            fetchRoles();
        } catch (error) {
            alert('Failed to save role');
        }
    };

    const startEdit = (role: Role) => {
        setEditingRole(role);
        setName(role.name);
        setSelectedPermissionIds(role.permissions.map(p => p.id));
    };

    const resetForm = () => {
        setEditingRole(null);
        setName('');
        setSelectedPermissionIds([]);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure?')) return;
        try {
            await api.delete(`/roles/${id}`);
            fetchRoles();
        } catch (error) {
            alert('Failed to delete role');
        }
    };

    const togglePermission = (id: number) => {
        setSelectedPermissionIds(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    // Group permissions by module
    const groupedPermissions = allPermissions.reduce((acc, perm) => {
        if (!acc[perm.moduleName]) acc[perm.moduleName] = [];
        acc[perm.moduleName].push(perm);
        return acc;
    }, {} as Record<string, Permission[]>);

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Role Management</h2>

            <div className="bg-white p-6 rounded shadow mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">{editingRole ? 'Edit Role' : 'Create New Role'}</h3>
                    {editingRole && (
                        <button onClick={resetForm} className="text-gray-500 hover:text-gray-700 flex items-center text-sm">
                            <X className="w-4 h-4 mr-1" /> Cancel Edit
                        </button>
                    )}
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Role Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="mt-1 block w-full max-w-sm border border-gray-300 rounded-md shadow-sm p-2"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Assign Permissions</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Object.entries(groupedPermissions).map(([module, perms]) => (
                                <div key={module} className="border rounded p-4 bg-gray-50">
                                    <h4 className="font-bold text-gray-700 mb-2 border-b pb-1">{module}</h4>
                                    <div className="space-y-2">
                                        {perms.map(perm => (
                                            <label key={perm.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPermissionIds.includes(perm.id)}
                                                    onChange={() => togglePermission(perm.id)}
                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700" title={perm.permissionCode}>
                                                    {perm.permissionName}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button type="submit" className={`self-start text-white px-6 py-2 rounded flex items-center ${editingRole ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}>
                        {editingRole ? <Edit className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                        {editingRole ? 'Update Role' : 'Create Role'}
                    </button>
                </form>
            </div>

            <div className="bg-white rounded shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permissions</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {roles.map(role => (
                            <tr key={role.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{role.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-black">{role.name}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    <div className="flex flex-wrap gap-1">
                                        {role.permissions?.map(p => (
                                            <span key={p.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                {p.permissionCode}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {role.name !== 'Admin' && (
                                        <>
                                            <button onClick={() => startEdit(role)} className="text-blue-600 hover:text-blue-900 mr-4">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(role.id)} className="text-red-600 hover:text-red-900">
                                                <Trash className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                    {role.name === 'Admin' && (
                                        <span className="text-gray-400 text-xs italic">System Role</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RoleManagement;
