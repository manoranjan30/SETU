import { useEffect, useState } from "react";
import {
  tempUserService,
  type TempRoleTemplate,
} from "../../services/tempUser.service";
import { TEMP_USER_ASSIGNABLE_PERMISSIONS } from "./temp-user-permissions.constants"; // I'll create this file next

export const VendorAccessTemplatesPage = () => {
  const [templates, setTemplates] = useState<TempRoleTemplate[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TempRoleTemplate | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    allowedPermissions: [] as string[],
  });

  const loadTemplates = async () => {
    try {
      const data = await tempUserService.getTemplates();
      setTemplates(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await tempUserService.updateTemplate(editing.id, formData);
      } else {
        await tempUserService.createTemplate(formData);
      }
      setShowModal(false);
      setEditing(null);
      loadTemplates();
    } catch (e) {
      alert("Error saving template");
    }
  };

  const handleDeactivate = async (id: number) => {
    if (confirm("Are you sure you want to deactivate this template?")) {
      await tempUserService.deleteTemplate(id);
      loadTemplates();
    }
  };

  const openEdit = (t: TempRoleTemplate) => {
    setEditing(t);
    setFormData({
      name: t.name,
      description: t.description || "",
      allowedPermissions: t.allowedPermissions || [],
    });
    setShowModal(true);
  };

  const togglePermission = (code: string) => {
    setFormData((prev) => ({
      ...prev,
      allowedPermissions: prev.allowedPermissions.includes(code)
        ? prev.allowedPermissions.filter((p) => p !== code)
        : [...prev.allowedPermissions, code],
    }));
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center bg-surface-card p-4 rounded-xl shadow-sm border border-border-subtle mb-6">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-emerald-600">
            Vendor Access Templates
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Manage role ceilings for temporary vendor users
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setFormData({ name: "", description: "", allowedPermissions: [] });
            setShowModal(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          + New Template
        </button>
      </div>

      <div className="bg-surface-card rounded-xl shadow-sm border border-border-subtle overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-base">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Permissions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-surface-card divide-y divide-gray-200">
            {templates.map((t) => (
              <tr
                key={t.id}
                className="hover:bg-surface-base transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">
                  {t.name}
                </td>
                <td className="px-6 py-4 text-sm text-text-muted">
                  {t.description}
                </td>
                <td className="px-6 py-4 text-sm text-text-muted">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-info-muted text-blue-800">
                    {t.allowedPermissions?.length || 0} permissions
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${t.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                  >
                    {t.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => openEdit(t)}
                    className="text-secondary hover:text-indigo-900 mr-4"
                  >
                    Edit
                  </button>
                  {t.isActive && (
                    <button
                      onClick={() => handleDeactivate(t.id)}
                      className="text-error hover:text-red-900"
                    >
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-text-muted"
                >
                  No templates found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-surface-card rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-border-subtle flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">
                {editing ? "Edit Template" : "Create Template"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-text-disabled hover:text-text-secondary"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g., Vendor-RFI Reporter"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    rows={2}
                  />
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-text-secondary mb-3 border-b pb-2">
                    Allowed Permissions
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(TEMP_USER_ASSIGNABLE_PERMISSIONS).map(
                      ([module, perms]) => (
                        <div
                          key={module}
                          className="bg-surface-base p-4 rounded-lg border border-border-subtle"
                        >
                          <h4 className="text-sm font-semibold text-gray-800 mb-3">
                            {module}
                          </h4>
                          <div className="space-y-2">
                            {perms.map((p) => (
                              <label
                                key={p.key}
                                className="flex items-start space-x-3"
                              >
                                <input
                                  type="checkbox"
                                  checked={formData.allowedPermissions.includes(
                                    p.key,
                                  )}
                                  onChange={() => togglePermission(p.key)}
                                  className="mt-1 h-4 w-4 text-success focus:ring-emerald-500 border-border-strong rounded cursor-pointer"
                                />
                                <div>
                                  <span className="text-sm font-medium text-text-secondary">
                                    {p.label}
                                  </span>
                                  <p className="text-xs text-text-muted font-mono mt-0.5">
                                    {p.key}
                                  </p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border-subtle flex justify-end space-x-3 bg-surface-base rounded-b-xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface-card border border-border-strong rounded-lg hover:bg-surface-base transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={
                  !formData.name || formData.allowedPermissions.length === 0
                }
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
