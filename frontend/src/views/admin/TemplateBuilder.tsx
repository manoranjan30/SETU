import { useState } from "react";
import api from "../../api/axios";
import TemplateList from "../../components/template-builder/TemplateList";
import TemplateEditor from "../../components/template-builder/TemplateEditor";
import type { PdfTemplate } from "../../types/template.types";

type ViewMode = "list" | "editor";

const TemplateBuilder = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingTemplate, setEditingTemplate] = useState<PdfTemplate | null>(
    null,
  );

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setViewMode("editor");
  };

  const handleEdit = (template: PdfTemplate) => {
    setEditingTemplate(template);
    setViewMode("editor");
  };

  const handleSave = async (templateData: Partial<PdfTemplate>) => {
    try {
      if (templateData.id) {
        // Update existing
        await api.put(`/pdf-templates/${templateData.id}`, {
          name: templateData.name,
          category: templateData.category,
          description: templateData.description,
          templateJson: templateData.templateJson,
        });
      } else {
        // Create new
        await api.post("/pdf-templates", {
          name: templateData.name,
          category: templateData.category || "custom",
          description: templateData.description || "",
          templateJson: templateData.templateJson || {
            zones: [],
            extractionMode: "all_pages",
          },
        });
      }
      setViewMode("list");
      setEditingTemplate(null);
    } catch (error: any) {
      console.error("Save failed:", error);
      const message =
        error.response?.data?.message || error.message || "Unknown error";
      throw new Error(`Failed to save template: ${message}`);
    }
  };

  const handleCancel = () => {
    setViewMode("list");
    setEditingTemplate(null);
  };

  return (
    <div className="h-full flex flex-col">
      {viewMode === "list" && (
        <TemplateList onEdit={handleEdit} onCreateNew={handleCreateNew} />
      )}
      {viewMode === "editor" && (
        <TemplateEditor
          template={editingTemplate}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
};

export default TemplateBuilder;
