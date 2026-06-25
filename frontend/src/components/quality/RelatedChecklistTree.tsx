import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Image,
  Loader2,
  Search,
  X,
} from "lucide-react";
import api from "../../api/axios";
import { getPublicFileUrl } from "../../api/baseUrl";
import type { RelatedChecklistOption } from "../../types/quality";

interface Props {
  groups: RelatedChecklistOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  loading?: boolean;
}

export default function RelatedChecklistTree({
  groups,
  selectedIds,
  onChange,
  loading = false,
}: Props) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<any>(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState<number | null>(null);
  const normalized = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          children: group.children.filter((child) =>
            [
              group.checklistName,
              group.checklistNo,
              group.activityName,
              group.listName,
              child.rfiNumber,
              child.goLabel,
              child.goDetails,
              child.elementName,
              child.drawingNo,
              child.status,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(normalized),
          ),
        }))
        .filter((group) => !normalized || group.children.length > 0),
    [groups, normalized],
  );
  const selectedChildren = groups
    .flatMap((group) => group.children.map((child) => ({ group, child })))
    .filter(({ child }) => selectedIds.includes(child.inspectionId));

  const toggle = (id: number) =>
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    );

  const openPreview = async (inspectionId: number) => {
    setLoadingPreviewId(inspectionId);
    try {
      const detailResponse = await api.get(
        `/quality/inspections/${inspectionId}`,
      );
      const detail = detailResponse.data;
      const observationResponse = await api
        .get(`/quality/activities/${detail.activityId}/observations`, {
          params: { inspectionId },
        })
        .catch(() => ({ data: [] }));
      setPreview({
        ...detail,
        observations: (observationResponse.data || []).filter(
          (observation: any) =>
            Number(observation.inspectionId) === inspectionId,
        ),
      });
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to preview this RFI.");
    } finally {
      setLoadingPreviewId(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search checklist, activity, RFI, GO, element or drawing"
          className="w-full rounded-md border border-border-default py-2 pl-9 pr-3 text-sm"
        />
      </div>

      {selectedChildren.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedChildren.map(({ child }) => (
            <button
              key={child.inspectionId}
              type="button"
              onClick={() => toggle(child.inspectionId)}
              className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-secondary-muted px-2 py-1 text-xs font-medium text-indigo-800"
            >
              {child.goLabel || "GO 1"} ·{" "}
              {child.elementName || child.rfiNumber}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      <div className="max-h-64 overflow-auto rounded-md border border-border-default bg-surface-card">
        {loading ? (
          <div className="p-4 text-sm text-text-muted">Loading checklists...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-text-muted">
            No eligible previous RFIs found at this location.
          </div>
        ) : (
          filtered.map((group) => {
            const key = `${group.checklistId}:${group.activityId}`;
            const isOpen = Boolean(expanded[key] || normalized);
            return (
              <div
                key={key}
                className="border-b border-border-subtle last:border-0"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((current) => ({
                      ...current,
                      [key]: !current[key],
                    }))
                  }
                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-raised"
                >
                  {isOpen ? (
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span>
                    <span className="block text-sm font-semibold text-text-primary">
                      {group.checklistName}
                    </span>
                    <span className="block text-xs text-text-muted">
                      {[group.listName, group.activityName, group.checklistNo]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-border-subtle bg-surface-base px-3 py-1">
                    {group.children.map((child) => (
                      <div
                        key={child.inspectionId}
                        className="flex items-start gap-2 rounded-md px-2 py-2 hover:bg-surface-card"
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select ${child.rfiNumber}`}
                          className="mt-1 cursor-pointer"
                          checked={selectedIds.includes(child.inspectionId)}
                          onChange={() => toggle(child.inspectionId)}
                        />
                        <button
                          type="button"
                          onClick={() => toggle(child.inspectionId)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block text-sm font-medium text-text-primary">
                            {[
                              child.goLabel || "GO 1",
                              child.elementName,
                              child.rfiNumber,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                          <span className="block text-xs text-text-muted">
                            {[
                              child.goDetails,
                              child.drawingNo
                                ? `Drawing ${child.drawingNo}`
                                : null,
                              child.status,
                              child.requestDate,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </button>
                        <button
                          type="button"
                          title="Preview checklist, GO details and evidence"
                          onClick={() => void openPreview(child.inspectionId)}
                          disabled={loadingPreviewId === child.inspectionId}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-default bg-surface-card text-text-secondary hover:border-secondary hover:text-secondary disabled:opacity-50"
                        >
                          {loadingPreviewId === child.inspectionId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview RFI ${preview.id}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreview(null);
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border-default bg-surface-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border-default px-5 py-4">
              <div>
                <div className="text-lg font-bold text-text-primary">
                  RFI #{preview.id} ·{" "}
                  {preview.activity?.activityName || "Checklist"}
                </div>
                <div className="mt-1 text-sm text-text-secondary">
                  {[
                    preview.goLabel || preview.partLabel || "GO 1",
                    preview.elementName,
                    preview.goDetails,
                    preview.drawingNo
                      ? `Drawing ${preview.drawingNo}`
                      : null,
                    preview.status,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <button
                type="button"
                title="Close preview"
                onClick={() => setPreview(null)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-default hover:bg-surface-raised"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              <section>
                <h3 className="mb-2 text-sm font-bold text-text-primary">
                  Checklist responses
                </h3>
                <div className="overflow-hidden rounded-md border border-border-default">
                  {(preview.stages || []).map((stage: any) => (
                    <div
                      key={stage.id}
                      className="border-b border-border-subtle last:border-0"
                    >
                      <div className="flex items-center justify-between bg-surface-raised px-3 py-2 text-sm font-semibold">
                        <span>
                          {stage.stageTemplate?.name || "Checklist stage"}
                        </span>
                        <span className="text-xs text-text-muted">
                          {stage.status || "PENDING"}
                        </span>
                      </div>
                      {(stage.items || []).map((item: any) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-[1fr_auto] gap-3 border-t border-border-subtle px-3 py-2 text-sm"
                        >
                          <div>
                            <div className="text-text-primary">
                              {item.itemTemplate?.itemText ||
                                item.itemTemplate?.description ||
                                "Checklist item"}
                            </div>
                            {item.remarks && (
                              <div className="mt-0.5 text-xs text-text-muted">
                                {item.remarks}
                              </div>
                            )}
                          </div>
                          <span className="font-semibold text-text-secondary">
                            {item.value || (item.isOk ? "YES" : "-")}
                          </span>
                        </div>
                      ))}
                      {(stage.signatures || []).length > 0 && (
                        <div className="flex flex-wrap gap-2 border-t border-border-subtle px-3 py-2">
                          {(stage.signatures || [])
                            .filter((signature: any) => !signature.isReversed)
                            .map((signature: any) => (
                              <span
                                key={signature.id}
                                className="rounded bg-success-muted px-2 py-1 text-xs text-emerald-800"
                              >
                                Signed by{" "}
                                {signature.signerDisplayName ||
                                  signature.signedBy ||
                                  "Approver"}
                                {signature.signerRoleLabel
                                  ? ` · ${signature.signerRoleLabel}`
                                  : ""}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {(preview.stages || []).length === 0 && (
                    <div className="p-4 text-sm text-text-muted">
                      No checklist responses are available.
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold text-text-primary">
                  Observations
                </h3>
                <div className="space-y-2">
                  {(preview.observations || []).map((observation: any) => (
                    <div
                      key={observation.id}
                      className="rounded-md border border-border-default p-3"
                    >
                      <div className="flex justify-between gap-3 text-xs">
                        <span className="font-bold text-text-primary">
                          {observation.type || "Observation"} ·{" "}
                          {observation.status}
                        </span>
                        <span className="text-text-muted">
                          {observation.createdAt
                            ? new Date(observation.createdAt).toLocaleString()
                            : ""}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-text-secondary">
                        {observation.observationText}
                      </p>
                      {observation.closureText && (
                        <p className="mt-2 rounded bg-success-muted p-2 text-xs text-emerald-800">
                          Rectification: {observation.closureText}
                        </p>
                      )}
                      {[
                        ...((observation.photos as string[]) || []),
                        ...((observation.closureEvidence as string[]) || []),
                      ].length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            ...((observation.photos as string[]) || []),
                            ...((observation.closureEvidence as string[]) || []),
                          ].map((photo, index) => (
                            <a
                              key={`${observation.id}-${index}`}
                              href={getPublicFileUrl(photo)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img
                                src={getPublicFileUrl(photo)}
                                alt="Observation evidence"
                                className="h-20 w-24 rounded border border-border-default bg-white object-contain"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {(preview.observations || []).length === 0 && (
                    <div className="text-sm text-text-muted">
                      No observations were raised.
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold text-text-primary">
                  Reference images and documents
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(preview.attachments || []).map((attachment: any) => {
                    const previewUrl =
                      attachment.annotatedUrl || attachment.originalUrl;
                    const isImage =
                      attachment.mimeType?.startsWith("image/") ||
                      Boolean(attachment.annotatedUrl);
                    return (
                      <a
                        key={attachment.id}
                        href={getPublicFileUrl(previewUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="overflow-hidden rounded-md border border-border-default bg-surface-base hover:border-secondary"
                      >
                        {isImage ? (
                          <img
                            src={getPublicFileUrl(previewUrl)}
                            alt={attachment.originalName}
                            className="h-36 w-full bg-white object-contain"
                          />
                        ) : (
                          <div className="flex h-36 items-center justify-center">
                            <FileText className="h-10 w-10 text-red-600" />
                          </div>
                        )}
                        <div className="flex items-center gap-2 border-t border-border-subtle px-3 py-2 text-xs font-medium text-text-primary">
                          {isImage ? (
                            <Image className="h-4 w-4 shrink-0" />
                          ) : (
                            <FileText className="h-4 w-4 shrink-0" />
                          )}
                          <span className="truncate">
                            {attachment.originalName}
                          </span>
                        </div>
                      </a>
                    );
                  })}
                  {(preview.attachments || []).length === 0 && (
                    <div className="col-span-full text-sm text-text-muted">
                      No reference images or documents are attached.
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-2 border-t border-border-default px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  toggle(preview.id);
                  setPreview(null);
                }}
                className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary-dark"
              >
                {selectedIds.includes(preview.id)
                  ? "Remove selection"
                  : "Select this checklist"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
