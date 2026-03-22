import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Package, Plus, Trash2 } from "lucide-react";
import api from "../../../api/axios";
import ResourceMasterList from "./ResourceMasterList";
import AnalysisTemplateDetails from "./AnalysisTemplateDetails";
import ResourceMappingView from "./ResourceMappingView";
import ResourceSummaryView from "./ResourceSummaryView";

type ActiveTabType =
  | "TEMPLATES"
  | "RESOURCES"
  | "MAPPING"
  | "ANALYSIS"
  | "LOOK_AHEAD";

const ResourcesView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>(); // Need projectId now
  const [activeTab, setActiveTab] = useState<ActiveTabType>("TEMPLATES");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    null,
  );
  const [templates, setTemplates] = useState<any[]>([]);

  // Fetch Templates
  const fetchTemplates = async () => {
    try {
      const res = await api.get("/resources/templates");
      setTemplates(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleCreateTemplate = async () => {
    const desc = prompt("Enter Template Description:");
    if (!desc) return;

    try {
      const res = await api.post("/resources/templates", {
        description: desc,
        outputUom: "Cum", // Default, should be a selector
        status: "DRAFT",
      });
      setTemplates((p) => [...p, res.data]);
      setSelectedTemplateId(res.data.id);
    } catch (err) {
      alert("Failed to create template");
    }
  };

  const handleDeleteTemplate = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!window.confirm("Delete this template?")) return;
    try {
      await api.delete(`/resources/templates/${id}`);
      if (selectedTemplateId === id) setSelectedTemplateId(null);
      fetchTemplates();
    } catch (err) {
      alert("Failed to delete template");
    }
  };

  return (
    <div className="flex h-full bg-surface-base">
      {/* Left Pane: List - Hide if active tab is MAPPING or ANALYSIS (Full Width) */}
      {activeTab !== "MAPPING" && activeTab !== "ANALYSIS" && (
        <div className="w-1/3 border-r border-border-default bg-surface-card flex flex-col">
          <div className="p-4 border-b border-border-default flex justify-between items-center bg-surface-base">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab("TEMPLATES")}
                className={`px-3 py-1 text-sm font-semibold rounded-md ${activeTab === "TEMPLATES" ? "bg-secondary-muted text-secondary" : "text-text-secondary hover:bg-surface-raised"}`}
              >
                Templates
              </button>
              <button
                onClick={() => setActiveTab("RESOURCES")}
                className={`px-3 py-1 text-sm font-semibold rounded-md ${activeTab === "RESOURCES" ? "bg-secondary-muted text-secondary" : "text-text-secondary hover:bg-surface-raised"}`}
              >
                Resources
              </button>
              {/* Short Mapping Link for quick access */}
              <button
                onClick={() => setActiveTab("MAPPING")}
                className="px-3 py-1 text-sm font-medium text-text-secondary hover:bg-surface-raised rounded-md"
              >
                Mapping
              </button>
              <button
                onClick={() => setActiveTab("ANALYSIS")}
                className={`px-3 py-1 text-sm font-semibold rounded-md ${(activeTab as string) === "ANALYSIS" ? "bg-secondary-muted text-secondary" : "text-text-secondary hover:bg-surface-raised"}`}
              >
                Report
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {activeTab === "TEMPLATES" && (
              <div>
                <div className="mb-2 px-2 flex justify-between items-center">
                  <h3 className="text-xs font-semibold text-text-disabled uppercase tracking-wider">
                    Analysis Templates
                  </h3>
                  <button
                    onClick={handleCreateTemplate}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <Plus className="w-4 h-4 text-text-secondary" />
                  </button>
                </div>
                <div className="space-y-1">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTemplateId(t.id)}
                      className={`p-3 rounded-md cursor-pointer text-sm border flex justify-between items-start group relative ${selectedTemplateId === t.id ? "bg-secondary-muted border-secondary" : "bg-surface-card border-transparent hover:bg-surface-base"}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-text-primary">
                          {t.templateCode}
                        </div>
                        <div className="text-text-muted truncate">
                          {t.description}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteTemplate(e, t.id)}
                        className="p-1 text-text-disabled hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "RESOURCES" && <ResourceMasterList />}
          </div>
        </div>
      )}

      {/* Right Pane: Details or Full Views */}
      <div
        className={`flex-1 flex flex-col overflow-hidden ${activeTab === "MAPPING" || activeTab === "ANALYSIS" ? "w-full" : ""}`}
      >
        {activeTab === "MAPPING" ? (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border-default bg-surface-base flex items-center gap-4">
              <button
                onClick={() => setActiveTab("TEMPLATES")}
                className="text-sm text-text-muted hover:text-secondary flex items-center gap-1"
              >
                ← Back
              </button>
              <span className="text-sm font-bold text-text-secondary">
                Resource Mapping & Analysis
              </span>
            </div>

            <ResourceMappingView
              projectId={Number(projectId)}
              templates={templates}
            />
          </div>
        ) : activeTab === "ANALYSIS" ? (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border-default bg-surface-card flex items-center gap-4">
              <button
                onClick={() => setActiveTab("TEMPLATES")}
                className="text-sm text-text-muted hover:text-secondary flex items-center gap-1"
              >
                ← Back
              </button>
              <span className="text-sm font-bold text-text-secondary">
                Resource Summary Report
              </span>
            </div>
            <ResourceSummaryView projectId={Number(projectId)} />
          </div>
        ) : activeTab === "TEMPLATES" && selectedTemplateId ? (
          <AnalysisTemplateDetails
            templateId={selectedTemplateId}
            onUpdate={fetchTemplates}
          />
        ) : activeTab === "RESOURCES" ? (
          <div className="h-full flex items-center justify-center text-text-disabled">
            Select a template to view details or manage resources on the left.
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-text-disabled flex-col">
            <Package className="w-12 h-12 mb-2 opacity-20" />
            <p>Select a template to view details</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResourcesView;
