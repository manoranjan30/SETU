import React, { useState, useRef } from "react";
import api from "../../api/axios";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ArrowRight,
  X,
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onSuccess: () => void;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

const WbsImportWizard: React.FC<Props> = ({
  isOpen,
  onClose,
  projectId,
  onSuccess,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDownloadSample = () => {
    const headers = [
      "wbsCode,wbsName,isControlAccount,activityCode,activityName,type,duration",
    ];
    const rows = [
      "1,Substructure,TRUE,,,",
      "1.1,Excavation,FALSE,,,",
      "1.1,,FALSE,A100,Excavate Pit,TASK,10",
      "1.2,Foundation,TRUE,,,",
      "1.2,,TRUE,A200,Pour Concrete,TASK,5",
    ];
    const csvContent = headers.concat(rows).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "wbs_import_sample_with_activities.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post(
        `/projects/${projectId}/wbs/import/preview`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      setPreviewData(res.data.data);
      setValidation(res.data.validation);
      setStep(2);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to upload preview");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (validation && !validation.isValid) return; // Prevent if invalid? or allow warnings?
    // Service should block if critical invalid.
    setLoading(true);
    try {
      await api.post(`/projects/${projectId}/wbs/import/commit`, {
        data: previewData,
      });
      setStep(3); // Success
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to commit import");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-surface-card rounded-lg shadow-xl w-[800px] h-[600px] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-success" />
              Import WBS
            </h3>
            <div className="flex gap-2 mt-1">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${step === 1 ? "bg-info-muted text-blue-700 font-bold" : "bg-surface-raised text-text-muted"}`}
              >
                1. Upload
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${step === 2 ? "bg-info-muted text-blue-700 font-bold" : "bg-surface-raised text-text-muted"}`}
              >
                2. Preview & Validate
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${step === 3 ? "bg-info-muted text-blue-700 font-bold" : "bg-surface-raised text-text-muted"}`}
              >
                3. Finish
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-disabled hover:text-text-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {step === 1 && (
            <div className="flex flex-col h-full">
              <div
                className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border-default rounded-lg hover:bg-surface-base transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 text-text-disabled mb-4" />
                <p className="text-lg font-semibold text-text-secondary">
                  Click to upload spreadsheet
                </p>
                <p className="text-sm text-text-disabled mt-2">
                  Supported formats: .xlsx, .csv
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".xlsx,.csv"
                  onChange={handleFileChange}
                />
                {file && (
                  <div className="mt-4 flex items-center gap-2 p-2 bg-primary-muted text-blue-700 rounded border border-blue-200">
                    <FileSpreadsheet className="w-4 h-4" />
                    {file.name}
                  </div>
                )}
              </div>
              <div className="mt-4 text-center">
                <button
                  onClick={handleDownloadSample}
                  className="text-primary text-sm hover:underline flex items-center justify-center gap-1 mx-auto"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Download Sample File
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              {/* Validation Status */}
              {validation?.isValid ? (
                <div className="mb-4 p-3 bg-success-muted text-green-700 rounded border border-green-200 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>
                    Validation Successful! Ready to import {previewData.length}{" "}
                    records.
                  </span>
                </div>
              ) : (
                <div className="mb-4 p-3 bg-error-muted text-red-700 rounded border border-red-200">
                  <div className="flex items-center gap-2 font-bold mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    Validation Failed
                  </div>
                  <ul className="list-disc list-inside text-sm">
                    {validation?.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface-raised text-text-secondary font-semibold border-b">
                    <tr>
                      <th className="px-3 py-2">WBS Code</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewData.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-surface-base">
                        <td className="px-3 py-2 font-mono text-xs">
                          {row.wbscode}
                        </td>
                        <td className="px-3 py-2">{row.wbsname}</td>
                        <td className="px-3 py-2 text-xs">
                          {row.iscontrolaccount === true ||
                          row.iscontrolaccount === "TRUE"
                            ? "Control Account"
                            : "Task"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.length > 10 && (
                  <div className="p-2 text-center text-xs text-text-muted bg-surface-base border-t">
                    ...and {previewData.length - 10} more rows
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="h-full flex flex-col justify-center items-center text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <h4 className="text-xl font-bold text-gray-800">
                Import Successful!
              </h4>
              <p className="text-text-muted mt-2">
                WBS nodes have been created successfully.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step < 3 && (
          <div className="p-6 border-t bg-surface-base flex justify-end gap-3 rounded-b-lg">
            <button
              onClick={onClose}
              className="px-4 py-2 hover:bg-gray-200 rounded text-text-secondary"
            >
              Cancel
            </button>
            {step === 1 && (
              <button
                onClick={handlePreview}
                disabled={!file || loading}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Preview <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {step === 2 && (
              <button
                onClick={handleCommit}
                disabled={!validation?.isValid || loading}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Import Data
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WbsImportWizard;
