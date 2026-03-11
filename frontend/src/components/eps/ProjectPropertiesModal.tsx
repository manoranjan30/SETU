import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  Calendar,
  User,
  AlignLeft,
  Globe,
  DollarSign,
  PenTool,
  Activity,
} from "lucide-react";
import api from "../../api/axios";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  nodeId: number;
  nodeName: string;
}

// Field Definition based on User Request
const propertyGroups = [
  {
    group: "Core Identity",
    icon: <Activity className="w-4 h-4" />,
    fields: [
      {
        key: "projectCode",
        label: "Project Code",
        type: "string",
        required: true,
      },
      {
        key: "projectName",
        label: "Project Name",
        type: "string",
        required: true,
      },
      {
        key: "projectType",
        label: "Project Type",
        type: "enum",
        options: ["Residential", "Commercial", "Infrastructure", "Mixed"],
        required: true,
      },
      { key: "projectCategory", label: "Project Category", type: "string" },
      {
        key: "projectStatus",
        label: "Project Status",
        type: "enum",
        options: ["Planned", "Active", "On-Hold", "Closed"],
      },
      { key: "projectVersion", label: "Project Version", type: "string" },
      { key: "description", label: "Description", type: "text" },
      {
        key: "reraRegistrationNumber",
        label: "RERA Registration Number",
        type: "string",
      },
      {
        key: "reraRegistrationEndDate",
        label: "RERA Registration End Date",
        type: "date",
      },
    ],
  },
  {
    group: "Organization & Governance",
    icon: <User className="w-4 h-4" />,
    fields: [
      { key: "owningCompany", label: "Owning Company", type: "string" },
      { key: "businessUnit", label: "Business Unit", type: "string" },
      { key: "projectSponsorId", label: "Project Sponsor", type: "user" },
      { key: "projectManagerId", label: "Project Manager", type: "user" },
      { key: "planningManagerId", label: "Planning Manager", type: "user" },
      { key: "costControllerId", label: "Cost Controller", type: "user" },
      { key: "approvalAuthorityId", label: "Approval Authority", type: "user" },
    ],
  },
  {
    group: "Location & Site",
    icon: <Globe className="w-4 h-4" />,
    fields: [
      { key: "country", label: "Country", type: "string" },
      { key: "state", label: "State / Region", type: "string" },
      { key: "city", label: "City", type: "string" },
      { key: "siteAddress", label: "Site Address", type: "text" },
      { key: "latitude", label: "Latitude", type: "number" },
      { key: "longitude", label: "Longitude", type: "number" },
      { key: "landArea", label: "Land Area", type: "number" },
      {
        key: "landOwnershipType",
        label: "Land Ownership Type",
        type: "enum",
        options: ["Owned", "Lease", "JV"],
      },
      {
        key: "zoningClassification",
        label: "Zoning Classification",
        type: "string",
      },
    ],
  },
  {
    group: "Schedule Controls",
    icon: <Calendar className="w-4 h-4" />,
    fields: [
      { key: "plannedStartDate", label: "Planned Start Date", type: "date" },
      { key: "plannedEndDate", label: "Planned End Date", type: "date" },
      { key: "actualStartDate", label: "Actual Start Date", type: "date" },
      { key: "actualEndDate", label: "Actual End Date", type: "date" },
      { key: "calendarId", label: "Project Calendar", type: "calendar" },
      {
        key: "shiftPattern",
        label: "Shift Pattern",
        type: "enum",
        options: ["Single", "Double", "Triple"],
      },
      { key: "milestoneStrategy", label: "Milestone Strategy", type: "string" },
    ],
  },
  {
    group: "Financial & Commercial",
    icon: <DollarSign className="w-4 h-4" />,
    fields: [
      { key: "currency", label: "Currency", type: "string" },
      {
        key: "estimatedProjectCost",
        label: "Estimated Project Cost",
        type: "number",
      },
      { key: "approvedBudget", label: "Approved Budget", type: "number" },
      {
        key: "fundingType",
        label: "Funding Type",
        type: "enum",
        options: ["Self", "Bank", "JV"],
      },
      {
        key: "revenueModel",
        label: "Revenue Model",
        type: "enum",
        options: ["Sale", "Lease", "BOT"],
      },
      { key: "taxStructure", label: "Tax Structure", type: "string" },
      { key: "escalationClause", label: "Escalation Clause", type: "boolean" },
    ],
  },
  {
    group: "Construction & Technical",
    icon: <PenTool className="w-4 h-4" />,
    fields: [
      {
        key: "constructionTechnology",
        label: "Construction Technology",
        type: "enum",
        options: ["Conventional", "Aluminium Formwork", "Precast", "Hybrid"],
      },
      { key: "structuralSystem", label: "Structural System", type: "string" },
      {
        key: "numberOfBuildings",
        label: "Number of Buildings",
        type: "number",
      },
      {
        key: "typicalFloorCount",
        label: "Typical Floor Count",
        type: "number",
      },
      { key: "totalBuiltupArea", label: "Total Built-up Area", type: "number" },
      { key: "unitMix", label: "Unit Mix", type: "string" },
      { key: "heightRestriction", label: "Height Restriction", type: "number" },
      { key: "seismicZone", label: "Seismic Zone", type: "string" },
    ],
  },
  {
    group: "Audit & Lifecycle",
    icon: <AlignLeft className="w-4 h-4" />,
    fields: [
      {
        key: "lifecycleStage",
        label: "Project Lifecycle Stage",
        type: "enum",
        options: ["Concept", "Design", "Execution", "Handover", "Closeout"],
      },
      { key: "changeReason", label: "Change Reason", type: "text" },
    ],
  },
];

