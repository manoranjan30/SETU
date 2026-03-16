import { useEffect, useState } from "react";
import api from "../../api/axios";
import { Shield } from "lucide-react";

interface Permission {
  id: number;
  permissionCode: string;
  permissionName: string;
  moduleName: string;
  actionType: string;
  scopeLevel: string;
  description: string;
}

const PermissionsTab = () => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const res = await api.get("/permissions");
      setPermissions(res.data);
    } catch (error) {
      console.error("Failed to fetch permissions");
    } finally {
      setLoading(false);
    }
  };

  const filteredPermissions = permissions.filter(
    (perm) =>
      perm.permissionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perm.permissionCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perm.moduleName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading) return <div>Loading permissions...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Shield className="w-6 h-6 mr-2 text-secondary" />
          <h2 className="text-2xl font-bold">System Permissions</h2>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search permissions..."
            className="border border-border-strong rounded-md px-4 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-secondary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg
            className="w-5 h-5 text-text-disabled absolute left-3 top-2.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            ></path>
          </svg>
        </div>
      </div>

      <div className="bg-surface-card rounded shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-base">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Module
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Scope
              </th>
            </tr>
          </thead>
          <tbody className="bg-surface-card divide-y divide-gray-200">
            {filteredPermissions.map((perm) => (
              <tr key={perm.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-secondary">
                  {perm.moduleName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-secondary">
                  {perm.permissionCode}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                  {perm.permissionName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                        ${
                                          perm.actionType === "CREATE"
                                            ? "bg-green-100 text-green-800"
                                            : perm.actionType === "DELETE"
                                              ? "bg-red-100 text-red-800"
                                              : perm.actionType === "UPDATE"
                                                ? "bg-yellow-100 text-yellow-800"
                                                : "bg-info-muted text-blue-800"
                                        }`}
                  >
                    {perm.actionType}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">
                  {perm.scopeLevel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PermissionsTab;
