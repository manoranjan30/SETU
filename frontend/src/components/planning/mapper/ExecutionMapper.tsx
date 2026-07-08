import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import api from "../../../api/axios";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileUp,
  Filter,
  Gauge,
  GitBranch,
  GripVertical,
  History,
  Keyboard,
  Link as LinkIcon,
  Loader,
  MapPin,
  Minimize2,
  PanelRightOpen,
  RotateCcw,
  Rows3,
  Sparkles,
  Split,
  Target,
  X,
} from "lucide-react";
import BoqGridPanel from "./BoqGridPanel";
import ActivityPickerModal from "./ActivityPickerModal";
import WoBulkMappingImportWizard from "./WoBulkMappingImportWizard";
import {
  buildActivitySuggestionIndex,
  computeActivitySuggestionsFromIndex,
  deriveBranchPath,
  extractLocationPhrases,
  normalizeMapperText,
} from "./mapperMatching";
import type {
  ActivitySuggestion,
  ConfidenceLevel,
  LearnedMappingPatternIndex,
} from "./mapperMatching";
import {
  downloadBlob,
  withFileExtension,
} from "../../../utils/file-download.utils";

const yieldToMainThread = () =>
  new Promise<void>((resolve) => window.setTimeout(resolve, 0));

type ReviewStatus = "APPROVED" | "NEEDS_REVIEW" | "REJECTED" | "SKIPPED";

type SelectedWoItem = {
  workOrderItemId: number;
  description: string;
  materialCode?: string;
  linkedActivities?: string;
  treeContext?: string;
  boqPath?: string;
  fullContext?: string;
  locationKey?: string;
};

type MappingAuditEntry = {
  id: number;
  workOrderItemId: number;
  activityId: number;
  activityCode: string;
  activityName: string;
  plannedQuantity: number;
  mappingType?: string;
  mappingRules?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdOn?: string | null;
  updatedOn?: string | null;
  treePath?: string;
};

type ReviewRow = {
  item: SelectedWoItem;
  suggestions: ActivitySuggestion[];
  selectedActivityId: number | null;
  status: ReviewStatus;
  overrideReason: string;
  currentMappings: MappingAuditEntry[];
  topConfidence: ConfidenceLevel;
};

type BranchSuggestion = {
  branchPath: string;
  matchedItems: number;
  avgScore: number;
  sampleActivities: string[];
};

type SelectionFeedbackState = {
  active: boolean;
  message: string;
  progress: number;
};

type MappingInFlightState = {
  active: boolean;
  processed: number;
  total: number;
  message: string;
};

const REVIEW_SESSION_PREFIX = "wo-mapper-review";
const LEARNED_MAPPING_RESET_PREFIX = "wo-mapper-learning-reset";

const getConfidenceTone = (confidence: ConfidenceLevel) => {
  switch (confidence) {
    case "HIGH":
      return "bg-emerald-100 text-emerald-700";
    case "MEDIUM":
      return "bg-amber-100 text-amber-700";
    case "LOW":
    default:
      return "bg-rose-100 text-rose-700";
  }
};

const getStatusTone = (status: ReviewStatus) => {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-700";
    case "NEEDS_REVIEW":
      return "bg-amber-100 text-amber-700";
    case "REJECTED":
      return "bg-rose-100 text-rose-700";
    case "SKIPPED":
    default:
      return "bg-slate-100 text-slate-700";
  }
};

const formatAuditTime = (value?: string | null) => {
  if (!value) return "Unknown";
  try {
    return new Date(value).toLocaleString("en-IN");
  } catch {
    return value;
  }
};

const getLearnedSuggestionSummary = (suggestion: ActivitySuggestion) => {
  if (!suggestion.learned?.totalBoost) return "";

  const locationReasons = Array.from(
    new Set([
      ...(suggestion.learned.branchLocations || []),
      ...(suggestion.learned.activityLocations || []),
    ]),
  ).slice(0, 3);

  const tokenReasons = Array.from(
    new Set([
      ...(suggestion.learned.branchTokens || []),
      ...(suggestion.learned.activityTokens || []),
    ]),
  )
    .filter((token) => token.length > 2)
    .slice(0, 3);

  const reasons = [...locationReasons, ...tokenReasons].slice(0, 4);
  if (reasons.length === 0) {
    return "Learned from previous approved mappings";
  }

  return `Learned from previous mappings: ${reasons.join(" + ")}`;
};

const isEditableTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    Boolean(element.closest("[contenteditable='true']"))
  );
};

type AssistantPanelProps = {
  fullscreen?: boolean;
  selectedWoItems: SelectedWoItem[];
  isSuggestionEngineRunning: boolean;
  suggestionEngineMessage: string;
  assistantMode: "suggestions" | "workbench" | "review";
  setAssistantMode: (mode: "suggestions" | "workbench" | "review") => void;
  quickSuggestions: ActivitySuggestion[];
  branchSuggestions: BranchSuggestion[];
  activeWorkbenchItem: SelectedWoItem | null;
  activeWorkbenchSuggestions: ActivitySuggestion[];
  bulkReviewRows: ReviewRow[];
  filteredReviewRows: ReviewRow[];
  activeReviewRow: ReviewRow | null;
  reviewSelectedItemIds: number[];
  reviewStatusFilter: "ALL" | ReviewStatus;
  reviewConfidenceFilter: "ALL" | ConfidenceLevel;
  setReviewStatusFilter: (value: "ALL" | ReviewStatus) => void;
  setReviewConfidenceFilter: (value: "ALL" | ConfidenceLevel) => void;
  setBulkReviewSelection: (workOrderItemId: number, activityId: number) => void;
  setReviewStatus: (workOrderItemId: number, status: ReviewStatus) => void;
  setReviewOverrideReason: (workOrderItemId: number, value: string) => void;
  toggleReviewRowSelection: (workOrderItemId: number) => void;
  setActiveReviewRowId: (workOrderItemId: number) => void;
  selectAllVisibleReviewRows: () => void;
  clearReviewRowSelection: () => void;
  approveTopMatchForHighConfidence: () => void;
  markLowConfidenceNeedsReview: () => void;
  applyBranchSuggestion: (branchPath: string) => void;
  copyActiveBranchToSelectedRows: () => void;
  applyBulkReviewRow: (
    workOrderItemId: number,
    activityId: number,
  ) => Promise<void>;
  applyBulkReviewAll: () => Promise<void>;
  setActiveWorkbenchItemId: (id: number) => void;
  handleLink: (activityId: number) => Promise<void>;
  handleLinkItems: (
    ids: number[],
    activityId: number,
    options?: {
      closeModal?: boolean;
      clearSelection?: boolean;
      refresh?: boolean;
      showSuccess?: boolean;
      mappingRulesByItem?: Record<number, Record<string, unknown>>;
    },
  ) => Promise<void>;
  openFullTreeValidation: () => void;
  openFullscreen?: () => void;
  closeFullscreen?: () => void;
  learnedActivityPatternCount: number;
  learnedBranchPatternCount: number;
  learnedResetAt: number;
  resetLearnedPatternMemory: () => void;
};

