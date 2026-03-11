import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  tempUserService,
  type TempUser,
} from "../../services/tempUser.service";
import { CreateTempUserWizard } from "../../components/temp-user/CreateTempUserWizard";

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
    const newStatus = user.status === "ACTIVE" ? false : true;
    if (confirm(`${newStatus ? "Activate" : "Deactivate"} this vendor user?`)) {
      try {
        await tempUserService.updateStatus(user.id, newStatus);
        loadUsers();
      } catch (e: any) {
        alert(e.response?.data?.message || "Error updating status");
      }
    }
  };

  const handleResetPassword = async (user: TempUser) => {
    const password = prompt(`Enter new password for ${user.user.displayName}:`);
    if (password) {
      try {
        await tempUserService.resetPassword(user.id, password);
        alert("Password reset successfully.");
      } catch (e: any) {
        alert(e.response?.data?.message || "Error resetting password");
      }
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center bg-surface-card p-4 rounded-xl shadow-sm border border-border-subtle mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Vendor User Management
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Manage temporary access for vendors and sub-contractors
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="bg-secondary hover:bg-secondary-dark text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-colors"
        >
          + Create Vendor User
        </button>
      </div>

      <div className="bg-surface-card rounded-xl shadow-sm border border-border-subtle overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-base">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">
                Name & Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">
                Vendor & WO
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">
                Role Template
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">
                Status & Expiry
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-surface-base">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-text-primary">
                    {u.user.displayName}
                  </div>
                  <div className="text-sm text-text-muted">
                    {u.user.username}
                  </div>
                  <div className="text-xs text-text-disabled">
                    {u.user.designation}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-text-primary">
                    {u.vendor?.name || "-"}
                  </div>
                  <div className="text-xs text-text-muted bg-surface-raised px-2 py-0.5 rounded inline-block mt-1">
                    WO: {u.workOrder?.woNumber || "-"}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-info-muted text-blue-800">
                    {u.tempRoleTemplate?.name || "Unknown"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u.status === "ACTIVE"
                        ? "bg-green-100 text-green-800"
                        : u.status === "SUSPENDED"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {u.status}
                  </span>
                  <div className="text-xs text-text-muted mt-1">
                    Expires: {new Date(u.expiryDate).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-3 text-sm">
                    <button
                      onClick={() => handleResetPassword(u)}
                      className="text-secondary hover:text-indigo-900 border border-indigo-200 px-2 py-1 rounded hover:bg-secondary-muted"
                    >
                      Reset Pwd
                    </button>
                    {u.status !== "EXPIRED" && (
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`px-2 py-1 rounded border transition-colors ${
                          u.status === "ACTIVE"
                            ? "text-orange-600 border-orange-200 hover:bg-orange-50"
                            : "text-success border-green-200 hover:bg-success-muted"
                        }`}
                      >
                        {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-text-muted"
                >
                  No temporary vendor users created yet.
                </td>
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
