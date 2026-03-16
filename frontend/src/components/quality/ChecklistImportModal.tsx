import React, { useMemo, useState } from "react";
import Modal from "../common/Modal";
import { toast } from "react-hot-toast";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  FileSpreadsheet,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";
import { qualityService } from "../../services/quality.service";
import type { ParsedChecklistPreview, PdfParseResult } from "../../types/quality";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onSuccess: () => void;
}

type Step = "upload" | "clarify" | "review";

const fieldLabels: Array<keyof Pick<
  ParsedChecklistPreview,
  "checklistNo" | "revNo" | "activityTitle" | "activityType" | "discipline" | "applicableTrade"
>> = [
  "checklistNo",
  "revNo",
  "activityTitle",
  "activityType",
  "discipline",
  "applicableTrade",
];

const ChecklistImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  projectId,
  onSuccess,
}) => {
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<ParsedChecklistPreview[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const current = templates[activeIndex];
  const needsClarification = useMemo(
    () => templates.some((template) => template.requiresClarification),
    [templates],
  );

  const reset = () => {
    setStep("upload");
    setLoading(false);
    setTemplates([]);
    setActiveIndex(0);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".pdf")) {
        const result: PdfParseResult = await qualityService.previewChecklistPdfImport(
          projectId,
          file,
        );
        setTemplates([result.preview]);
        setStep(result.preview.requiresClarification ? "clarify" : "review");
      } else {
        const result = await qualityService.previewChecklistExcelImport(
          projectId,
          file,
        );
        setTemplates(result.templates);
        setStep(result.requiresClarification ? "clarify" : "review");
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to parse checklist import file",
      );
    } finally {
      setLoading(false);
    }
  };

  const updateHeaderField = (
    index: number,
    field: keyof ParsedChecklistPreview,
    value: string,
  ) => {
    setTemplates((prev) =>
      prev.map((template, templateIndex) =>
        templateIndex !== index
          ? template
          : {
              ...template,
              [field]: {
                ...(template[field] as { confidence: number }),
                value,
                confidence: 100,
              },
              requiresClarification: false,
            },
      ),
    );
  };

  const updateStageName = (index: number, stageIndex: number, value: string) => {
    setTemplates((prev) =>
      prev.map((template, templateIndex) =>
        templateIndex !== index
          ? template
          : {
              ...template,
              stages: template.stages.map((stage, currentStageIndex) =>
                currentStageIndex === stageIndex
                  ? { ...stage, name: value, confidence: 100 }
                  : stage,
              ),
              requiresClarification: false,
            },
      ),
    );
  };

  const handleClarificationNext = () => {
    const nextIndex = templates.findIndex(
      (template, index) => index > activeIndex && template.requiresClarification,
    );
    if (nextIndex === -1) {
      setStep("review");
      return;
    }
    setActiveIndex(nextIndex);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await qualityService.saveChecklistImport(projectId, templates, true);
      toast.success(`Imported ${templates.length} checklist template(s)`);
      handleClose();
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Checklist import failed");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Checklist Smart Import"
      size="xl"
    >
      {step === "upload" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border-default bg-surface-base p-5">
            <p className="text-sm text-text-secondary">
              Upload Excel or PDF checklists. Excel imports are end-to-end in this phase. PDF imports support digital-text parsing and clarification before save.
            </p>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border-default bg-surface-base px-6 py-16 text-center hover:border-orange-400 hover:bg-orange-50/40">
            <input
              type="file"
              accept=".xlsx,.xls,.pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-card shadow-sm">
              <Upload className="h-8 w-8 text-orange-600" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-bold text-text-primary">
                Click to upload Excel or PDF
              </p>
              <p className="text-sm text-text-muted">
                `.xlsx`, `.xls`, `.pdf`
              </p>
            </div>
          </label>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Parsing uploaded file...
            </div>
          )}
        </div>
      )}

      {step === "clarify" && current && (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <p className="font-bold">Clarification required</p>
                <p className="text-sm">
                  Reviewing {activeIndex + 1} of {templates.length}: {current.sheetName}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold">
              {current.overallConfidence}% confidence
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {fieldLabels.map((field) => {
              const entry = current[field];
              const lowConfidence = entry.confidence < 80 || !entry.value;
              return (
                <div
                  key={field}
                  className="rounded-2xl border border-border-default bg-surface-base p-4"
                >
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-muted">
                    {field}
                  </label>
                  <input
                    className="w-full rounded-xl border border-border-default bg-surface-card px-4 py-3 text-sm"
                    value={String(entry.value ?? "")}
                    onChange={(event) =>
                      updateHeaderField(activeIndex, field, event.target.value)
                    }
                  />
                  <p
                    className={`mt-2 text-xs ${lowConfidence ? "text-amber-700" : "text-emerald-700"}`}
                  >
                    {lowConfidence
                      ? `Needs review (${entry.confidence}%)`
                      : `High confidence (${entry.confidence}%)`}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-border-default bg-surface-base p-4">
            <p className="mb-3 text-sm font-bold text-text-primary">
              Sections
            </p>
            <div className="space-y-3">
              {current.stages.map((stage, stageIndex) => (
                <div
                  key={`${stage.name}-${stageIndex}`}
                  className="rounded-xl border border-border-default bg-surface-card p-3"
                >
                  <input
                    className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm font-semibold"
                    value={stage.name}
                    onChange={(event) =>
                      updateStageName(activeIndex, stageIndex, event.target.value)
                    }
                  />
                  <p className="mt-2 text-xs text-text-muted">
                    {stage.items.length} items - {stage.confidence}% confidence
                  </p>
                </div>
              ))}
            </div>
          </div>

          {current.warnings.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-2 text-sm font-bold text-amber-900">Warnings</p>
              <div className="space-y-1 text-sm text-amber-800">
                {current.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep("upload")}
              className="flex items-center gap-2 text-sm font-medium text-text-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={handleClarificationNext}
              className="rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white hover:bg-orange-700"
            >
              {templates.findIndex(
                (template, index) =>
                  index > activeIndex && template.requiresClarification,
              ) === -1
                ? "Review Import"
                : "Next Sheet"}
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-700" />
              <div>
                <p className="font-bold text-emerald-900">Ready to import</p>
                <p className="text-sm text-emerald-800">
                  {templates.length} checklist template(s) prepared for save.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {templates.map((template, index) => (
              <div
                key={`${template.sheetName}-${index}`}
                className="rounded-2xl border border-border-default bg-surface-base p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      {template.format === "pdf" ? (
                        <FileText className="h-4 w-4 text-orange-600" />
                      ) : (
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                      )}
                      <h4 className="font-bold text-text-primary">
                        {template.activityTitle.value || template.sheetName}
                      </h4>
                    </div>
                    <p className="mt-1 text-sm text-text-muted">
                      {template.checklistNo.value || "No checklist number"} - Rev{" "}
                      {template.revNo.value || "01"}
                    </p>
                  </div>
                  <span className="rounded-full bg-surface-card px-3 py-1 text-xs font-bold text-text-secondary">
                    {template.overallConfidence}% confidence
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase text-text-muted">Activity</p>
                    <p className="font-medium text-text-secondary">
                      {template.activityType.value || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-text-muted">Discipline</p>
                    <p className="font-medium text-text-secondary">
                      {template.discipline.value || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-text-muted">Trade</p>
                    <p className="font-medium text-text-secondary">
                      {template.applicableTrade.value || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-text-muted">Stages</p>
                    <p className="font-medium text-text-secondary">
                      {template.stages.length}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {template.stages.map((stage) => (
                    <div
                      key={`${template.sheetName}-${stage.sequence}-${stage.name}`}
                      className="rounded-xl border border-border-default bg-surface-card px-4 py-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-text-primary">{stage.name}</p>
                        <p className="text-xs text-text-muted">
                          {stage.items.length} items
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(needsClarification ? "clarify" : "upload")}
              className="flex items-center gap-2 text-sm font-medium text-text-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              {needsClarification ? "Back to Clarification" : "Back"}
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Confirm and Save
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ChecklistImportModal;