const MapperAssistantPanel: React.FC<AssistantPanelProps> = ({
  fullscreen = false,
  selectedWoItems,
  isSuggestionEngineRunning,
  suggestionEngineMessage,
  assistantMode,
  setAssistantMode,
  quickSuggestions,
  branchSuggestions,
  activeWorkbenchItem,
  activeWorkbenchSuggestions,
  bulkReviewRows,
  filteredReviewRows,
  activeReviewRow,
  reviewSelectedItemIds,
  reviewStatusFilter,
  reviewConfidenceFilter,
  setReviewStatusFilter,
  setReviewConfidenceFilter,
  setBulkReviewSelection,
  setReviewStatus,
  setReviewOverrideReason,
  toggleReviewRowSelection,
  setActiveReviewRowId,
  selectAllVisibleReviewRows,
  clearReviewRowSelection,
  approveTopMatchForHighConfidence,
  markLowConfidenceNeedsReview,
  applyBranchSuggestion,
  copyActiveBranchToSelectedRows,
  applyBulkReviewRow,
  applyBulkReviewAll,
  setActiveWorkbenchItemId,
  handleLink,
  handleLinkItems,
  openFullTreeValidation,
  openFullscreen,
  closeFullscreen,
  learnedActivityPatternCount,
  learnedBranchPatternCount,
  learnedResetAt,
  resetLearnedPatternMemory,
}) => {
  const displayedSelectionItems = selectedWoItems.slice(0, 60);
  const hiddenSelectionCount = Math.max(
    0,
    selectedWoItems.length - displayedSelectionItems.length,
  );

  return (
    <div
      className={`flex min-h-0 flex-col rounded-lg border bg-surface-card shadow ${
        fullscreen ? "h-full" : ""
      }`}
    >
      <div className="border-b bg-surface-base px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">
                Smart Map Assistant
              </h2>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              Confidence scoring, branch intelligence, fast review statuses, and
              keyboard-driven approvals are all active here.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                Learned patterns: {learnedActivityPatternCount} activity,{" "}
                {learnedBranchPatternCount} branch
              </span>
              {learnedResetAt > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                  Reset after {new Date(learnedResetAt).toLocaleString("en-IN")}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={resetLearnedPatternMemory}
              className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-raised"
            >
              <span className="inline-flex items-center gap-2">
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Learned Memory
              </span>
            </button>
            {fullscreen ? (
              <button
                type="button"
                onClick={closeFullscreen}
                className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-raised"
              >
                <span className="inline-flex items-center gap-2">
                  <Minimize2 className="h-3.5 w-3.5" />
                  Exit Full Screen
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={openFullscreen}
                className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-raised"
              >
                <span className="inline-flex items-center gap-2">
                  <PanelRightOpen className="h-3.5 w-3.5" />
                  Open Full Screen
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {selectedWoItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-default p-6 text-center text-sm text-text-muted">
            Select WO measurement rows on the left to get live suggestions here.
          </div>
        ) : (
          <div className="space-y-4">
            {(isSuggestionEngineRunning || selectedWoItems.length > 80) && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-xs text-blue-700">
                <div className="flex items-center gap-2 font-semibold">
                  <Loader className="h-3.5 w-3.5 animate-spin" />
                  {isSuggestionEngineRunning
                    ? suggestionEngineMessage
                    : "Large parent selection detected. The mapper is preparing hierarchy-aware suggestions."}
                </div>
                <div className="mt-1 text-[11px] text-blue-600">
                  Parent selection includes many child measurement rows, so the
                  assistant is matching full BOQ hierarchy against the full
                  schedule tree.
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border-default bg-surface-base p-3">
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-disabled">
                Current Selection
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1 text-xs">
                {displayedSelectionItems.map((item) => (
                  <div
                    key={item.workOrderItemId}
                    className="rounded-lg bg-surface-card px-2 py-2"
                  >
                    <div className="font-semibold text-slate-800">
                      {item.description}
                    </div>
                    {item.boqPath && (
                      <div className="mt-1 text-[11px] text-text-muted">
                        BOQ Path: {item.boqPath}
                      </div>
                    )}
                    {item.treeContext && (
                      <div className="mt-1 text-text-muted">
                        WO Path: {item.treeContext}
                      </div>
                    )}
                  </div>
                ))}
                {hiddenSelectionCount > 0 && (
                  <div className="rounded-lg border border-dashed border-border-default bg-surface-base px-2 py-2 text-[11px] text-text-muted">
                    {hiddenSelectionCount} more selected WO rows are hidden here
                    to keep the mapper responsive.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border-default bg-surface-base p-3">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-disabled">
                <Rows3 className="h-3.5 w-3.5" />
                Mapping Mode
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAssistantMode("suggestions")}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${
                    assistantMode === "suggestions"
                      ? "bg-primary-muted text-primary"
                      : "bg-surface-card text-text-secondary hover:bg-surface-raised"
                  }`}
                >
                  Smart Suggestions
                </button>
                <button
                  type="button"
                  onClick={() => setAssistantMode("workbench")}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${
                    assistantMode === "workbench"
                      ? "bg-primary-muted text-primary"
                      : "bg-surface-card text-text-secondary hover:bg-surface-raised"
                  }`}
                >
                  Mapping Workbench
                </button>
                <button
                  type="button"
                  onClick={() => setAssistantMode("review")}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${
                    assistantMode === "review"
                      ? "bg-primary-muted text-primary"
                      : "bg-surface-card text-text-secondary hover:bg-surface-raised"
                  }`}
                >
                  Bulk Review Table
                </button>
              </div>
            </div>

            {assistantMode === "suggestions" ? (
              <>
                <div className="rounded-xl border border-border-default bg-surface-base p-3">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-disabled">
                    <GitBranch className="h-3.5 w-3.5" />
                    Suggested Branches
                  </div>
                  {branchSuggestions.length === 0 ? (
                    <div className="text-xs text-text-muted">
                      No repeatable branch signal yet. Select more WO rows to
                      build branch intelligence.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {branchSuggestions.map((branch) => (
                        <div
                          key={branch.branchPath}
                          className="rounded-xl border border-border-default bg-surface-card p-3"
                        >
                          <div className="font-semibold text-slate-800">
                            {branch.branchPath}
                          </div>
                          <div className="mt-1 text-xs text-text-muted">
                            {branch.matchedItems} matched row(s) • avg score{" "}
                            {Math.round(branch.avgScore)}
                          </div>
                          <div className="mt-2 text-[11px] text-text-muted">
                            Examples: {branch.sampleActivities.join(", ")}
                          </div>
                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                applyBranchSuggestion(branch.branchPath)
                              }
                              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark"
                            >
                              Approve This Branch
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border-default bg-surface-base p-3">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-disabled">
                    <Gauge className="h-3.5 w-3.5" />
                    Suggested Activities
                  </div>
                  {quickSuggestions.length === 0 ? (
                    <div className="text-xs text-text-muted">
                      No strong match found yet. Use the full tree validation to
                      map manually.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {quickSuggestions.map((suggestion) => (
                        <div
                          key={suggestion.activity.id}
                          className="rounded-xl border border-border-default bg-surface-card p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800">
                                {suggestion.activity.activityCode}{" "}
                                {suggestion.activity.activityName}
                              </div>
                              <div className="mt-1 flex items-start gap-2 text-xs text-text-muted">
                                <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                <span>{suggestion.treePath}</span>
                              </div>
                              <div className="mt-1 text-[11px] text-text-muted">
                                Branch: {suggestion.branchPath}
                              </div>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${getConfidenceTone(
                                suggestion.confidence,
                              )}`}
                            >
                              {suggestion.confidence}
                            </span>
                          </div>
                          {suggestion.matches.locationMatches.length > 0 && (
                            <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-green-700">
                              Location match:{" "}
                              {suggestion.matches.locationMatches.join(", ")}
                            </div>
                          )}
                          {suggestion.learned?.totalBoost ? (
                            <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-violet-700">
                              {getLearnedSuggestionSummary(suggestion)}
                              {suggestion.learned.branchPatternHits > 0
                                ? ` • branch ${suggestion.learned.branchPatternHits}`
                                : ""}
                              {suggestion.learned.activityPatternHits > 0
                                ? ` • activity ${suggestion.learned.activityPatternHits}`
                                : ""}
                            </div>
                          ) : null}
                          <div className="mt-2 flex items-center justify-between">
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-700">
                              Match score {suggestion.score}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                void handleLink(suggestion.activity.id)
                              }
                              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark"
                            >
                              Quick Link
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : assistantMode === "workbench" ? (
              <div
                className={`grid gap-3 rounded-xl border border-border-default bg-surface-base p-3 ${
                  fullscreen
                    ? "min-h-[70vh] grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]"
                    : "min-h-[420px] grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
                }`}
              >
                <div className="flex min-h-0 flex-col rounded-xl border border-border-default bg-surface-card">
                  <div className="border-b px-3 py-2">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-disabled">
                      <GripVertical className="h-3.5 w-3.5" />
                      Selected WO Items Queue
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      Scroll the queue, select an item, or drag it onto a
                      candidate activity card.
                    </p>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    <div className="space-y-2">
                      {displayedSelectionItems.map((item) => (
                        <button
                          key={item.workOrderItemId}
                          type="button"
                          draggable
                          onDragStart={(event) =>
                            event.dataTransfer.setData(
                              "text/plain",
                              String(item.workOrderItemId),
                            )
                          }
                          onClick={() =>
                            setActiveWorkbenchItemId(item.workOrderItemId)
                          }
                          className={`w-full rounded-lg border px-3 py-2 text-left ${
                            activeWorkbenchItem?.workOrderItemId ===
                            item.workOrderItemId
                              ? "border-primary/30 bg-primary-muted"
                              : "border-border-default bg-surface-base hover:bg-surface-raised"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-disabled" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-slate-800">
                                {item.description}
                              </div>
                              {item.boqPath && (
                                <div className="mt-1 text-xs text-text-muted">
                                  BOQ: {item.boqPath}
                                </div>
                              )}
                              {item.treeContext && (
                                <div className="mt-1 text-xs text-text-muted">
                                  WO: {item.treeContext}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                      {hiddenSelectionCount > 0 && (
                        <div className="rounded-lg border border-dashed border-border-default bg-surface-base px-3 py-2 text-[11px] text-text-muted">
                          Showing the first {displayedSelectionItems.length}{" "}
                          items in the queue. {hiddenSelectionCount} more
                          selected rows remain in the current batch.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col rounded-xl border border-border-default bg-surface-card">
                  <div className="border-b px-3 py-2">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-disabled">
                      <Target className="h-3.5 w-3.5" />
                      Candidate Activities
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      Branch-aware candidates, confidence badges, and drag-drop
                      mapping for the active row.
                    </p>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {!activeWorkbenchItem ? (
                      <div className="rounded-lg border border-dashed border-border-default p-4 text-xs text-text-muted">
                        Select a WO item from the queue to inspect its best
                        activity matches.
                      </div>
                    ) : activeWorkbenchSuggestions.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border-default p-4 text-xs text-text-muted">
                        No strong candidates found for this item yet. Use the
                        full tree validation if needed.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activeWorkbenchSuggestions.map((suggestion) => (
                          <div
                            key={suggestion.activity.id}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault();
                              const workOrderItemId = Number(
                                event.dataTransfer.getData("text/plain"),
                              );
                              if (workOrderItemId) {
                                void handleLinkItems(
                                  [workOrderItemId],
                                  suggestion.activity.id,
                                );
                              }
                            }}
                            className="rounded-xl border border-border-default bg-surface-base p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-800">
                                  {suggestion.activity.activityCode}{" "}
                                  {suggestion.activity.activityName}
                                </div>
                                <div className="mt-1 flex items-start gap-2 text-xs text-text-muted">
                                  <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                  <span>{suggestion.treePath}</span>
                                </div>
                                <div className="mt-1 text-[11px] text-text-muted">
                                  Branch: {suggestion.branchPath}
                                </div>
                              </div>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${getConfidenceTone(
                                  suggestion.confidence,
                                )}`}
                              >
                                {suggestion.confidence}
                              </span>
                            </div>
                            {suggestion.matches.locationMatches.length > 0 && (
                              <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-green-700">
                                Location match:{" "}
                                {suggestion.matches.locationMatches.join(", ")}
                              </div>
                            )}
                            {suggestion.learned?.totalBoost ? (
                              <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-violet-700">
                                {getLearnedSuggestionSummary(suggestion)}
                              </div>
                            ) : null}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-700">
                                Match score {suggestion.score}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                Drag item here
                              </span>
                            </div>
                            <div className="mt-3 flex justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleLinkItems(
                                    [activeWorkbenchItem.workOrderItemId],
                                    suggestion.activity.id,
                                  )
                                }
                                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark"
                              >
                                Map This Item
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-border-default bg-surface-base p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-disabled">
                        <Filter className="h-3.5 w-3.5" />
                        Review Controls
                      </div>
                      <p className="mt-1 text-xs text-text-muted">
                        Confidence filters, approval statuses, branch actions,
                        and keyboard shortcuts keep this review screen fast even
                        for large batches.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={approveTopMatchForHighConfidence}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        <span className="inline-flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve High Confidence
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={markLowConfidenceNeedsReview}
                        className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600"
                      >
                        <span className="inline-flex items-center gap-2">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Flag Low Confidence
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={copyActiveBranchToSelectedRows}
                        className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Copy className="h-3.5 w-3.5" />
                          Copy Active Branch
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void applyBulkReviewAll()}
                        disabled={bulkReviewRows.length === 0}
                        className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Apply All Approved
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                    <div className="rounded-xl border border-border-default bg-surface-card p-3">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-disabled">
                        <Keyboard className="h-3.5 w-3.5" />
                        Keyboard Flow
                      </div>
                      <div className="mt-2 grid gap-2 text-[11px] text-text-muted md:grid-cols-2">
                        <div>`↑ / ↓` move active row</div>
                        <div>`1 / 2 / 3` pick suggestion</div>
                        <div>`A` approve</div>
                        <div>`N` needs review</div>
                        <div>`S` skip</div>
                        <div>`X` reject</div>
                        <div>`Enter` apply active row</div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border-default bg-surface-card p-3">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-disabled">
                        <Gauge className="h-3.5 w-3.5" />
                        Filters
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <select
                          value={reviewConfidenceFilter}
                          onChange={(event) =>
                            setReviewConfidenceFilter(
                              event.target.value as "ALL" | ConfidenceLevel,
                            )
                          }
                          className="rounded-lg border border-border-default bg-surface-base px-3 py-2 text-xs"
                        >
                          <option value="ALL">All Confidence</option>
                          <option value="HIGH">High Confidence</option>
                          <option value="MEDIUM">Medium Confidence</option>
                          <option value="LOW">Low Confidence</option>
                        </select>
                        <select
                          value={reviewStatusFilter}
                          onChange={(event) =>
                            setReviewStatusFilter(
                              event.target.value as "ALL" | ReviewStatus,
                            )
                          }
                          className="rounded-lg border border-border-default bg-surface-base px-3 py-2 text-xs"
                        >
                          <option value="ALL">All Statuses</option>
                          <option value="APPROVED">Approved</option>
                          <option value="NEEDS_REVIEW">Needs Review</option>
                          <option value="REJECTED">Rejected</option>
                          <option value="SKIPPED">Skipped</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {activeReviewRow && (
                  <div className="rounded-xl border border-border-default bg-surface-base p-3">
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px]">
                      <div className="rounded-xl border border-border-default bg-surface-card p-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-text-disabled">
                          Active WO Row
                        </div>
                        <div className="mt-2 font-semibold text-slate-800">
                          {activeReviewRow.item.description}
                        </div>
                        {activeReviewRow.item.boqPath && (
                          <div className="mt-1 text-xs text-text-muted">
                            BOQ: {activeReviewRow.item.boqPath}
                          </div>
                        )}
                        {activeReviewRow.item.treeContext && (
                          <div className="mt-1 text-xs text-text-muted">
                            WO: {activeReviewRow.item.treeContext}
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-border-default bg-surface-card p-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-text-disabled">
                          Selected Candidate
                        </div>
                        {(() => {
                          const selectedSuggestion =
                            activeReviewRow.suggestions.find(
                              (suggestion) =>
                                suggestion.activity.id ===
                                activeReviewRow.selectedActivityId,
                            ) || activeReviewRow.suggestions[0];
                          if (!selectedSuggestion) {
                            return (
                              <div className="mt-2 text-xs text-text-muted">
                                No candidate selected yet.
                              </div>
                            );
                          }
                          return (
                            <div className="mt-2">
                              <div className="font-semibold text-slate-800">
                                {selectedSuggestion.activity.activityCode}{" "}
                                {selectedSuggestion.activity.activityName}
                              </div>
                              <div className="mt-1 text-xs text-text-muted">
                                {selectedSuggestion.treePath}
                              </div>
                              <div className="mt-1 text-[11px] text-text-muted">
                                Branch: {selectedSuggestion.branchPath}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${getConfidenceTone(
                                    selectedSuggestion.confidence,
                                  )}`}
                                >
                                  {selectedSuggestion.confidence}
                                </span>
                                {selectedSuggestion.learned?.totalBoost ? (
                                  <span
                                    title={getLearnedSuggestionSummary(
                                      selectedSuggestion,
                                    )}
                                    className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-violet-700"
                                  >
                                    Learned
                                  </span>
                                ) : null}
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-700">
                                  Score {selectedSuggestion.score}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="rounded-xl border border-border-default bg-surface-card p-3">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-disabled">
                          <History className="h-3.5 w-3.5" />
                          Mapping Audit
                        </div>
                        {activeReviewRow.currentMappings.length === 0 ? (
                          <div className="mt-2 text-xs text-text-muted">
                            No saved mapping history for this WO row yet.
                          </div>
                        ) : (
                          <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
                            {activeReviewRow.currentMappings.map((entry) => (
                              <div
                                key={entry.id}
                                className="rounded-lg bg-surface-base px-2 py-2 text-xs"
                              >
                                <div className="font-semibold text-slate-800">
                                  {entry.activityCode} {entry.activityName}
                                </div>
                                {entry.treePath && (
                                  <div className="mt-1 text-text-muted">
                                    {entry.treePath}
                                  </div>
                                )}
                                <div className="mt-1 text-text-muted">
                                  By {entry.createdBy || "system"} •{" "}
                                  {formatAuditTime(
                                    entry.updatedOn || entry.createdOn,
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-border-default bg-surface-base p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-text-disabled">
                      Bulk Review Table
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={selectAllVisibleReviewRows}
                        className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-raised"
                      >
                        Select Visible
                      </button>
                      <button
                        type="button"
                        onClick={clearReviewRowSelection}
                        className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-raised"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-border-default bg-surface-card">
                    <div className="grid grid-cols-[44px_minmax(0,1.2fr)_110px_110px_110px_130px_100px] gap-2 border-b bg-surface-raised px-3 py-2 text-[10px] font-black uppercase tracking-widest text-text-muted">
                      <div />
                      <div>WO Item</div>
                      <div>Match 1</div>
                      <div>Match 2</div>
                      <div>Match 3</div>
                      <div>Status</div>
                      <div>Action</div>
                    </div>
                    <div
                      className={`${fullscreen ? "max-h-[58vh]" : "max-h-[420px]"} overflow-y-auto`}
                    >
                      {filteredReviewRows.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-text-muted">
                          No review rows match the current filters.
                        </div>
                      ) : (
                        filteredReviewRows.map((row) => {
                          const manualOverride =
                            row.selectedActivityId !==
                            row.suggestions[0]?.activity.id;
                          const isActive =
                            activeReviewRow?.item.workOrderItemId ===
                            row.item.workOrderItemId;
                          const isSelected = reviewSelectedItemIds.includes(
                            row.item.workOrderItemId,
                          );

                          return (
                            <div
                              key={row.item.workOrderItemId}
                              className={`grid grid-cols-[44px_minmax(0,1.2fr)_110px_110px_110px_130px_100px] gap-2 border-b border-border-subtle px-3 py-3 text-xs last:border-b-0 ${
                                isActive ? "bg-primary-muted/40" : ""
                              }`}
                              onClick={() =>
                                setActiveReviewRowId(row.item.workOrderItemId)
                              }
                            >
                              <div className="pt-1">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    toggleReviewRowSelection(
                                      row.item.workOrderItemId,
                                    )
                                  }
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-slate-800">
                                  {row.item.description}
                                </div>
                                {row.item.boqPath && (
                                  <div className="mt-1 truncate text-text-muted">
                                    BOQ: {row.item.boqPath}
                                  </div>
                                )}
                                {row.item.treeContext && (
                                  <div className="mt-1 truncate text-text-muted">
                                    WO: {row.item.treeContext}
                                  </div>
                                )}
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${getConfidenceTone(
                                      row.topConfidence,
                                    )}`}
                                  >
                                    {row.topConfidence}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${getStatusTone(
                                      row.status,
                                    )}`}
                                  >
                                    {row.status.replace("_", " ")}
                                  </span>
                                  {manualOverride && (
                                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-violet-700">
                                      Override
                                    </span>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  value={row.overrideReason}
                                  onChange={(event) =>
                                    setReviewOverrideReason(
                                      row.item.workOrderItemId,
                                      event.target.value,
                                    )
                                  }
                                  placeholder={
                                    manualOverride
                                      ? "Override reason required for non-top match"
                                      : "Optional review note"
                                  }
                                  className="mt-2 w-full rounded-lg border border-border-default bg-surface-base px-2 py-1.5 text-[11px]"
                                />
                              </div>
                              {[0, 1, 2].map((index) => {
                                const suggestion = row.suggestions[index];
                                if (!suggestion) {
                                  return (
                                    <div
                                      key={`${row.item.workOrderItemId}-empty-${index}`}
                                      className="rounded-lg border border-dashed border-border-default px-2 py-2 text-[11px] text-text-disabled"
                                    >
                                      No match
                                    </div>
                                  );
                                }

                                const suggestionSelected =
                                  row.selectedActivityId ===
                                  suggestion.activity.id;
                                return (
                                  <button
                                    key={suggestion.activity.id}
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setBulkReviewSelection(
                                        row.item.workOrderItemId,
                                        suggestion.activity.id,
                                      );
                                    }}
                                    className={`rounded-lg border px-2 py-2 text-left transition-colors ${
                                      suggestionSelected
                                        ? "border-primary/40 bg-primary-muted"
                                        : "border-border-default hover:bg-surface-base"
                                    }`}
                                    title={`${suggestion.activity.activityCode} ${suggestion.activity.activityName}\n${suggestion.treePath}`}
                                  >
                                    <div className="truncate font-semibold text-slate-800">
                                      {suggestion.activity.activityCode}
                                    </div>
                                    <div className="mt-1 truncate text-[10px] text-text-muted">
                                      {suggestion.branchPath}
                                    </div>
                                    <div className="mt-1 flex items-center justify-between gap-1">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                                        {suggestion.score}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        {suggestion.learned?.totalBoost ? (
                                          <span
                                            title={getLearnedSuggestionSummary(
                                              suggestion,
                                            )}
                                            className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-violet-700"
                                          >
                                            Learned
                                          </span>
                                        ) : null}
                                        <span
                                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${getConfidenceTone(
                                            suggestion.confidence,
                                          )}`}
                                        >
                                          {suggestion.confidence}
                                        </span>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                              <div className="space-y-2">
                                <select
                                  value={row.status}
                                  onChange={(event) =>
                                    setReviewStatus(
                                      row.item.workOrderItemId,
                                      event.target.value as ReviewStatus,
                                    )
                                  }
                                  className="w-full rounded-lg border border-border-default bg-surface-base px-2 py-1.5 text-[11px]"
                                >
                                  <option value="APPROVED">Approved</option>
                                  <option value="NEEDS_REVIEW">
                                    Needs Review
                                  </option>
                                  <option value="REJECTED">Rejected</option>
                                  <option value="SKIPPED">Skipped</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    const topBranch =
                                      row.suggestions[0]?.branchPath;
                                    if (topBranch) {
                                      applyBranchSuggestion(topBranch);
                                    }
                                  }}
                                  className="w-full rounded-lg border border-border-default bg-surface-card px-2 py-1.5 text-[11px] font-semibold text-text-secondary hover:bg-surface-raised"
                                >
                                  Branch
                                </button>
                              </div>
                              <div className="flex items-start justify-end">
                                <button
                                  type="button"
                                  disabled={
                                    !row.selectedActivityId ||
                                    row.status !== "APPROVED"
                                  }
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (row.selectedActivityId) {
                                      void applyBulkReviewRow(
                                        row.item.workOrderItemId,
                                        row.selectedActivityId,
                                      );
                                    }
                                  }}
                                  className="rounded-lg bg-secondary px-3 py-2 text-[11px] font-bold text-white hover:bg-secondary-dark disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Apply
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={openFullTreeValidation}
              className="w-full rounded-xl border border-border-default px-4 py-3 text-sm font-semibold text-text-secondary hover:bg-surface-base"
            >
              Open Full Tree Validation
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const ExecutionMapper: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const numericProjectId = Number(projectId || 0);
  const sessionKey = `${REVIEW_SESSION_PREFIX}:${numericProjectId}`;
  const learnedResetKey = `${LEARNED_MAPPING_RESET_PREFIX}:${numericProjectId}`;

  const [selectedWoItemIds, setSelectedWoItemIds] = useState<number[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [wbsNodes, setWbsNodes] = useState<any[]>([]);
  const [vendorTree, setVendorTree] = useState<any[]>([]);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isAssistantFullscreenOpen, setIsAssistantFullscreenOpen] =
    useState(false);
  const [isSuggestionEngineRunning, setIsSuggestionEngineRunning] =
    useState(false);
  const [suggestionEngineMessage, setSuggestionEngineMessage] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [downloadingSheet, setDownloadingSheet] = useState(false);
  const [assistantMode, setAssistantMode] = useState<
    "suggestions" | "workbench" | "review"
  >("suggestions");
  const [activeWorkbenchItemId, setActiveWorkbenchItemId] = useState<
    number | null
  >(null);
  const [bulkReviewSelections, setBulkReviewSelections] = useState<
    Record<number, number>
  >({});
  const [reviewStatuses, setReviewStatuses] = useState<
    Record<number, ReviewStatus>
  >({});
  const [reviewOverrideReasons, setReviewOverrideReasons] = useState<
    Record<number, string>
  >({});
  const [reviewSelectedItemIds, setReviewSelectedItemIds] = useState<number[]>(
    [],
  );
  const [reviewStatusFilter, setReviewStatusFilter] = useState<
    "ALL" | ReviewStatus
  >("ALL");
  const [reviewConfidenceFilter, setReviewConfidenceFilter] = useState<
    "ALL" | ConfidenceLevel
  >("ALL");
  const [activeReviewRowId, setActiveReviewRowId] = useState<number | null>(
    null,
  );
  const [mappingAuditByItem, setMappingAuditByItem] = useState<
    Record<number, MappingAuditEntry[]>
  >({});
  const [quickSuggestions, setQuickSuggestions] = useState<
    ActivitySuggestion[]
  >([]);
  const [suggestionsByItem, setSuggestionsByItem] = useState<
    Map<number, ActivitySuggestion[]>
  >(new Map());
  const [selectionFeedback, setSelectionFeedback] =
    useState<SelectionFeedbackState>({
      active: false,
      message: "",
      progress: 0,
    });
  const [mappingInFlight, setMappingInFlight] = useState<MappingInFlightState>({
    active: false,
    processed: 0,
    total: 0,
    message: "",
  });
  const [learnedResetAt, setLearnedResetAt] = useState(0);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(learnedResetKey);
      setLearnedResetAt(raw ? Number(raw) || 0 : 0);
    } catch (error) {
      console.error("Failed to restore WO mapper learned reset marker", error);
      setLearnedResetAt(0);
    }
  }, [learnedResetKey]);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(sessionKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        statuses?: Record<number, ReviewStatus>;
        reasons?: Record<number, string>;
        statusFilter?: "ALL" | ReviewStatus;
        confidenceFilter?: "ALL" | ConfidenceLevel;
      };
      setReviewStatuses(parsed.statuses || {});
      setReviewOverrideReasons(parsed.reasons || {});
      setReviewStatusFilter(parsed.statusFilter || "ALL");
      setReviewConfidenceFilter(parsed.confidenceFilter || "ALL");
    } catch (error) {
      console.error("Failed to restore WO mapper review session", error);
    }
  }, [sessionKey]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        sessionKey,
        JSON.stringify({
          statuses: reviewStatuses,
          reasons: reviewOverrideReasons,
          statusFilter: reviewStatusFilter,
          confidenceFilter: reviewConfidenceFilter,
        }),
      );
    } catch (error) {
      console.error("Failed to persist WO mapper review session", error);
    }
  }, [
    reviewConfidenceFilter,
    reviewOverrideReasons,
    reviewStatusFilter,
    reviewStatuses,
    sessionKey,
  ]);

  const woItemLookup = useMemo(() => {
    const lookup = new Map<number, SelectedWoItem>();

    for (const vendor of vendorTree || []) {
      for (const wo of vendor.workOrders || []) {
        for (const boq of wo.boqItems || []) {
          for (const direct of boq.directWoItems || []) {
            const context = [boq.boqCode, boq.description, direct.description]
              .filter(Boolean)
              .join(" > ");
            lookup.set(direct.workOrderItemId, {
              workOrderItemId: direct.workOrderItemId,
              description: direct.description,
              materialCode: boq.boqCode,
              linkedActivities: direct.linkedActivities,
              boqPath: [boq.boqCode, boq.description]
                .filter(Boolean)
                .join(" > "),
              fullContext: context,
              treeContext: [vendor.vendorName, wo.woNumber, boq.description]
                .filter(Boolean)
                .join(" > "),
              locationKey: extractLocationPhrases(context).join("|"),
            });
          }

          for (const sub of boq.subItems || []) {
            if (sub.woItem?.workOrderItemId) {
              const context = [
                boq.boqCode,
                boq.description,
                sub.description,
                sub.woItem.description || sub.description,
              ]
                .filter(Boolean)
                .join(" > ");
              lookup.set(sub.woItem.workOrderItemId, {
                workOrderItemId: sub.woItem.workOrderItemId,
                description: sub.woItem.description || sub.description,
                materialCode: boq.boqCode,
                linkedActivities: sub.woItem.linkedActivities,
                boqPath: [boq.boqCode, boq.description, sub.description]
                  .filter(Boolean)
                  .join(" > "),
                fullContext: context,
                treeContext: [
                  vendor.vendorName,
                  wo.woNumber,
                  boq.description,
                  sub.description,
                ]
                  .filter(Boolean)
                  .join(" > "),
                locationKey: extractLocationPhrases(context).join("|"),
              });
            }

            for (const measurement of sub.measurements || []) {
              const context = [
                boq.boqCode,
                boq.description,
                sub.description,
                measurement.description,
              ]
                .filter(Boolean)
                .join(" > ");
              lookup.set(measurement.workOrderItemId, {
                workOrderItemId: measurement.workOrderItemId,
                description: measurement.description,
                materialCode: boq.boqCode,
                linkedActivities: measurement.linkedActivities,
                boqPath: [
                  boq.boqCode,
                  boq.description,
                  sub.description,
                  measurement.description,
                ]
                  .filter(Boolean)
                  .join(" > "),
                fullContext: context,
                treeContext: [
                  vendor.vendorName,
                  wo.woNumber,
                  boq.description,
                  sub.description,
                  measurement.description,
                ]
                  .filter(Boolean)
                  .join(" > "),
                locationKey: extractLocationPhrases(context).join("|"),
              });
            }
          }
        }
      }
    }

    return lookup;
  }, [vendorTree]);

  const selectedWoItems = useMemo<SelectedWoItem[]>(() => {
    return selectedWoItemIds
      .map((id) => woItemLookup.get(id))
      .filter((item): item is SelectedWoItem => Boolean(item));
  }, [selectedWoItemIds, woItemLookup]);

  const activityById = useMemo(() => {
    const map = new Map<number, any>();
    activities.forEach((activity) => map.set(activity.id, activity));
    return map;
  }, [activities]);

  const wbsPathById = useMemo(() => {
    const nodeMap = new Map<number, any>();
    wbsNodes.forEach((node) => nodeMap.set(node.id, node));
    const cache = new Map<number, string>();

    const buildPath = (id?: number) => {
      if (!id) return "";
      if (cache.has(id)) return cache.get(id)!;

      const parts: string[] = [];
      let current = nodeMap.get(id);
      while (current) {
        parts.unshift(
          [current.wbsCode, current.wbsName].filter(Boolean).join(" ").trim(),
        );
        current = current.parentId ? nodeMap.get(current.parentId) : null;
      }
      const path = parts.join(" > ");
      cache.set(id, path);
      return path;
    };

    return { get: buildPath };
  }, [wbsNodes]);

  const indexedActivities = useMemo(
    () =>
      buildActivitySuggestionIndex({
        activities,
        getTreePath: wbsPathById.get,
      }),
    [activities, wbsPathById],
  );

  const learnedPatternIndex = useMemo<LearnedMappingPatternIndex>(() => {
    const byActivityId = new Map<
      number,
      { tokens: Set<string>; locations: Set<string>; count: number }
    >();
    const byBranchPath = new Map<
      string,
      { tokens: Set<string>; locations: Set<string>; count: number }
    >();

    Object.values(mappingAuditByItem)
      .flat()
      .forEach((entry) => {
        const entryTimestamp = Date.parse(
          entry.updatedOn || entry.createdOn || "",
        );
        if (
          learnedResetAt > 0 &&
          (!Number.isFinite(entryTimestamp) || entryTimestamp <= learnedResetAt)
        ) {
          return;
        }

        const rules = (entry.mappingRules || {}) as Record<string, unknown>;
        const sourceText = [
          typeof rules.boqPath === "string" ? rules.boqPath : "",
          typeof rules.woPath === "string" ? rules.woPath : "",
          typeof rules.fullContext === "string" ? rules.fullContext : "",
        ]
          .filter(Boolean)
          .join(" > ");
        const branchPath =
          typeof rules.branchPath === "string" && rules.branchPath
            ? rules.branchPath
            : entry.treePath
              ? deriveBranchPath(entry.treePath)
              : "";

        const tokens = normalizeMapperText(sourceText);
        const locations = extractLocationPhrases(sourceText);

        const activityBucket = byActivityId.get(entry.activityId) || {
          tokens: new Set<string>(),
          locations: new Set<string>(),
          count: 0,
        };
        tokens.forEach((token) => activityBucket.tokens.add(token));
        locations.forEach((location) => activityBucket.locations.add(location));
        activityBucket.count += 1;
        byActivityId.set(entry.activityId, activityBucket);

        if (branchPath) {
          const branchBucket = byBranchPath.get(branchPath) || {
            tokens: new Set<string>(),
            locations: new Set<string>(),
            count: 0,
          };
          tokens.forEach((token) => branchBucket.tokens.add(token));
          locations.forEach((location) => branchBucket.locations.add(location));
          branchBucket.count += 1;
          byBranchPath.set(branchPath, branchBucket);
        }
      });

    return { byActivityId, byBranchPath };
  }, [learnedResetAt, mappingAuditByItem]);

  const resetLearnedPatternMemory = useCallback(() => {
    if (
      !window.confirm(
        "Reset learned smart-mapping memory for this project? Saved mappings will remain, but old mappings will stop influencing future smart suggestions until new mappings are created.",
      )
    ) {
      return;
    }

    const now = Date.now();
    try {
      window.localStorage.setItem(learnedResetKey, String(now));
    } catch (error) {
      console.error("Failed to persist WO mapper learned reset marker", error);
    }
    setLearnedResetAt(now);
  }, [learnedResetKey]);

  useEffect(() => {
    let cancelled = false;
    if (selectedWoItems.length === 0 || activities.length === 0) {
      setQuickSuggestions([]);
      setSuggestionsByItem(new Map());
      setIsSuggestionEngineRunning(false);
      setSuggestionEngineMessage("");
      return;
    }

    setIsSuggestionEngineRunning(true);
    setSuggestionEngineMessage(
      `Analysing ${selectedWoItems.length} WO row(s) against ${activities.length} schedule activities...`,
    );

    const runSuggestionPass = async () => {
      if (selectedWoItems.length > 80) {
        await yieldToMainThread();
      }
      if (cancelled) return;

      const sampledQuickSourceParts = selectedWoItems
        .slice(0, Math.min(selectedWoItems.length, 160))
        .flatMap((item) => [
          item.materialCode,
          item.description,
          item.linkedActivities,
          item.treeContext,
          item.boqPath,
          item.fullContext,
        ]);

      const fastQuickSuggestions = computeActivitySuggestionsFromIndex({
        indexedActivities,
        sourceParts: sampledQuickSourceParts,
        limit: 6,
        learnedPatternIndex,
      });

      if (cancelled) return;

      const nextSuggestionsByItem = new Map<number, ActivitySuggestion[]>();
      const batchSize =
        selectedWoItems.length > 300
          ? 6
          : selectedWoItems.length > 120
            ? 10
            : 16;

      for (let index = 0; index < selectedWoItems.length; index += batchSize) {
        const batch = selectedWoItems.slice(index, index + batchSize);
        batch.forEach((item) => {
          nextSuggestionsByItem.set(
            item.workOrderItemId,
            computeActivitySuggestionsFromIndex({
              indexedActivities,
              sourceParts: [
                item.materialCode,
                item.description,
                item.linkedActivities,
                item.treeContext,
                item.boqPath,
                item.fullContext,
              ],
              limit: 8,
              learnedPatternIndex,
            }),
          );
        });

        if (cancelled) return;

        const processed = Math.min(
          index + batch.length,
          selectedWoItems.length,
        );
        setSuggestionEngineMessage(
          `Analysing ${selectedWoItems.length} WO row(s) against ${activities.length} schedule activities... processed ${processed}/${selectedWoItems.length}.`,
        );

        if (processed < selectedWoItems.length) {
          await yieldToMainThread();
        }
      }

      if (!cancelled) {
        startTransition(() => {
          setQuickSuggestions(fastQuickSuggestions);
          setSuggestionsByItem(nextSuggestionsByItem);
          setIsSuggestionEngineRunning(false);
          setSuggestionEngineMessage("");
        });
      }
    };

    void runSuggestionPass();

    return () => {
      cancelled = true;
    };
  }, [
    activities.length,
    indexedActivities,
    learnedPatternIndex,
    selectedWoItems,
  ]);

  useEffect(() => {
    if (!selectionFeedback.active || !isSuggestionEngineRunning) return;

    const interval = window.setInterval(() => {
      setSelectionFeedback((current) => ({
        ...current,
        progress:
          current.progress >= 88
            ? current.progress
            : Math.min(88, current.progress + 6),
      }));
    }, 140);

    return () => window.clearInterval(interval);
  }, [isSuggestionEngineRunning, selectionFeedback.active]);

  useEffect(() => {
    if (!selectionFeedback.active || isSuggestionEngineRunning) return;

    setSelectionFeedback((current) => ({
      ...current,
      progress: 100,
      message: "Selection ready. Rendering smart suggestions...",
    }));

    const timeout = window.setTimeout(() => {
      setSelectionFeedback({
        active: false,
        message: "",
        progress: 0,
      });
    }, 320);

    return () => window.clearTimeout(timeout);
  }, [isSuggestionEngineRunning, selectionFeedback.active]);

  const branchSuggestions = useMemo<BranchSuggestion[]>(() => {
    if (assistantMode !== "suggestions") {
      return [];
    }
    const branchMap = new Map<
      string,
      { scores: number[]; sampleActivities: Set<string>; itemIds: Set<number> }
    >();

    selectedWoItems.forEach((item) => {
      const suggestions = (
        suggestionsByItem.get(item.workOrderItemId) || []
      ).slice(0, 3);
      suggestions.forEach((suggestion) => {
        const bucket = branchMap.get(suggestion.branchPath) || {
          scores: [],
          sampleActivities: new Set<string>(),
          itemIds: new Set<number>(),
        };
        bucket.scores.push(suggestion.score);
        bucket.itemIds.add(item.workOrderItemId);
        if (bucket.sampleActivities.size < 3) {
          bucket.sampleActivities.add(
            `${suggestion.activity.activityCode} ${suggestion.activity.activityName}`,
          );
        }
        branchMap.set(suggestion.branchPath, bucket);
      });
    });

    return Array.from(branchMap.entries())
      .map(([branchPath, bucket]) => ({
        branchPath,
        matchedItems: bucket.itemIds.size,
        avgScore:
          bucket.scores.reduce((sum, score) => sum + score, 0) /
          Math.max(1, bucket.scores.length),
        sampleActivities: Array.from(bucket.sampleActivities),
      }))
      .sort((left, right) => {
        if (right.matchedItems !== left.matchedItems) {
          return right.matchedItems - left.matchedItems;
        }
        return right.avgScore - left.avgScore;
      })
      .slice(0, 6);
  }, [assistantMode, selectedWoItems, suggestionsByItem]);

  const activeWorkbenchItem = useMemo(() => {
    if (assistantMode !== "workbench" || selectedWoItems.length === 0)
      return null;
    if (selectedWoItems.length === 0) return null;
    return (
      selectedWoItems.find(
        (item) => item.workOrderItemId === activeWorkbenchItemId,
      ) || selectedWoItems[0]
    );
  }, [activeWorkbenchItemId, assistantMode, selectedWoItems]);

  const activeWorkbenchSuggestions = useMemo(() => {
    if (assistantMode !== "workbench" || !activeWorkbenchItem) return [];
    return suggestionsByItem.get(activeWorkbenchItem.workOrderItemId) || [];
  }, [activeWorkbenchItem, assistantMode, suggestionsByItem]);

  const bulkReviewRows = useMemo<ReviewRow[]>(() => {
    if (assistantMode !== "review") {
      return [];
    }
    return selectedWoItems.map((item) => {
      const suggestions = (
        suggestionsByItem.get(item.workOrderItemId) || []
      ).slice(0, 3);
      const savedMappings = mappingAuditByItem[item.workOrderItemId] || [];
      const currentMappings = savedMappings.map((entry) => {
        const activity = activityById.get(entry.activityId);
        return {
          ...entry,
          treePath:
            entry.treePath ||
            (activity
              ? wbsPathById.get(activity.wbsNode?.id || activity.wbsNodeId)
              : ""),
        };
      });
      const savedActivityId = savedMappings[0]?.activityId || null;
      const selectedActivityId =
        bulkReviewSelections[item.workOrderItemId] ??
        (savedActivityId &&
        suggestions.some((entry) => entry.activity.id === savedActivityId)
          ? savedActivityId
          : suggestions[0]?.activity.id) ??
        null;

      const topConfidence = suggestions[0]?.confidence || "LOW";
      const status =
        reviewStatuses[item.workOrderItemId] ||
        (savedMappings.length > 0
          ? "SKIPPED"
          : topConfidence === "HIGH"
            ? "APPROVED"
            : "NEEDS_REVIEW");

      return {
        item,
        suggestions,
        selectedActivityId,
        status,
        overrideReason: reviewOverrideReasons[item.workOrderItemId] || "",
        currentMappings,
        topConfidence,
      };
    });
  }, [
    assistantMode,
    activityById,
    bulkReviewSelections,
    mappingAuditByItem,
    reviewOverrideReasons,
    reviewStatuses,
    selectedWoItems,
    suggestionsByItem,
    wbsPathById,
  ]);

  const filteredReviewRows = useMemo(() => {
    if (assistantMode !== "review") {
      return [];
    }
    return bulkReviewRows.filter((row) => {
      const confidenceOk =
        reviewConfidenceFilter === "ALL" ||
        row.topConfidence === reviewConfidenceFilter;
      const statusOk =
        reviewStatusFilter === "ALL" || row.status === reviewStatusFilter;
      return confidenceOk && statusOk;
    });
  }, [
    assistantMode,
    bulkReviewRows,
    reviewConfidenceFilter,
    reviewStatusFilter,
  ]);

  const activeReviewRow = useMemo(
    () =>
      filteredReviewRows.find(
        (row) => row.item.workOrderItemId === activeReviewRowId,
      ) ||
      filteredReviewRows[0] ||
      null,
    [activeReviewRowId, filteredReviewRows],
  );

  useEffect(() => {
    if (!selectedWoItems.length) {
      setActiveWorkbenchItemId(null);
      return;
    }
    setActiveWorkbenchItemId((current) =>
      current &&
      selectedWoItems.some((item) => item.workOrderItemId === current)
        ? current
        : selectedWoItems[0].workOrderItemId,
    );
  }, [selectedWoItems]);

  useEffect(() => {
    if (!filteredReviewRows.length) {
      setActiveReviewRowId(null);
      return;
    }
    setActiveReviewRowId((current) =>
      current &&
      filteredReviewRows.some((row) => row.item.workOrderItemId === current)
        ? current
        : filteredReviewRows[0].item.workOrderItemId,
    );
  }, [filteredReviewRows]);

  useEffect(() => {
    setBulkReviewSelections((current) => {
      const next: Record<number, number> = {};
      let changed = false;

      selectedWoItems.forEach((item) => {
        const suggestions = (
          suggestionsByItem.get(item.workOrderItemId) || []
        ).slice(0, 3);
        const currentSelection = current[item.workOrderItemId];
        const validSelection =
          currentSelection &&
          suggestions.some((entry) => entry.activity.id === currentSelection)
            ? currentSelection
            : suggestions[0]?.activity.id;

        if (validSelection) {
          next[item.workOrderItemId] = validSelection;
        }

        if (currentSelection !== validSelection) {
          changed = true;
        }
      });

      if (
        !changed &&
        Object.keys(current).length === Object.keys(next).length
      ) {
        return current;
      }

      return next;
    });
  }, [selectedWoItems, suggestionsByItem]);

  useEffect(() => {
    if (!numericProjectId) return;
    void fetchActivities();
    void fetchVendorTree();
    void fetchWbsNodes();
    void fetchMappingAudit();
  }, [numericProjectId, refreshTrigger]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        assistantMode !== "review" ||
        filteredReviewRows.length === 0 ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const activeIndex = filteredReviewRows.findIndex(
        (row) =>
          row.item.workOrderItemId === activeReviewRow?.item.workOrderItemId,
      );
      const currentRow =
        activeReviewRow || filteredReviewRows[Math.max(0, activeIndex)];
      if (!currentRow) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const nextRow =
          filteredReviewRows[
            Math.min(
              filteredReviewRows.length - 1,
              Math.max(activeIndex, 0) + 1,
            )
          ];
        setActiveReviewRowId(nextRow.item.workOrderItemId);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const nextRow =
          filteredReviewRows[Math.max(0, Math.max(activeIndex, 0) - 1)];
        setActiveReviewRowId(nextRow.item.workOrderItemId);
        return;
      }

      if (["1", "2", "3"].includes(event.key)) {
        event.preventDefault();
        const index = Number(event.key) - 1;
        const suggestion = currentRow.suggestions[index];
        if (suggestion) {
          setBulkReviewSelections((existing) => ({
            ...existing,
            [currentRow.item.workOrderItemId]: suggestion.activity.id,
          }));
        }
        return;
      }

      if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        setReviewStatuses((existing) => ({
          ...existing,
          [currentRow.item.workOrderItemId]: "APPROVED",
        }));
        return;
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setReviewStatuses((existing) => ({
          ...existing,
          [currentRow.item.workOrderItemId]: "NEEDS_REVIEW",
        }));
        return;
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        setReviewStatuses((existing) => ({
          ...existing,
          [currentRow.item.workOrderItemId]: "SKIPPED",
        }));
        return;
      }

      if (event.key.toLowerCase() === "x") {
        event.preventDefault();
        setReviewStatuses((existing) => ({
          ...existing,
          [currentRow.item.workOrderItemId]: "REJECTED",
        }));
        return;
      }

      if (event.key === "Enter" && currentRow.selectedActivityId) {
        event.preventDefault();
        if (currentRow.status === "APPROVED") {
          void applyBulkReviewRow(
            currentRow.item.workOrderItemId,
            currentRow.selectedActivityId,
          );
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeReviewRow, assistantMode, filteredReviewRows]);

  const fetchVendorTree = async () => {
    try {
      const res = await api.get(`/workdoc/mapper/wo-items/${numericProjectId}`);
      setVendorTree(res.data);
    } catch (error) {
      console.error("Failed to fetch WO items tree", error);
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await api.get(`/projects/${numericProjectId}/wbs/activities`);
      setActivities(res.data);
    } catch (error) {
      console.error("Failed to fetch activities", error);
    }
  };

  const fetchWbsNodes = async () => {
    try {
      const res = await api.get(`/projects/${numericProjectId}/wbs`);
      setWbsNodes(res.data || []);
    } catch (error) {
      console.error("Failed to fetch WBS nodes", error);
    }
  };

  const fetchMappingAudit = async () => {
    try {
      const res = await api.get(
        `/planning/${numericProjectId}/wo-mapper/mappings`,
      );
      const grouped = (res.data || []).reduce(
        (
          acc: Record<number, MappingAuditEntry[]>,
          entry: MappingAuditEntry,
        ) => {
          const bucket = acc[entry.workOrderItemId] || [];
          bucket.push(entry);
          acc[entry.workOrderItemId] = bucket;
          return acc;
        },
        {},
      );
      setMappingAuditByItem(grouped);
    } catch (error) {
      console.error("Failed to fetch WO mapper audit", error);
      setMappingAuditByItem({});
    }
  };

  const updateVendorTreeMappingState = useCallback(
    (workOrderItemIds: number[], activityLabel: string) => {
      const targetIds = new Set(workOrderItemIds);

      setVendorTree((currentTree) =>
        (currentTree || []).map((vendor: any) => ({
          ...vendor,
          workOrders: (vendor.workOrders || []).map((wo: any) => ({
            ...wo,
            boqItems: (wo.boqItems || []).map((boq: any) => ({
              ...boq,
              directWoItems: (boq.directWoItems || []).map((direct: any) =>
                targetIds.has(direct.workOrderItemId)
                  ? {
                      ...direct,
                      mappingStatus: "MAPPED",
                      linkedActivities: activityLabel,
                    }
                  : direct,
              ),
              subItems: (boq.subItems || []).map((sub: any) => ({
                ...sub,
                woItem:
                  sub.woItem && targetIds.has(sub.woItem.workOrderItemId)
                    ? {
                        ...sub.woItem,
                        mappingStatus: "MAPPED",
                        linkedActivities: activityLabel,
                      }
                    : sub.woItem,
                measurements: (sub.measurements || []).map(
                  (measurement: any) =>
                    targetIds.has(measurement.workOrderItemId)
                      ? {
                          ...measurement,
                          mappingStatus: "MAPPED",
                          linkedActivities: activityLabel,
                        }
                      : measurement,
                ),
              })),
            })),
          })),
        })),
      );
    },
    [],
  );

  const updateLocalMappingAudit = useCallback(
    (
      workOrderItemIds: number[],
      targetActivityId: number,
      mappingType = "DIRECT",
      mappingRulesByItem?: Record<number, Record<string, unknown>>,
    ) => {
      const activity = activityById.get(targetActivityId);
      const activityCode = activity?.activityCode || "";
      const activityName = activity?.activityName || "";
      const treePath = activity
        ? wbsPathById.get(activity.wbsNode?.id || activity.wbsNodeId)
        : "";
      const timestamp = new Date().toISOString();

      setMappingAuditByItem((current) => {
        const next = { ...current };
        workOrderItemIds.forEach((workOrderItemId) => {
          next[workOrderItemId] = [
            {
              id: Number(`${workOrderItemId}${targetActivityId}`),
              workOrderItemId,
              activityId: targetActivityId,
              activityCode,
              activityName,
              plannedQuantity: -1,
              mappingType,
              mappingRules: mappingRulesByItem?.[workOrderItemId] || null,
              createdBy: "Current User",
              createdOn: timestamp,
              updatedOn: timestamp,
              treePath,
            },
          ];
        });
        return next;
      });
    },
    [activityById, wbsPathById],
  );

  const buildDirectMappingRulesByItem = useCallback(
    (
      workOrderItemIds: number[],
      targetActivityId: number,
    ): Record<number, Record<string, unknown>> => {
      const activity = activityById.get(targetActivityId);
      const treePath = activity
        ? wbsPathById.get(activity.wbsNode?.id || activity.wbsNodeId)
        : "";
      const branchPath = treePath ? deriveBranchPath(treePath) : null;
      const rulesByItem: Record<number, Record<string, unknown>> = {};

      workOrderItemIds.forEach((id) => {
        const item = woItemLookup.get(id);
        if (!item) return;

        rulesByItem[id] = {
          reviewStatus: "MANUAL",
          overrideReason: null,
          confidence: "MANUAL",
          suggestionScore: null,
          branchPath,
          matchedLocationPhrases: extractLocationPhrases(
            [item.boqPath, item.treeContext, item.fullContext]
              .filter(Boolean)
              .join(" > "),
          ),
          matchedSegments: [],
          isManualOverride: false,
          boqPath: item.boqPath || null,
          woPath: item.treeContext || null,
          fullContext: item.fullContext || null,
          locationKey: item.locationKey || null,
          activityTreePath: treePath || null,
          mappingMode: "MANUAL_DIRECT",
        };
      });

      return rulesByItem;
    },
    [activityById, wbsPathById, woItemLookup],
  );

  const handleLinkItems = useCallback(
    async (
      workOrderItemIds: number[],
      targetActivityId: number,
      options?: {
        closeModal?: boolean;
        clearSelection?: boolean;
        refresh?: boolean;
        showSuccess?: boolean;
        mappingRulesByItem?: Record<number, Record<string, unknown>>;
      },
    ) => {
      if (workOrderItemIds.length === 0 || !targetActivityId) return;

      const {
        closeModal = true,
        clearSelection = true,
        refresh = false,
        showSuccess = true,
        mappingRulesByItem: providedMappingRulesByItem,
      } = options || {};

      try {
        const activity = activityById.get(targetActivityId);
        const activityLabel = [activity?.activityCode, activity?.activityName]
          .filter(Boolean)
          .join(" ");
        const mappingRulesByItem =
          providedMappingRulesByItem ||
          buildDirectMappingRulesByItem(workOrderItemIds, targetActivityId);

        setMappingInFlight({
          active: true,
          processed: 0,
          total: workOrderItemIds.length,
          message:
            workOrderItemIds.length > 1
              ? `Mapping ${workOrderItemIds.length} WO rows to ${activityLabel || "the selected activity"}...`
              : `Mapping selected WO row to ${activityLabel || "the selected activity"}...`,
        });

        for (let index = 0; index < workOrderItemIds.length; index += 1) {
          const woItemId = workOrderItemIds[index];
          await api.post(`/planning/distribute-wo`, {
            projectId: numericProjectId,
            activityId: targetActivityId,
            workOrderItemId: woItemId,
            quantity: -1,
            mappingType: "DIRECT",
            mappingRules: mappingRulesByItem?.[woItemId] || null,
          });

          setMappingInFlight((current) => ({
            ...current,
            processed: index + 1,
          }));

          if (index < workOrderItemIds.length - 1) {
            await yieldToMainThread();
          }
        }

        updateVendorTreeMappingState(workOrderItemIds, activityLabel);
        updateLocalMappingAudit(
          workOrderItemIds,
          targetActivityId,
          "DIRECT",
          mappingRulesByItem,
        );

        if (closeModal) {
          setIsLinkModalOpen(false);
        }
        if (clearSelection) {
          setSelectedWoItemIds((current) =>
            current.filter((id) => !workOrderItemIds.includes(id)),
          );
        }
        if (refresh) {
          setRefreshTrigger((prev) => prev + 1);
        }
        if (showSuccess) {
          alert("Successfully linked to schedule!");
        }
      } catch (error) {
        console.error("Linking failed", error);
        alert("Linking failed. See console for details.");
      } finally {
        setMappingInFlight({
          active: false,
          processed: 0,
          total: 0,
          message: "",
        });
      }
    },
    [
      activityById,
      buildDirectMappingRulesByItem,
      numericProjectId,
      updateLocalMappingAudit,
      updateVendorTreeMappingState,
    ],
  );

  const handleLink = async (targetActivityId: number) => {
    await handleLinkItems(selectedWoItemIds, targetActivityId);
  };

  const handleSelectionChange = (nextIds: number[]) => {
    const delta = Math.abs(nextIds.length - selectedWoItemIds.length);
    const shouldShowProgress = delta > 8 || nextIds.length > 40;

    if (shouldShowProgress) {
      setSelectionFeedback({
        active: true,
        progress: 12,
        message:
          delta > 1
            ? `Preparing ${delta} selected child row(s) and building hierarchy-aware suggestions...`
            : "Preparing selection and building smart suggestions...",
      });

      window.requestAnimationFrame(() => {
        startTransition(() => {
          setSelectedWoItemIds(nextIds);
        });
      });
      return;
    }

    setSelectedWoItemIds(nextIds);
  };

  const setBulkReviewSelection = (
    workOrderItemId: number,
    activityId: number,
  ) => {
    setBulkReviewSelections((current) => ({
      ...current,
      [workOrderItemId]: activityId,
    }));
  };

  const setReviewStatus = (workOrderItemId: number, status: ReviewStatus) => {
    setReviewStatuses((current) => ({
      ...current,
      [workOrderItemId]: status,
    }));
  };

  const setReviewOverrideReason = (workOrderItemId: number, value: string) => {
    setReviewOverrideReasons((current) => ({
      ...current,
      [workOrderItemId]: value,
    }));
  };

  const toggleReviewRowSelection = (workOrderItemId: number) => {
    setReviewSelectedItemIds((current) =>
      current.includes(workOrderItemId)
        ? current.filter((id) => id !== workOrderItemId)
        : [...current, workOrderItemId],
    );
  };

  const selectAllVisibleReviewRows = () => {
    setReviewSelectedItemIds(
      Array.from(
        new Set(filteredReviewRows.map((row) => row.item.workOrderItemId)),
      ),
    );
  };

  const clearReviewRowSelection = () => {
    setReviewSelectedItemIds([]);
  };

  const approveTopMatchForHighConfidence = () => {
    setReviewStatuses((current) => {
      const next = { ...current };
      bulkReviewRows.forEach((row) => {
        if (row.topConfidence === "HIGH" && row.suggestions[0]) {
          next[row.item.workOrderItemId] = "APPROVED";
        }
      });
      return next;
    });

    setBulkReviewSelections((current) => {
      const next = { ...current };
      bulkReviewRows.forEach((row) => {
        if (row.topConfidence === "HIGH" && row.suggestions[0]) {
          next[row.item.workOrderItemId] = row.suggestions[0].activity.id;
        }
      });
      return next;
    });
  };

  const markLowConfidenceNeedsReview = () => {
    setReviewStatuses((current) => {
      const next = { ...current };
      bulkReviewRows.forEach((row) => {
        if (row.topConfidence === "LOW") {
          next[row.item.workOrderItemId] = "NEEDS_REVIEW";
        }
      });
      return next;
    });
  };

  const applyBranchSuggestion = (branchPath: string) => {
    setBulkReviewSelections((current) => {
      const next = { ...current };
      filteredReviewRows.forEach((row) => {
        const branchMatch = row.suggestions.find(
          (suggestion) => suggestion.branchPath === branchPath,
        );
        if (branchMatch) {
          next[row.item.workOrderItemId] = branchMatch.activity.id;
        }
      });
      return next;
    });

    setReviewStatuses((current) => {
      const next = { ...current };
      filteredReviewRows.forEach((row) => {
        const branchMatch = row.suggestions.find(
          (suggestion) => suggestion.branchPath === branchPath,
        );
        if (branchMatch) {
          next[row.item.workOrderItemId] = "APPROVED";
        }
      });
      return next;
    });
  };

  const copyActiveBranchToSelectedRows = () => {
    if (!activeReviewRow || reviewSelectedItemIds.length === 0) {
      alert(
        "Select review rows first, then keep one active row to copy its branch.",
      );
      return;
    }

    const selectedSuggestion =
      activeReviewRow.suggestions.find(
        (suggestion) =>
          suggestion.activity.id === activeReviewRow.selectedActivityId,
      ) || activeReviewRow.suggestions[0];

    if (!selectedSuggestion) {
      alert("The active row does not have a selected candidate to copy.");
      return;
    }

    setBulkReviewSelections((current) => {
      const next = { ...current };
      bulkReviewRows.forEach((row) => {
        if (!reviewSelectedItemIds.includes(row.item.workOrderItemId)) return;
        const branchMatch =
          row.suggestions.find(
            (suggestion) =>
              suggestion.branchPath === selectedSuggestion.branchPath,
          ) || row.suggestions[0];
        if (branchMatch) {
          next[row.item.workOrderItemId] = branchMatch.activity.id;
        }
      });
      return next;
    });

    setReviewStatuses((current) => {
      const next = { ...current };
      reviewSelectedItemIds.forEach((itemId) => {
        next[itemId] = "APPROVED";
      });
      return next;
    });
  };

  const buildRowMappingRules = (row: ReviewRow, activityId: number) => {
    const selectedSuggestion =
      row.suggestions.find(
        (suggestion) => suggestion.activity.id === activityId,
      ) || row.suggestions[0];
    const isManualOverride =
      selectedSuggestion &&
      row.suggestions[0] &&
      selectedSuggestion.activity.id !== row.suggestions[0].activity.id;

    return {
      reviewStatus: row.status,
      overrideReason: row.overrideReason || null,
      confidence: selectedSuggestion?.confidence || row.topConfidence,
      suggestionScore: selectedSuggestion?.score || null,
      branchPath: selectedSuggestion?.branchPath || null,
      matchedLocationPhrases: selectedSuggestion?.matches.locationMatches || [],
      matchedSegments: selectedSuggestion?.matches.segmentMatches || [],
      isManualOverride,
      boqPath: row.item.boqPath || null,
      woPath: row.item.treeContext || null,
    };
  };

  const validateReviewRow = (row: ReviewRow, activityId: number) => {
    const topSuggestion = row.suggestions[0];
    if (row.status !== "APPROVED") {
      return `Row "${row.item.description}" is not approved.`;
    }

    if (!activityId) {
      return `Row "${row.item.description}" does not have a selected target activity.`;
    }

    if (
      topSuggestion &&
      activityId !== topSuggestion.activity.id &&
      !row.overrideReason.trim()
    ) {
      return `Row "${row.item.description}" needs an override reason because it is not using the top suggested match.`;
    }

    return null;
  };

  const applyBulkReviewRow = async (
    workOrderItemId: number,
    activityId: number,
  ) => {
    const row = bulkReviewRows.find(
      (entry) => entry.item.workOrderItemId === workOrderItemId,
    );
    if (!row) return;

    const validation = validateReviewRow(row, activityId);
    if (validation) {
      alert(validation);
      return;
    }

    await handleLinkItems([workOrderItemId], activityId, {
      closeModal: false,
      clearSelection: true,
      refresh: true,
      showSuccess: false,
      mappingRulesByItem: {
        [workOrderItemId]: buildRowMappingRules(row, activityId),
      },
    });
  };

  const applyBulkReviewAll = async () => {
    const rowsToApply = bulkReviewRows.filter(
      (row) => row.status === "APPROVED" && row.selectedActivityId,
    );
    if (rowsToApply.length === 0) {
      alert("No approved review rows are ready to apply.");
      return;
    }

    const validationError = rowsToApply
      .map((row) => validateReviewRow(row, row.selectedActivityId as number))
      .find(Boolean);
    if (validationError) {
      alert(validationError);
      return;
    }

    try {
      for (const row of rowsToApply) {
        await handleLinkItems(
          [row.item.workOrderItemId],
          row.selectedActivityId as number,
          {
            closeModal: false,
            clearSelection: true,
            refresh: false,
            showSuccess: false,
            mappingRulesByItem: {
              [row.item.workOrderItemId]: buildRowMappingRules(
                row,
                row.selectedActivityId as number,
              ),
            },
          },
        );
      }
      setRefreshTrigger((prev) => prev + 1);
      alert(`Applied ${rowsToApply.length} reviewed mappings successfully.`);
    } catch (error) {
      console.error("Bulk review apply failed", error);
      alert("Bulk review apply failed.");
    }
  };

  const handleUnlink = async () => {
    if (selectedWoItemIds.length === 0) return;
    if (!confirm("Are you sure you want to unlink the selected items?")) return;

    try {
      for (const woItemId of selectedWoItemIds) {
        await api.post(`/planning/unlink-wo`, {
          projectId: numericProjectId,
          workOrderItemId: woItemId,
        });
      }
      setSelectedWoItemIds([]);
      setRefreshTrigger((prev) => prev + 1);
      alert("Successfully unlinked!");
    } catch (error) {
      console.error("Unlink failed", error);
      alert("Unlink failed.");
    }
  };

  const handleDownloadMatrixSheet = async () => {
    if (!numericProjectId) return;
    setDownloadingSheet(true);
    try {
      const response = await api.get(
        `/planning/${numericProjectId}/wo-mapper/export`,
        {
          responseType: "blob",
        },
      );
      downloadBlob(
        new Blob([response.data]),
        withFileExtension(`wo_qty_mapper_${numericProjectId}_matrix`, ".xlsx"),
      );
    } catch (error) {
      console.error("Failed to download WO link sheet", error);
      alert("Failed to download WO link sheet.");
    } finally {
      setDownloadingSheet(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-surface-base">
      <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b bg-surface-card px-4 shadow-sm">
        <div className="flex items-center gap-2 text-text-secondary">
          <Split className="text-primary" size={20} />
          <h1 className="font-bold text-lg">WO Qty Mapper</h1>
          <span className="rounded-full bg-info-muted px-2 py-0.5 text-xs font-medium text-blue-800">
            Project #{numericProjectId}
          </span>
          <span className="text-xs text-text-muted">
            Confidence review, branch mapping, override audit, and fast keyboard
            flow are active.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadMatrixSheet}
            disabled={downloadingSheet}
            className="flex items-center gap-2 rounded border border-border-strong bg-surface-card px-3 py-2 text-sm font-medium text-text-secondary shadow-sm transition-colors hover:bg-surface-base disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloadingSheet ? (
              <Loader size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Download Matrix Link Sheet
          </button>

          <button
            type="button"
            onClick={() => setIsBulkImportOpen(true)}
            className="flex items-center gap-2 rounded border border-blue-200 bg-info-muted px-3 py-2 text-sm font-medium text-blue-700 shadow-sm transition-colors hover:bg-blue-100"
          >
            <FileUp size={16} />
            Import Filled Link Sheet
          </button>

          <span className="mr-2 text-sm text-text-muted">
            {selectedWoItemIds.length} items selected
          </span>

          <button
            onClick={() => void handleUnlink()}
            disabled={selectedWoItemIds.length === 0}
            className={`rounded border px-3 py-2 text-sm font-medium shadow-sm transition-colors ${
              selectedWoItemIds.length > 0
                ? "border-red-200 bg-surface-card text-error hover:bg-error-muted"
                : "cursor-not-allowed border-border-default bg-surface-raised text-text-disabled"
            }`}
          >
            Unlink
          </button>

          <button
            onClick={() => setIsLinkModalOpen(true)}
            disabled={selectedWoItemIds.length === 0}
            className={`flex items-center gap-2 rounded px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
              selectedWoItemIds.length > 0
                ? "bg-green-600 text-white hover:bg-green-700"
                : "cursor-not-allowed bg-gray-200 text-text-disabled"
            }`}
          >
            <LinkIcon size={16} />
            Link to Schedule
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden p-4">
        {mappingInFlight.active && (
          <div className="absolute inset-0 z-[66] flex items-center justify-center bg-slate-950/26 backdrop-blur-[1px]">
            <div className="w-[min(460px,88vw)] rounded-2xl border border-emerald-200 bg-white p-5 shadow-2xl">
              <div className="flex items-center gap-3">
                <Loader className="h-5 w-5 animate-spin text-emerald-600" />
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    Saving WO Mapping
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {mappingInFlight.message}
                  </div>
                </div>
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-[width] duration-150"
                  style={{
                    width: `${
                      mappingInFlight.total > 0
                        ? Math.max(
                            12,
                            Math.round(
                              (mappingInFlight.processed /
                                mappingInFlight.total) *
                                100,
                            ),
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Updating the current mapping and preparing the next row
                </span>
                <span>
                  {mappingInFlight.processed}/{mappingInFlight.total}
                </span>
              </div>
            </div>
          </div>
        )}

        {selectionFeedback.active && (
          <div className="absolute inset-0 z-[65] flex items-center justify-center bg-slate-950/30 backdrop-blur-[1px]">
            <div className="w-[min(520px,92vw)] rounded-2xl border border-blue-200 bg-white p-5 shadow-2xl">
              <div className="flex items-center gap-3">
                <Loader className="h-5 w-5 animate-spin text-blue-600" />
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    Preparing WO Mapper Selection
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {selectionFeedback.message}
                  </div>
                </div>
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-[width] duration-150"
                  style={{ width: `${selectionFeedback.progress}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>Large parent selection can take a moment</span>
                <span>{selectionFeedback.progress}%</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid h-full min-h-0 grid-cols-[minmax(0,1.8fr)_380px] gap-4">
          <div className="h-full overflow-hidden rounded-lg border bg-surface-card shadow">
            <BoqGridPanel
              vendorTree={vendorTree}
              selectedWoItemIds={selectedWoItemIds}
              onSelectionChange={handleSelectionChange}
            />
          </div>

          <MapperAssistantPanel
            selectedWoItems={selectedWoItems}
            isSuggestionEngineRunning={isSuggestionEngineRunning}
            suggestionEngineMessage={suggestionEngineMessage}
            assistantMode={assistantMode}
            setAssistantMode={setAssistantMode}
            quickSuggestions={quickSuggestions}
            branchSuggestions={branchSuggestions}
            activeWorkbenchItem={activeWorkbenchItem}
            activeWorkbenchSuggestions={activeWorkbenchSuggestions}
            bulkReviewRows={bulkReviewRows}
            filteredReviewRows={filteredReviewRows}
            activeReviewRow={activeReviewRow}
            reviewSelectedItemIds={reviewSelectedItemIds}
            reviewStatusFilter={reviewStatusFilter}
            reviewConfidenceFilter={reviewConfidenceFilter}
            setReviewStatusFilter={setReviewStatusFilter}
            setReviewConfidenceFilter={setReviewConfidenceFilter}
            setBulkReviewSelection={setBulkReviewSelection}
            setReviewStatus={setReviewStatus}
            setReviewOverrideReason={setReviewOverrideReason}
            toggleReviewRowSelection={toggleReviewRowSelection}
            setActiveReviewRowId={setActiveReviewRowId}
            selectAllVisibleReviewRows={selectAllVisibleReviewRows}
            clearReviewRowSelection={clearReviewRowSelection}
            approveTopMatchForHighConfidence={approveTopMatchForHighConfidence}
            markLowConfidenceNeedsReview={markLowConfidenceNeedsReview}
            applyBranchSuggestion={applyBranchSuggestion}
            copyActiveBranchToSelectedRows={copyActiveBranchToSelectedRows}
            applyBulkReviewRow={applyBulkReviewRow}
            applyBulkReviewAll={applyBulkReviewAll}
            setActiveWorkbenchItemId={setActiveWorkbenchItemId}
            handleLink={handleLink}
            handleLinkItems={handleLinkItems}
            openFullTreeValidation={() => setIsLinkModalOpen(true)}
            openFullscreen={() => setIsAssistantFullscreenOpen(true)}
            learnedActivityPatternCount={learnedPatternIndex.byActivityId.size}
            learnedBranchPatternCount={learnedPatternIndex.byBranchPath.size}
            learnedResetAt={learnedResetAt}
            resetLearnedPatternMemory={resetLearnedPatternMemory}
          />
        </div>

        {isAssistantFullscreenOpen && (
          <div className="fixed inset-0 z-[70] bg-black/55 p-4 backdrop-blur-sm">
            <div className="flex h-full w-full flex-col rounded-2xl border border-border-default bg-surface-card shadow-2xl">
              <div className="flex items-center justify-between border-b bg-surface-base px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    WO Qty Mapping Assistant
                  </h2>
                  <p className="text-sm text-text-muted">
                    Full-screen review board for heavy BOQ-to-schedule mapping
                    with confidence, branch lanes, and audit metadata.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAssistantFullscreenOpen(false)}
                  className="rounded-full p-2 text-text-muted hover:bg-surface-card"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="min-h-0 flex-1 p-4">
                <MapperAssistantPanel
                  fullscreen
                  selectedWoItems={selectedWoItems}
                  isSuggestionEngineRunning={isSuggestionEngineRunning}
                  suggestionEngineMessage={suggestionEngineMessage}
                  assistantMode={assistantMode}
                  setAssistantMode={setAssistantMode}
                  quickSuggestions={quickSuggestions}
                  branchSuggestions={branchSuggestions}
                  activeWorkbenchItem={activeWorkbenchItem}
                  activeWorkbenchSuggestions={activeWorkbenchSuggestions}
                  bulkReviewRows={bulkReviewRows}
                  filteredReviewRows={filteredReviewRows}
                  activeReviewRow={activeReviewRow}
                  reviewSelectedItemIds={reviewSelectedItemIds}
                  reviewStatusFilter={reviewStatusFilter}
                  reviewConfidenceFilter={reviewConfidenceFilter}
                  setReviewStatusFilter={setReviewStatusFilter}
                  setReviewConfidenceFilter={setReviewConfidenceFilter}
                  setBulkReviewSelection={setBulkReviewSelection}
                  setReviewStatus={setReviewStatus}
                  setReviewOverrideReason={setReviewOverrideReason}
                  toggleReviewRowSelection={toggleReviewRowSelection}
                  setActiveReviewRowId={setActiveReviewRowId}
                  selectAllVisibleReviewRows={selectAllVisibleReviewRows}
                  clearReviewRowSelection={clearReviewRowSelection}
                  approveTopMatchForHighConfidence={
                    approveTopMatchForHighConfidence
                  }
                  markLowConfidenceNeedsReview={markLowConfidenceNeedsReview}
                  applyBranchSuggestion={applyBranchSuggestion}
                  copyActiveBranchToSelectedRows={
                    copyActiveBranchToSelectedRows
                  }
                  applyBulkReviewRow={applyBulkReviewRow}
                  applyBulkReviewAll={applyBulkReviewAll}
                  setActiveWorkbenchItemId={setActiveWorkbenchItemId}
                  handleLink={handleLink}
                  handleLinkItems={handleLinkItems}
                  openFullTreeValidation={() => setIsLinkModalOpen(true)}
                  closeFullscreen={() => setIsAssistantFullscreenOpen(false)}
                  learnedActivityPatternCount={
                    learnedPatternIndex.byActivityId.size
                  }
                  learnedBranchPatternCount={
                    learnedPatternIndex.byBranchPath.size
                  }
                  learnedResetAt={learnedResetAt}
                  resetLearnedPatternMemory={resetLearnedPatternMemory}
                />
              </div>
            </div>
          </div>
        )}

        <ActivityPickerModal
          isOpen={isLinkModalOpen}
          onClose={() => setIsLinkModalOpen(false)}
          onConfirm={handleLink}
          activities={activities}
          projectId={numericProjectId}
          selectedWoItems={selectedWoItems}
        />

        <WoBulkMappingImportWizard
          isOpen={isBulkImportOpen}
          onClose={() => setIsBulkImportOpen(false)}
          projectId={numericProjectId}
          onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
        />
      </div>
    </div>
  );
};

export default ExecutionMapper;
