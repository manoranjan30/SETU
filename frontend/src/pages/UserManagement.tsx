import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Plus, Trash, Edit, X } from 'lucide-react';

interface User {
    id: number;
    username: string;
    roles: { id: number; name: string }[];
    isActive: boolean;
}

interface Role {
    id: number;
    name: string;
}

const UserManagement = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
    const [isActive, setIsActive] = useState(true);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (error) {
            console.error('Failed to fetch users');
        }
    };

    const fetchRoles = async () => {
        try {
            const res = await api.get('/roles');
            setRoles(res.data);
        } catch (error) {
            console.error('Failed to fetch roles');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                username,
                password: password || undefined, // Send undefined if empty during edit to avoid overwrite
                roles: selectedRoles,
                isActive
            };

            if (editingUser) {
                await api.put(`/users/${editingUser.id}`, payload);
            } else {
                if (!password) { alert('Password is required for new users'); return; }
                await api.post('/users', { ...payload, password });
            }

            resetForm();
            fetchUsers();
        } catch (error) {
            alert('Failed to save user');
        }
    };

    const startEdit = (user: User) => {
        setEditingUser(user);
        setUsername(user.username);
        setPassword(''); // Don't populate password
        setSelectedRoles(user.roles.map(r => r.id));
        setIsActive(user.isActive);
    };

    const resetForm = () => {
        setEditingUser(null);
        setUsername('');
        setPassword('');
        setSelectedRoles([]);
        setIsActive(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure?')) return;
        try {
            await api.delete(`/users/${id}`);
            fetchUsers();
        } catch (error) {
            alert('Failed to delete user');
        }
    };

    const toggleRole = (roleId: number) => {
        setSelectedRoles(prev =>
            prev.includes(roleId)
                ? prev.filter(id => id !== roleId)
                : [...prev, roleId]
        );
    }

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">User Management</h2>

            <div className="bg-white p-6 rounded shadow mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">{editingUser ? 'Edit User' : 'Create New User'}</h3>
                    {editingUser && (
                        <button onClick={resetForm} className="text-gray-500 hover:text-gray-700 flex items-center text-sm">
                            <X className="w-4 h-4 mr-1" /> Cancel Edit
                        </button>
                    )}
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    <div className="flex gap-6">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                required
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700">Password {editingUser && '(Leave blank to keep current)'}</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Assign Roles</label>
                        <div className="flex gap-2 flex-wrap">
                            {roles.map(role => (
                                <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => toggleRole(role.id)}
                                    className={`px-3 py-1 rounded-full text-sm border font-medium transition-colors ${selectedRoles.includes(role.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'}`}
                                >
                                    {role.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={e => setIsActive(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            <span className="ms-3 text-sm font-medium text-gray-900">{isActive ? 'User Active' : 'User Deactivated'}</span>
                        </label>
                    </div>

                    <button type="submit" className={`self-start text-white px-6 py-2 rounded flex items-center ${editingUser ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}>
                        {editingUser ? <Edit className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                        {editingUser ? 'Update User' : 'Create User'}
                    </button>
                </form>
            </div>

            <div className="bg-white rounded shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roles</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map(user => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.username}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {user.roles && user.roles.map(r => (
                                        <span key={r.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mr-1">
                                            {r.name}
                                        </span>
                                    ))}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {user.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {user.username !== 'admin' && (
                                        <>
                                            <button onClick={() => startEdit(user)} className="text-blue-600 hover:text-blue-900 mr-4">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-900">
                                                <Trash className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                    {user.username === 'admin' && (
                                        <span className="text-gray-400 text-xs italic">System User</span>
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

export default UserManagement;
