import { useState, useEffect } from "react";
import { Plus, Trash2, Shield, User, Globe, Layout } from "lucide-react";
import {
  dashboardBuilderApi,
  type DashboardConfig,
  type RoleOption,
} from "../../../services/dashboard-builder.service";

interface Props {
  dashboards: DashboardConfig[];
}

interface Assignment {
  id: number;
  dashboardId: number;
  roleName?: string;
  role?: RoleOption;
  userId?: number;
  projectId?: number;
  assignmentType?: "ROLE" | "USER" | "DEFAULT_GLOBAL" | "DEFAULT_PROJECT";
  isDefault: boolean;
  dashboard?: DashboardConfig;
}

export default function AssignmentManager({ dashboards }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const [newAssignment, setNewAssignment] = useState({
    dashboardId: 0,
    type: "ROLE" as "ROLE" | "USER" | "PROJECT" | "GLOBAL",
    targetId: "",
    isDefault: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [assignmentRes, roleRes] = await Promise.all([
        dashboardBuilderApi.getAssignments(),
        dashboardBuilderApi.getRoles(),
      ]);
      setAssignments(assignmentRes.data);
      setRoles(roleRes.data || []);
    } catch (err) {
      console.error("Failed to load assignments", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!newAssignment.dashboardId) return;
    try {
      const payload: any = {
        dashboardId: newAssignment.dashboardId,
        isDefault: newAssignment.isDefault,
      };

      if (newAssignment.type === "ROLE")
        payload.roleId = Number(newAssignment.targetId);
      if (newAssignment.type === "USER")
        payload.userId = Number(newAssignment.targetId);
      if (newAssignment.type === "PROJECT")
        payload.projectId = Number(newAssignment.targetId);
      payload.assignmentType = newAssignment.type;

      await dashboardBuilderApi.saveAssignment(payload);
      setShowAdd(false);
      setNewAssignment({
        dashboardId: 0,
        type: "ROLE",
        targetId: "",
        isDefault: true,
      });
      load();
    } catch (err) {
      console.error("Save assignment failed", err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await dashboardBuilderApi.removeAssignment(id);
      load();
    } catch (err) {
      console.error("Delete assignment failed", err);
    }
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "20px 24px",
          borderBottom: "1px solid #f1f5f9",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: "#1e293b",
            }}
          >
            Dashboard Assignments
          </h3>
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
            Define which roles or users see which dashboard by default
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            borderRadius: 8,
            background: "#2563eb",
            color: "#fff",
            border: "none",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <Plus size={16} /> New Assignment
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr
            style={{ background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}
          >
            <th
              style={{
                padding: "12px 24px",
                textAlign: "left",
                fontSize: 11,
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              Scope / Target
            </th>
            <th
              style={{
                padding: "12px 24px",
                textAlign: "left",
                fontSize: 11,
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              Assigned Dashboard
            </th>
            <th
              style={{
                padding: "12px 24px",
                textAlign: "center",
                fontSize: 11,
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              Default
            </th>
            <th
              style={{
                padding: "12px 24px",
                textAlign: "right",
                fontSize: 11,
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((as) => (
            <tr key={as.id} style={{ borderBottom: "1px solid #f8fafc" }}>
              <td style={{ padding: "16px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {as.assignmentType === "ROLE" ||
                  as.roleName ||
                  as.role?.name ? (
                    <Shield size={16} color="#8b5cf6" />
                  ) : as.assignmentType === "USER" || as.userId ? (
                    <User size={16} color="#2563eb" />
                  ) : (
                    <Globe size={16} color="#10b981" />
                  )}
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#1e293b",
                      }}
                    >
                      {as.role?.name ||
                        as.roleName ||
                        (as.userId
                          ? `User #${as.userId}`
                          : as.projectId
                            ? `Project #${as.projectId}`
                            : "Global Default")}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      {as.assignmentType === "ROLE" ||
                      as.roleName ||
                      as.role?.name
                        ? "Role"
                        : as.assignmentType === "USER" || as.userId
                          ? "Individual User"
                          : as.assignmentType === "DEFAULT_PROJECT" ||
                              as.projectId
                            ? "Project Default"
                            : "System Wide"}
                    </div>
                  </div>
                </div>
              </td>
              <td style={{ padding: "16px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Layout size={14} color="#64748b" />
                  <span
                    style={{ fontSize: 14, color: "#334155", fontWeight: 500 }}
                  >
                    {as.dashboard?.name || `ID: ${as.dashboardId}`}
                  </span>
                </div>
              </td>
              <td style={{ padding: "16px 24px", textAlign: "center" }}>
                {as.isDefault && (
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: "#dcfce7",
                      color: "#166534",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    ACTIVE
                  </span>
                )}
              </td>
              <td style={{ padding: "16px 24px", textAlign: "right" }}>
                <button
                  onClick={() => handleDelete(as.id)}
                  style={{
                    padding: 6,
                    borderRadius: 6,
                    border: "none",
                    background: "transparent",
                    color: "#94a3b8",
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
          {assignments.length === 0 && !loading && (
            <tr>
              <td
                colSpan={4}
                style={{
                  padding: 40,
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: 14,
                }}
              >
                No assignments defined yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Modal for adding assignment */}
      {showAdd && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.7)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: 440,
              padding: 32,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            }}
          >
            <h3
              style={{
                margin: "0 0 24px",
                fontSize: 18,
                fontWeight: 800,
                color: "#1e293b",
              }}
            >
              New Assignment
            </h3>

            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#475569",
                  marginBottom: 8,
                }}
              >
                Scope Type
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                {["ROLE", "USER", "PROJECT", "GLOBAL"].map((t) => (
                  <button
                    key={t}
                    onClick={() =>
                      setNewAssignment({ ...newAssignment, type: t as any })
                    }
                    style={{
                      padding: "10px",
                      borderRadius: 8,
                      border: "1px solid",
                      borderColor:
                        newAssignment.type === t ? "#2563eb" : "#e2e8f0",
                      background: newAssignment.type === t ? "#eff6ff" : "#fff",
                      color: newAssignment.type === t ? "#2563eb" : "#64748b",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#475569",
                  marginBottom: 8,
                }}
              >
                Select Dashboard
              </label>
              <select
                value={newAssignment.dashboardId}
                onChange={(e) =>
                  setNewAssignment({
                    ...newAssignment,
                    dashboardId: Number(e.target.value),
                  })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  outline: "none",
                }}
              >
                <option value={0}>Choose Dashboard...</option>
                {dashboards.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.scope})
                  </option>
                ))}
              </select>
            </div>

            {newAssignment.type !== "GLOBAL" && (
              <div style={{ marginBottom: 24 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#475569",
                    marginBottom: 8,
                  }}
                >
                  {newAssignment.type === "ROLE" ? "Select Role" : "Target ID"}
                </label>
                {newAssignment.type === "ROLE" ? (
                  <select
                    value={newAssignment.targetId}
                    onChange={(e) =>
                      setNewAssignment({
                        ...newAssignment,
                        targetId: e.target.value,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      outline: "none",
                    }}
                  >
                    <option value="">Choose Role...</option>
                    {roles.map((role) => (
                      <option key={role.id} value={String(role.id)}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    value={newAssignment.targetId}
                    onChange={(e) =>
                      setNewAssignment({
                        ...newAssignment,
                        targetId: e.target.value,
                      })
                    }
                    placeholder={
                      newAssignment.type === "USER"
                        ? "User ID..."
                        : "Project ID..."
                    }
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      outline: "none",
                    }}
                  />
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
              <button
                onClick={() => setShowAdd(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  color: "#475569",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={
                  !newAssignment.dashboardId ||
                  (newAssignment.type !== "GLOBAL" && !newAssignment.targetId)
                }
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 8,
                  border: "none",
                  background:
                    newAssignment.dashboardId &&
                    (newAssignment.type === "GLOBAL" || newAssignment.targetId)
                      ? "#2563eb"
                      : "#94a3b8",
                  color: "#fff",
                  fontWeight: 600,
                  cursor:
                    newAssignment.dashboardId &&
                    (newAssignment.type === "GLOBAL" || newAssignment.targetId)
                      ? "pointer"
                      : "default",
                }}
              >
                Save Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
