import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { tempUserService, type TempUser } from '../../services/tempUser.service';
import { CreateTempUserWizard } from '../../components/temp-user/CreateTempUserWizard';

export const VendorUserManagementPage = () => {
    const { projectId } = useParams();
    const pId = Number(projectId);

    const [users, setUsers] = useState<TempUser[]>([]);
    const [showWizard, setShowWizard] = useState(false);

    const loadUsers = async () => {
        if (!pId) return;
        try {
            const data = await tempUserService.getTempUsersInProject(pId);
            setUsers(data || []);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadUsers();
    }, [pId]);

    const handleToggleStatus = async (user: TempUser) => {
        const newStatus = user.status === 'ACTIVE' ? false : true;
        if (confirm(`${newStatus ? 'Activate' : 'Deactivate'} this vendor user?`)) {
            try {
                await tempUserService.updateStatus(user.id, newStatus);
                loadUsers();
            } catch (e: any) {
                alert(e.response?.data?.message || 'Error updating status');
            }
        }
    };

    const handleResetPassword = async (user: TempUser) => {
        const password = prompt(`Enter new password for ${user.user.displayName}:`);
        if (password) {
            try {
                await tempUserService.resetPassword(user.id, password);
                alert('Password reset successfully.');
            } catch (e: any) {
                alert(e.response?.data?.message || 'Error resetting password');
            }
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Vendor User Management</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage temporary access for vendors and sub-contractors</p>
                </div>
                <button
                    onClick={() => setShowWizard(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-colors"
                >
                    + Create Vendor User
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name & Contact</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor & WO</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role Template</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status & Expiry</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{u.user.displayName}</div>
                                    <div className="text-sm text-gray-500">{u.user.username}</div>
                                    <div className="text-xs text-gray-400">{u.user.designation}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">{u.vendor?.name || '-'}</div>
                                    <div className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded inline-block mt-1">
                                        WO: {u.workOrder?.woNumber || '-'}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        {u.tempRoleTemplate?.name || 'Unknown'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                        u.status === 'SUSPENDED' ? 'bg-orange-100 text-orange-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                        {u.status}
                                    </span>
                                    <div className="text-xs text-gray-500 mt-1">
                                        Expires: {new Date(u.expiryDate).toLocaleDateString()}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end gap-3 text-sm">
                                        <button onClick={() => handleResetPassword(u)} className="text-indigo-600 hover:text-indigo-900 border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-50">
                                            Reset Pwd
                                        </button>
                                        {u.status !== 'EXPIRED' && (
                                            <button
                                                onClick={() => handleToggleStatus(u)}
                                                className={`px-2 py-1 rounded border transition-colors ${u.status === 'ACTIVE'
                                                    ? "text-orange-600 border-orange-200 hover:bg-orange-50"
                                                    : "text-green-600 border-green-200 hover:bg-green-50"
                                                }`}
                                            >
                                                {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No temporary vendor users created yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showWizard && (
                <CreateTempUserWizard
                    projectId={pId}
                    onClose={() => setShowWizard(false)}
                    onSuccess={() => {
                        setShowWizard(false);
                        loadUsers();
                    }}
                />
            )}
        </div>
    );
};
