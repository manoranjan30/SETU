import { useRef, useState } from "react";
import { ExternalLink, FileText, Image, Loader2, Paperclip, Trash2 } from "lucide-react";
import { getPublicFileUrl } from "../../api/baseUrl";
import { qualityService } from "../../services/quality.service";

export interface ClearanceAttachmentDocument {
  id: string;
  originalName: string;
  storedName: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedByUserId: number | null;
}

interface ClearanceDocumentAttachmentsProps {
  inspectionId: number;
  lineKey: string;
  documents: ClearanceAttachmentDocument[];
  disabled?: boolean;
  onChange: (documents: ClearanceAttachmentDocument[]) => void;
}

const formatSize = (size: number) =>
  size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;

export default function ClearanceDocumentAttachments({
  inspectionId,
  lineKey,
  documents,
  disabled = false,
  onChange,
}: ClearanceDocumentAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const uploadFile = async (file?: File) => {
    if (!file || uploading || documents.length >= 5) return;
    setUploading(true);
    try {
      const attachment = await qualityService.uploadPrePourClearanceAttachment(
        inspectionId,
        lineKey,
        file,
      );
      onChange([...documents, attachment]);
    } catch (error: any) {
      alert(
        error?.response?.data?.message ||
          "Failed to upload the clearance document.",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeFile = async (attachment: ClearanceAttachmentDocument) => {
    if (
      disabled ||
      deletingId ||
      !confirm(`Remove "${attachment.originalName}"?`)
    ) {
      return;
    }
    setDeletingId(attachment.id);
    try {
      await qualityService.deletePrePourClearanceAttachment(
        inspectionId,
        lineKey,
        attachment.id,
      );
      onChange(documents.filter((item) => item.id !== attachment.id));
    } catch (error: any) {
      alert(
        error?.response?.data?.message ||
          "Failed to remove the clearance document.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mt-3 border-t border-cyan-200 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-cyan-800">
            Other supporting documents
          </div>
          <div className="mt-0.5 text-[11px] text-cyan-900">
            PDF or image, maximum 5 files per line, 10 MB each
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={disabled || uploading || documents.length >= 5}
          onChange={(event) => void uploadFile(event.target.files?.[0])}
        />
        <button
          type="button"
          title="Attach document"
          disabled={disabled || uploading || documents.length >= 5}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-cyan-900 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Paperclip className="h-3.5 w-3.5" />
          )}
          {uploading ? "Uploading" : `Add document (${documents.length}/5)`}
        </button>
      </div>

      {documents.length > 0 ? (
        <div className="mt-2 grid gap-2">
          {documents.map((attachment) => {
            const isImage = attachment.mimeType.startsWith("image/");
            return (
              <div
                key={attachment.id}
                className="flex min-w-0 items-center gap-2 rounded-lg border border-cyan-200 bg-white px-2.5 py-2"
              >
                {isImage ? (
                  <Image className="h-4 w-4 shrink-0 text-cyan-700" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-red-600" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-text-primary">
                    {attachment.originalName}
                  </div>
                  <div className="text-[11px] text-text-muted">
                    {formatSize(attachment.size)}
                  </div>
                </div>
                <a
                  href={getPublicFileUrl(attachment.url)}
                  target="_blank"
                  rel="noreferrer"
                  title="Open document"
                  className="rounded p-1.5 text-cyan-800 hover:bg-cyan-100"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                {!disabled ? (
                  <button
                    type="button"
                    title="Remove document"
                    disabled={deletingId === attachment.id}
                    onClick={() => void removeFile(attachment)}
                    className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === attachment.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
