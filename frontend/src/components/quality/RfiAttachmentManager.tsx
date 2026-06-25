import { useRef, useState } from "react";
import { FileImage, FileText, Loader2, Pencil, Trash2, Upload } from "lucide-react";
import { getPublicFileUrl } from "../../api/baseUrl";
import { qualityService } from "../../services/quality.service";
import type { QualityInspectionAttachment } from "../../types/quality";
import ImageAnnotationEditor from "./ImageAnnotationEditor";

interface Props {
  projectId?: number;
  inspectionId?: number;
  attachments: QualityInspectionAttachment[];
  onChange: (attachments: QualityInspectionAttachment[]) => void;
  readOnly?: boolean;
}

export default function RfiAttachmentManager({
  projectId,
  inspectionId,
  attachments,
  onChange,
  readOnly = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [annotationFile, setAnnotationFile] = useState<File | null>(null);

  const upload = async (
    file: File,
    annotatedFile?: Blob,
    annotationData?: Record<string, unknown>,
  ) => {
    if (attachments.length >= 5) {
      alert("A maximum of five documents can be attached to one RFI.");
      return;
    }
    setUploading(true);
    try {
      const options = {
        annotatedFile,
        annotationData,
        attachmentType: annotatedFile
          ? ("DRAWING_MARKUP" as const)
          : ("SUPPORTING_DOCUMENT" as const),
      };
      const saved = inspectionId
        ? await qualityService.uploadInspectionAttachment(inspectionId, file, options)
        : await qualityService.uploadInspectionAttachmentDraft(
            Number(projectId),
            file,
            options,
          );
      onChange([...attachments, saved]);
      setAnnotationFile(null);
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to upload document.");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (attachment: QualityInspectionAttachment) => {
    if (!window.confirm(`Remove ${attachment.originalName}?`)) return;
    try {
      if (inspectionId) {
        await qualityService.deleteInspectionAttachment(inspectionId, attachment.id);
      } else {
        await qualityService.deleteInspectionAttachmentDraft(attachment.id);
      }
      onChange(attachments.filter((item) => item.id !== attachment.id));
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to remove document.");
    }
  };

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (file) void upload(file);
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || attachments.length >= 5}
            className="inline-flex items-center gap-2 rounded-md border border-border-default px-3 py-2 text-sm font-semibold hover:bg-surface-raised disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Add document
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border-default px-3 py-2 text-sm font-semibold hover:bg-surface-raised">
            <Pencil className="h-4 w-4" />
            Mark up image or PDF
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              className="hidden"
              disabled={uploading || attachments.length >= 5}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (file) setAnnotationFile(file);
              }}
            />
          </label>
          <span className="self-center text-xs text-text-muted">
            JPG, PNG, WebP or PDF · 10 MB each · {attachments.length}/5
          </span>
        </div>
      )}
      {attachments.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {attachments.map((attachment) => {
            const previewUrl = attachment.annotatedUrl || attachment.originalUrl;
            const hasImagePreview =
              attachment.mimeType.startsWith("image/") ||
              Boolean(attachment.annotatedUrl);
            return (
              <div key={attachment.id} className="flex min-w-0 items-center gap-3 rounded-md border border-border-default bg-surface-card p-2">
                {hasImagePreview ? (
                  <img src={getPublicFileUrl(previewUrl)} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                ) : (
                  <FileText className="h-8 w-8 shrink-0 text-red-600" />
                )}
                <a href={getPublicFileUrl(attachment.originalUrl)} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text-primary">
                    {attachment.originalName}
                  </span>
                  <span className="block text-xs text-text-muted">
                    {attachment.attachmentType === "DRAWING_MARKUP" ? "Annotated drawing" : "Supporting document"}
                  </span>
                </a>
                {attachment.annotatedUrl && (
                  <a
                    href={getPublicFileUrl(attachment.annotatedUrl)}
                    target="_blank"
                    rel="noreferrer"
                    title="Open marked-up page"
                    className="rounded-md p-2 text-secondary hover:bg-secondary-muted"
                  >
                    <Pencil className="h-4 w-4" />
                  </a>
                )}
                {!readOnly && !attachment.isLocked && (
                  <button type="button" title="Remove attachment" onClick={() => void remove(attachment)} className="rounded-md p-2 text-error hover:bg-error-muted">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                {attachment.isLocked && <FileImage className="h-4 w-4 text-text-muted" />}
              </div>
            );
          })}
        </div>
      )}
      {annotationFile && (
        <ImageAnnotationEditor
          file={annotationFile}
          onCancel={() => setAnnotationFile(null)}
          onComplete={(blob, data) => void upload(annotationFile, blob, data)}
        />
      )}
    </div>
  );
}
