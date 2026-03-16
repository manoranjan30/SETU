import { useState } from "react";
import { List, Box } from "lucide-react";
import DrawingRegister from "./DrawingRegister";

const DesignDashboard = () => {
  const [activeTab, setActiveTab] = useState("register");

  return (
    <div className="h-full flex flex-col space-y-4 p-4">
      {/* Header */}
      <div className="flex justify-between items-center bg-surface-card p-4 rounded-lg shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Design Management
          </h1>
          <p className="text-sm text-text-muted">
            Manage drawing deliverables, revisions, and transmittals
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Placeholder for project-wide actions stats */}
          <div className="flex gap-4 px-4 py-2 bg-surface-base rounded-lg border border-border-subtle">
            <div className="text-center">
              <span className="block text-xs text-text-disabled font-medium">
                PLANNED
              </span>
              <span className="block text-lg font-bold text-text-secondary">
                0
              </span>
            </div>
            <div className="w-px bg-gray-200"></div>
            <div className="text-center">
              <span className="block text-xs text-text-disabled font-medium">
                GFC
              </span>
              <span className="block text-lg font-bold text-success">0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-card rounded-lg shadow-sm border border-border-default w-fit">
        <button
          onClick={() => setActiveTab("register")}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === "register"
              ? "text-primary bg-primary-muted border-b-2 border-primary"
              : "text-text-secondary hover:bg-surface-base hover:text-text-primary"
          }`}
        >
          <List size={18} />
          Drawing Register
        </button>
        <button
          onClick={() => setActiveTab("transmittals")}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === "transmittals"
              ? "text-primary bg-primary-muted border-b-2 border-primary"
              : "text-text-secondary hover:bg-surface-base hover:text-text-primary"
          }`}
        >
          <Box size={18} />
          Transmittals
        </button>
      </div>

      {/* Content Content */}
      <div className="flex-1 min-h-0">
        {activeTab === "register" && <DrawingRegister />}
        {activeTab === "transmittals" && (
          <div className="h-full flex items-center justify-center bg-surface-card rounded-lg border border-border-default text-text-disabled">
            <div className="text-center">
              <Box size={48} className="mx-auto mb-2 opacity-50" />
              <p>Transmittal Management Module</p>
              <span className="text-xs">Coming Soon</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DesignDashboard;