const ProjectPropertiesModal: React.FC<Props> = ({
  isOpen,
  onClose,
  nodeId,
  nodeName,
}) => {
  const [activeGroup, setActiveGroup] = useState(propertyGroups[0].group);
  const [formData, setFormData] = useState<any>({});
  const [users, setUsers] = useState<any[]>([]); // For User dropdowns
  const [calendars, setCalendars] = useState<any[]>([]); // For Calendar dropdown
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch Data on Open
  useEffect(() => {
    if (isOpen && nodeId) {
      loadData();
    }
  }, [isOpen, nodeId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Parallel fetch: Properties + Users + Calendars
      const [profileRes, usersRes, calendarsRes] = await Promise.all([
        api.get(`/eps/${nodeId}/profile`),
        api.get("/users"),
        api.get("/calendars"),
      ]);

      const profile = profileRes.data || {};
      // Preset project name if empty
      if (!profile.projectName) profile.projectName = nodeName;

      // Map nested calendar object to ID for form
      if (profile.calendar) {
        profile.calendarId = profile.calendar.id;
      }

      setFormData(profile);
      setUsers(usersRes.data);
      setCalendars(calendarsRes.data);
    } catch (err) {
      console.error("Failed to load project properties", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/eps/${nodeId}/profile`, formData);
      onClose();
    } catch (err) {
      alert("Failed to save properties");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-surface-card rounded-lg shadow-2xl w-[900px] h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-default flex justify-between items-center bg-surface-base">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Project Properties
            </h2>
            <p className="text-sm text-text-muted">
              Managing properties for:{" "}
              <span className="font-semibold text-primary">{nodeName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full text-text-muted hover:text-text-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-64 bg-surface-base border-r border-border-default overflow-y-auto">
            {propertyGroups.map((grp) => (
              <button
                key={grp.group}
                onClick={() => setActiveGroup(grp.group)}
                className={`w-full text-left px-4 py-3 text-sm font-medium flex items-center transition-colors
                  ${activeGroup === grp.group ? "bg-surface-card text-primary border-l-4 border-primary shadow-sm" : "text-text-secondary hover:bg-surface-raised hover:text-text-primary border-l-4 border-transparent"}
                `}
              >
                <span className="mr-3">{grp.icon}</span>
                {grp.group}
              </button>
            ))}
          </div>

          {/* Form Area */}
          <div className="flex-1 p-8 overflow-y-auto bg-surface-card">
            {loading ? (
              <div className="flex h-full items-center justify-center text-text-disabled">
                Loading...
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                {propertyGroups
                  .find((g) => g.group === activeGroup)
                  ?.fields.map((field) => (
                    <div
                      key={field.key}
                      className={field.type === "text" ? "col-span-2" : ""}
                    >
                      <label className="block text-sm font-semibold text-text-secondary mb-1">
                        {field.label}{" "}
                        {field.required && (
                          <span className="text-error">*</span>
                        )}
                      </label>

                      {/* Render Input based on Type */}
                      {field.type === "string" || field.type === "number" ? (
                        <input
                          type={field.type === "number" ? "number" : "text"}
                          className="w-full border border-border-strong rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-shadow"
                          value={formData[field.key] || ""}
                          onChange={(e) =>
                            handleChange(field.key, e.target.value)
                          }
                        />
                      ) : field.type === "date" ? (
                        <input
                          type="date"
                          className="w-full border border-border-strong rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                          value={
                            formData[field.key]
                              ? formData[field.key].split("T")[0]
                              : ""
                          }
                          onChange={(e) =>
                            handleChange(field.key, e.target.value)
                          }
                        />
                      ) : field.type === "enum" ? (
                        <select
                          className="w-full border border-border-strong rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer bg-surface-card"
                          value={formData[field.key] || ""}
                          onChange={(e) =>
                            handleChange(field.key, e.target.value)
                          }
                        >
                          <option value="">Select...</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "boolean" ? (
                        <div className="flex items-center mt-2">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-primary rounded focus:ring-primary"
                            checked={!!formData[field.key]}
                            onChange={(e) =>
                              handleChange(field.key, e.target.checked)
                            }
                          />
                          <span className="ml-2 text-sm text-text-secondary">
                            Yes
                          </span>
                        </div>
                      ) : field.type === "text" ? (
                        <textarea
                          className="w-full border border-border-strong rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none h-24 resize-none"
                          value={formData[field.key] || ""}
                          onChange={(e) =>
                            handleChange(field.key, e.target.value)
                          }
                        />
                      ) : field.type === "user" ? (
                        <select
                          className="w-full border border-border-strong rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer bg-surface-card"
                          value={formData[field.key] || ""}
                          onChange={(e) =>
                            handleChange(field.key, e.target.value)
                          }
                        >
                          <option value="">Select User...</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.username} (
                              {u.roles?.map((r: any) => r.name).join(", ")})
                            </option>
                          ))}
                        </select>
                      ) : field.type === "calendar" ? (
                        <select
                          className="w-full border border-border-strong rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer bg-surface-card"
                          value={formData[field.key] || ""}
                          onChange={(e) =>
                            handleChange(field.key, e.target.value)
                          }
                        >
                          <option value="">Select Calendar...</option>
                          {calendars.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.isDefault ? "(Default)" : ""}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-default bg-surface-base flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 text-text-secondary bg-surface-card border border-border-strong rounded-md hover:bg-surface-base font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-white bg-primary rounded-md hover:bg-primary-dark font-medium shadow-sm flex items-center transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Properties"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectPropertiesModal;
