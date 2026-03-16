import React, { useState, useEffect } from "react";
import api from "../../api/axios";
import { toast } from "react-hot-toast";
import { Plus, Trash2, Edit2, FileCode, Settings } from "lucide-react";
import WorkDocTemplateEditor from "./WorkDocTemplateEditor";

interface Template {
  id: number;
  name: string;
  description: string;
  config: any;
}

const WorkDocTemplateList: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.get("/workdoc/templates");
      setTemplates(res.data);
    } catch (error) {
      toast.error("Failed to fetch templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await api.post(`/workdoc/templates/${id}/delete`);
      toast.success("Template deleted");
      fetchTemplates();
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  const handleEdit = (template: Template) => {
    setSelectedTemplate(template);
    setIsEditorOpen(true);
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setIsEditorOpen(true);
  };

  if (loading)
    return (
      <div className="p-8 text-center text-text-muted">
        Loading templates...
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">
            Parsing Templates
          </h2>
          <p className="text-sm text-text-muted font-medium">
            Manage rules for extracting data from different PDF layouts.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-black rounded-xl hover:bg-primary-dark shadow-xl shadow-blue-100 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          New Template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map((t) => (
          <div
            key={t.id}
            className="group bg-surface-card border border-border-default rounded-2xl p-6 hover:shadow-2xl hover:shadow-slate-200/50 hover:border-blue-200 transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-primary-muted text-primary rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                <FileCode className="w-6 h-6" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(t)}
                  className="p-2 text-text-disabled hover:text-primary hover:bg-primary-muted rounded-lg transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-2 text-text-disabled hover:text-error hover:bg-error-muted rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <h3 className="font-bold text-slate-800 text-lg mb-1">{t.name}</h3>
            <p className="text-sm text-text-muted font-medium mb-4 line-clamp-2">
              {t.description || "No description provided."}
            </p>

            <div className="flex items-center gap-4 pt-4 border-t border-slate-50">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-black text-text-disabled tracking-wider">
                  Complexity
                </span>
                <span className="text-xs font-bold text-text-secondary">
                  {t.config?.tableConfig ? "Complex Table" : "Basic Headers"}
                </span>
              </div>
              <div className="ml-auto">
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-bold">
                  YAML/JSON
                </span>
              </div>
            </div>
          </div>
        ))}

        {templates.length === 0 && (
          <div className="col-span-full py-20 bg-surface-base border-2 border-dashed border-border-default rounded-3xl flex flex-col items-center justify-center">
            <Settings className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-text-disabled font-bold">
              No templates defined yet.
            </p>
            <button
              onClick={handleCreate}
              className="mt-4 text-primary font-black hover:underline underline-offset-4"
            >
              Create your first template
            </button>
          </div>
        )}
      </div>

      <WorkDocTemplateEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSuccess={fetchTemplates}
        template={selectedTemplate}
      />
    </div>
  );
};

export default WorkDocTemplateList;
