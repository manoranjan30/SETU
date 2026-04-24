import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Grid2X2,
  Hammer,
  Home,
  ImagePlus,
  Layers,
  ListChecks,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useParams } from "react-router-dom";
import api from "../../api/axios";
import { getPublicFileUrl } from "../../api/baseUrl";
import { PermissionCode } from "../../config/permissions";
import { useAuth } from "../../context/AuthContext";
import {
  snagService,
  type SnagApproval,
  type SnagChecklistItem,
  type SnagChecklistStatus,
  type SnagItemDetail,
  type SnagListDetail,
  type SnagRoundDetail,
  type SnagUnitSummary,
} from "../../services/snag.service";

type ExplorerFloor = {
  key: string;
  label: string;
  units: SnagUnitSummary[];
};

type ExplorerTower = {
  key: string;
  label: string;
  floors: ExplorerFloor[];
};

type ExplorerBlock = {
  key: string;
  label: string;
  towers: ExplorerTower[];
};

type EvidenceMode = "RECTIFY" | "CLOSE";

type EvidenceDialogState = {
  mode: EvidenceMode;
  itemIds: number[];
  title: string;
};

type SkipDialogState = {
  roundId: number;
  currentLabel: string;
  currentDesnagLabel: string;
  nextLabel: string;
};

type ResetRoundDialogState = {
  roundId: number;
  currentLabel: string;
  currentDesnagLabel: string;
  laterCycleCount: number;
  rollsBackHandover: boolean;
};

type DeleteItemDialogState = {
  itemId: number;
  defectTitle: string;
};

type SnagFormState = {
  qualityRoomId: number | "";
  defectTitle: string;
  defectDescription: string;
  trade: string;
  priority: string;
  beforeFiles: FileList | null;
  linkedChecklistItemId: string | null;
};

const STATUS_ORDER: Record<string, number> = {
  open: 0,
  on_hold: 1,
  rectified: 2,
  closed: 3,
};

const DEFAULT_SNAG_FORM: SnagFormState = {
  qualityRoomId: "",
  defectTitle: "",
  defectDescription: "",
  trade: "",
  priority: "medium",
  beforeFiles: null,
  linkedChecklistItemId: null,
};

const CHECKLIST_STATUSES: SnagChecklistStatus[] = [
  "IDENTIFIED",
  "RECTIFIED",
  "NA",
];

const MAX_SNAG_CYCLES = 3;

function naturalSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function getFileUrl(path: string) {
  return getPublicFileUrl(path);
}

function getSnagCycleLabel(roundNumber: number) {
  return `Snag ${roundNumber}`;
}

function getDesnagCycleLabel(roundNumber: number) {
  return `De-snag ${roundNumber}`;
}

function getNextSnagCycleLabel(roundNumber: number) {
  return roundNumber >= MAX_SNAG_CYCLES
    ? "Handover"
    : getSnagCycleLabel(roundNumber + 1);
}

function getWorkflowStatusLabel(status: string, currentRound: number) {
  switch (status) {
    case "snagging":
      return `${getSnagCycleLabel(currentRound)} open`;
    case "desnagging":
      return `${getDesnagCycleLabel(currentRound)} active`;
    case "released":
      return `Released to ${getSnagCycleLabel(currentRound)}`;
    case "handover_ready":
      return "Released to Handover";
    default:
      return status.replace(/_/g, " ");
  }
}

function getSubmitSnagActionLabel(roundNumber: number) {
  return `Submit ${getSnagCycleLabel(roundNumber)} to start ${getDesnagCycleLabel(
    roundNumber,
  )}`;
}

function getReleaseActionLabel(roundNumber: number) {
  return roundNumber >= MAX_SNAG_CYCLES
    ? `Send ${getDesnagCycleLabel(roundNumber)} for Final Release to Handover`
    : `Send ${getDesnagCycleLabel(roundNumber)} for Release to ${getSnagCycleLabel(
        roundNumber + 1,
      )}`;
}

function getReleaseWorkflowTitle(roundNumber: number) {
  return roundNumber >= MAX_SNAG_CYCLES
    ? "Final Release to Handover"
    : `${getDesnagCycleLabel(roundNumber)} Release Workflow`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      message?: string;
      response?: { data?: { message?: string | string[] } };
    };
    const responseMessage = candidate.response?.data?.message;
    if (Array.isArray(responseMessage) && responseMessage.length > 0) {
      return responseMessage.join(", ");
    }
    if (typeof responseMessage === "string" && responseMessage.trim()) {
      return responseMessage;
    }
    if (typeof candidate.message === "string" && candidate.message.trim()) {
      return candidate.message;
    }
  }
  return fallback;
}

function formatPhaseStatus(status: string, isSkipped = false) {
  if (isSkipped) return "skipped";
  return status.replace(/_/g, " ");
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "open":
    case "IDENTIFIED":
      return "border-error/20 bg-error-muted text-error";
    case "rectified":
    case "RECTIFIED":
      return "border-success/20 bg-success-muted text-success";
    case "closed":
      return "border-info/20 bg-info-muted text-info";
    case "on_hold":
      return "border-warning/20 bg-warning-muted text-warning";
    case "handover_ready":
      return "border-success/20 bg-success-muted text-success";
    case "desnagging":
      return "border-info/20 bg-info-muted text-info";
    case "released":
      return "border-secondary/20 bg-secondary-muted text-secondary";
    case "submitted":
      return "border-info/20 bg-info-muted text-info";
    case "approval_pending":
      return "border-warning/20 bg-warning-muted text-warning";
    case "approved":
      return "border-success/20 bg-success-muted text-success";
    case "rejected":
      return "border-error/20 bg-error-muted text-error";
    case "skipped":
      return "border-secondary/20 bg-secondary-muted text-secondary";
    default:
      return "border-border-default bg-surface-base text-text-secondary";
  }
}

function checklistStatusClass(status: SnagChecklistStatus) {
  switch (status) {
    case "IDENTIFIED":
      return "border-error/20 bg-error-muted text-error";
    case "RECTIFIED":
      return "border-success/20 bg-success-muted text-success";
    case "NA":
    default:
      return "border-border-default bg-surface-base text-text-muted";
  }
}

function buildExplorer(units: SnagUnitSummary[]) {
  const blocks = new Map<string, ExplorerBlock>();

  for (const unit of [...units].sort((a, b) => {
    const blockCompare = naturalSort(a.blockLabel || "General", b.blockLabel || "General");
    if (blockCompare !== 0) return blockCompare;
    const towerCompare = naturalSort(a.towerLabel, b.towerLabel);
    if (towerCompare !== 0) return towerCompare;
    const floorCompare = naturalSort(a.floorLabel, b.floorLabel);
    if (floorCompare !== 0) return floorCompare;
    return naturalSort(a.unitLabel, b.unitLabel);
  })) {
    const blockLabel = unit.blockLabel || "General Block";
    const blockKey = `block:${unit.blockId ?? blockLabel}`;
    if (!blocks.has(blockKey)) {
      blocks.set(blockKey, { key: blockKey, label: blockLabel, towers: [] });
    }
    const block = blocks.get(blockKey)!;

    const towerKey = `tower:${unit.towerId}`;
    let tower = block.towers.find((entry) => entry.key === towerKey);
    if (!tower) {
      tower = { key: towerKey, label: unit.towerLabel, floors: [] };
      block.towers.push(tower);
    }

    const floorKey = `floor:${unit.floorId}`;
    let floor = tower.floors.find((entry) => entry.key === floorKey);
    if (!floor) {
      floor = { key: floorKey, label: unit.floorLabel, units: [] };
      tower.floors.push(floor);
    }

    floor.units.push(unit);
  }

  return [...blocks.values()];
}

function renderPhotoStrip(items: Array<{ id: number; fileUrl: string }>, emptyLabel: string) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-border-default px-3 py-4 text-xs text-text-muted">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {items.map((photo) => {
        const resolvedUrl = getFileUrl(photo.fileUrl);
        return (
          <a
            key={photo.id}
            href={resolvedUrl}
            target="_blank"
            rel="noreferrer"
            className="group overflow-hidden rounded-xl border border-border-subtle bg-surface-card"
          >
            <img
              src={resolvedUrl}
              alt="Snag evidence"
              className="h-24 w-full object-cover transition-transform group-hover:scale-105"
            />
          </a>
        );
      })}
    </div>
  );
}

function SectionCard({
  title,
  icon,
  actions,
  children,
}: {
  title: string;
  icon: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border-default bg-surface-card">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-surface-base p-2 text-primary">{icon}</div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function SnagManagementPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const pId = Number(projectId);
  const canApproveSnagRelease = Boolean(
    user &&
      (user.roles.includes("Admin") ||
        user.permissions.includes(PermissionCode.QUALITY_SNAG_APPROVE)),
  );
  const canDeleteSnag = Boolean(
    user &&
      (user.roles.includes("Admin") ||
        user.permissions.includes(PermissionCode.QUALITY_SNAG_DELETE)),
  );

  const [units, setUnits] = useState<SnagUnitSummary[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const [selectedUnit, setSelectedUnit] = useState<SnagUnitSummary | null>(null);
  const [detail, setDetail] = useState<SnagListDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);
  const [unitModalOpen, setUnitModalOpen] = useState(false);

  const [snagForm, setSnagForm] = useState<SnagFormState>(DEFAULT_SNAG_FORM);
  const [checklistDraft, setChecklistDraft] = useState<SnagChecklistItem[]>([]);
  const [checklistDirty, setChecklistDirty] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);

  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [evidenceDialog, setEvidenceDialog] = useState<EvidenceDialogState | null>(
    null,
  );
  const [evidenceFiles, setEvidenceFiles] = useState<FileList | null>(null);
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [skipDialog, setSkipDialog] = useState<SkipDialogState | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [resetRoundDialog, setResetRoundDialog] =
    useState<ResetRoundDialogState | null>(null);
  const [resetRoundReason, setResetRoundReason] = useState("");
  const [deleteItemDialog, setDeleteItemDialog] =
    useState<DeleteItemDialogState | null>(null);
  const [busy, setBusy] = useState(false);

  const loadUnits = useCallback(async () => {
    if (!pId) return;
    setLoadingUnits(true);
    try {
      const data = await snagService.listUnits(pId);
      setUnitsError(null);
      setUnits(data);
      setExpandedKeys((current) => {
        if (current.size > 0) return current;
        const next = new Set<string>();
        buildExplorer(data).forEach((block) => {
          next.add(block.key);
          block.towers.forEach((tower) => {
            next.add(tower.key);
            tower.floors.forEach((floor) => next.add(floor.key));
          });
        });
        return next;
      });
    } catch (error) {
      console.error(error);
      setUnitsError(
        getErrorMessage(
          error,
          "Unable to load snag explorer units right now. Please refresh after backend startup completes.",
        ),
      );
    } finally {
      setLoadingUnits(false);
    }
  }, [pId]);

  const loadDetail = useCallback(async (listId: number) => {
    if (!pId) return;
    const data = await snagService.getList(pId, listId);
    setDetail(data);
    setRoundNumber(data.currentRound || 1);
  }, [pId]);

  useEffect(() => {
    void loadUnits();
  }, [loadUnits]);

  useEffect(() => {
    setChecklistDraft(detail?.commonChecklist || []);
    setChecklistDirty(false);
    setSelectedItemIds([]);
    setSnagForm(DEFAULT_SNAG_FORM);
  }, [detail?.id, detail?.commonChecklist]);

  useEffect(() => {
    if (!checklistDirty || !detail?.id || !pId) return;

    const timeout = window.setTimeout(async () => {
      try {
        setSavingChecklist(true);
        const saved = await snagService.updateCommonChecklist(pId, detail.id, {
          items: checklistDraft.map((item, index) => ({
            ...item,
            sequence: index,
          })),
        });
        setDetail((current) =>
          current ? { ...current, commonChecklist: saved.commonChecklist } : current,
        );
        setChecklistDirty(false);
      } catch (error) {
        console.error(error);
      } finally {
        setSavingChecklist(false);
      }
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [checklistDraft, checklistDirty, detail?.id, pId]);

  useEffect(() => {
    setSelectedItemIds([]);
  }, [roundNumber, detail?.id]);

  const currentRound = useMemo<SnagRoundDetail | undefined>(
    () => detail?.rounds?.find((round) => round.roundNumber === roundNumber),
    [detail, roundNumber],
  );

  const currentCycleLabel = currentRound
    ? getSnagCycleLabel(currentRound.roundNumber)
    : "Snag";
  const currentDesnagLabel = currentRound
    ? getDesnagCycleLabel(currentRound.roundNumber)
    : "De-snag";
  const nextReleaseTargetLabel = currentRound
    ? getNextSnagCycleLabel(currentRound.roundNumber)
    : "next stage";

  const activeApproval = useMemo<SnagApproval | undefined>(
    () =>
      currentRound?.approvals?.find((approval) => approval.status === "pending"),
    [currentRound],
  );

  const filteredUnits = useMemo(() => {
    const term = deferredSearchQuery.trim().toLowerCase();
    if (!term) return units;
    return units.filter((unit) =>
      [
        unit.blockLabel,
        unit.towerLabel,
        unit.floorLabel,
        unit.unitLabel,
        unit.overallStatus,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    );
  }, [deferredSearchQuery, units]);

  const explorer = useMemo(() => buildExplorer(filteredUnits), [filteredUnits]);

  const summary = useMemo(
    () => ({
      totalUnits: units.length,
      activeLists: units.filter((unit) => unit.snagListId).length,
      desnagging: units.filter((unit) => unit.overallStatus === "desnagging")
        .length,
      handoverReady: units.filter(
        (unit) => unit.overallStatus === "handover_ready",
      ).length,
    }),
    [units],
  );

  const selectedItems = useMemo(() => {
    const items = [...(currentRound?.items || [])].sort(
      (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
    );
    const selected = items.filter((item) => selectedItemIds.includes(item.id));
    return { items, selected };
  }, [currentRound?.items, selectedItemIds]);

  const currentRoundSummary = useMemo(() => {
    const items = currentRound?.items || [];
    return {
      total: items.length,
      open: items.filter((item) => item.status === "open").length,
      rectified: items.filter((item) => item.status === "rectified").length,
      closed: items.filter((item) => item.status === "closed").length,
      onHold: items.filter((item) => item.status === "on_hold").length,
    };
  }, [currentRound?.items]);

  const unresolvedForRelease =
    currentRoundSummary.open + currentRoundSummary.rectified;
  const canCreateInSelectedCycle = Boolean(
    currentRound &&
      !currentRound.isSkipped &&
      currentRound.snagPhaseStatus === "open",
  );
  const canSkipSelectedCycle = Boolean(
    currentRound &&
      canApproveSnagRelease &&
      !currentRound.isSkipped &&
      currentRound.snagPhaseStatus === "open" &&
      currentRound.desnagPhaseStatus === "locked" &&
      currentRoundSummary.total === 0,
  );
  const canResetSelectedCycle = Boolean(currentRound && canDeleteSnag);

  const workflowSteps = useMemo(() => {
    const roundsByNumber = new Map(
      (detail?.rounds || []).map((round) => [round.roundNumber, round]),
    );

    const roundSteps = Array.from({ length: MAX_SNAG_CYCLES }, (_, index) => {
      const roundNo = index + 1;
      const round = roundsByNumber.get(roundNo);
      let state: "pending" | "current" | "complete" | "skipped" = "pending";

      if (round?.isSkipped) {
        state = "skipped";
      } else if (
        round?.desnagPhaseStatus === "approved" ||
        (detail?.overallStatus === "handover_ready" &&
          roundNo <= (detail?.currentRound ?? 0)) ||
        (detail?.currentRound ?? 0) > roundNo
      ) {
        state = "complete";
      } else if (detail?.currentRound === roundNo) {
        state = "current";
      }

      return {
        key: `round-${roundNo}`,
        title: `${getSnagCycleLabel(roundNo)} / ${getDesnagCycleLabel(roundNo)}`,
        subtitle:
          state === "skipped"
            ? "Skipped"
            : state === "complete"
              ? "Completed"
              : state === "current"
                ? "Current cycle"
                : "Pending",
        state,
      };
    });

    roundSteps.push({
      key: "handover",
      title: "Release to Handover",
      subtitle:
        detail?.overallStatus === "handover_ready"
          ? "Released"
          : "Pending final release",
      state:
        detail?.overallStatus === "handover_ready"
          ? ("complete" as const)
          : ("pending" as const),
    });

    return roundSteps;
  }, [detail]);

  const pendingQueue = useMemo(
    () =>
      [...units]
        .filter((unit) => unit.overallStatus !== "handover_ready")
        .sort((a, b) => naturalSort(a.unitLabel, b.unitLabel))
        .slice(0, 12),
    [units],
  );

  const toggleExpanded = (key: string) => {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return [];
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post("/files/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      urls.push(res.data?.url || res.data?.fileUrl || res.data?.path);
    }
    return urls;
  };

  const openUnit = async (unit: SnagUnitSummary) => {
    if (!pId) return;
    setLoadingDetail(true);
    setDetail(null);
    setSkipDialog(null);
    setSkipReason("");
    setResetRoundDialog(null);
    setResetRoundReason("");
    setDeleteItemDialog(null);
    setSelectedUnit(unit);
    setUnitModalOpen(true);
    try {
      if (unit.snagListId) {
        await loadDetail(unit.snagListId);
      } else {
        const data = await snagService.createOrGetList(pId, {
          qualityUnitId: unit.qualityUnitId,
        });
        setDetail(data);
        setRoundNumber(data.currentRound || 1);
        await loadUnits();
      }
    } catch (error) {
      console.error(error);
      setUnitModalOpen(false);
      setSkipDialog(null);
      setResetRoundDialog(null);
      setDeleteItemDialog(null);
      alert(
        getErrorMessage(
          error,
          "Unable to open the snag workspace for this unit right now.",
        ),
      );
    } finally {
      setLoadingDetail(false);
    }
  };

  const refreshCurrentDetail = async () => {
    if (!detail?.id) return;
    setLoadingDetail(true);
    try {
      await loadDetail(detail.id);
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert(
        getErrorMessage(
          error,
          "Unable to refresh the snag workspace right now.",
        ),
      );
    } finally {
      setLoadingDetail(false);
    }
  };

  const updateSnagForm = (patch: Partial<SnagFormState>) => {
    setSnagForm((current) => ({ ...current, ...patch }));
  };

  const createItem = async () => {
    if (!detail?.id || !currentRound) return;
    if (!snagForm.defectTitle.trim()) {
      alert("Defect title is required");
      return;
    }

    setBusy(true);
    try {
      const beforePhotoUrls = await uploadFiles(snagForm.beforeFiles);
      if (!beforePhotoUrls.length) {
        alert("Before photos are required");
        return;
      }

      const data = await snagService.addItem(pId, detail.id, currentRound.roundNumber, {
        qualityRoomId:
          snagForm.qualityRoomId === "" ? undefined : Number(snagForm.qualityRoomId),
        defectTitle: snagForm.defectTitle.trim(),
        defectDescription: snagForm.defectDescription.trim() || undefined,
        trade: snagForm.trade.trim() || undefined,
        priority: snagForm.priority,
        beforePhotoUrls,
        linkedChecklistItemId: snagForm.linkedChecklistItemId || undefined,
      });
      setDetail(data);
      setSnagForm(DEFAULT_SNAG_FORM);
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert("Failed to add snag item");
    } finally {
      setBusy(false);
    }
  };

  const setChecklistField = (
    checklistItemId: string,
    patch: Partial<SnagChecklistItem>,
  ) => {
    setChecklistDraft((current) =>
      current.map((item) =>
        item.id === checklistItemId ? { ...item, ...patch } : item,
      ),
    );
    setChecklistDirty(true);
  };

  const addChecklistRow = () => {
    setChecklistDraft((current) => [
      ...current,
      {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: "",
        qualityRoomId: null,
        roomLabel: null,
        trade: null,
        sequence: current.length,
        status: "NA",
        remarks: null,
        linkedSnagItemId: null,
        updatedAt: null,
        updatedById: null,
      },
    ]);
    setChecklistDirty(true);
  };

  const removeChecklistRow = (checklistItemId: string) => {
    setChecklistDraft((current) =>
      current.filter((item) => item.id !== checklistItemId),
    );
    setChecklistDirty(true);
  };

  const prefillSnagFromChecklist = (item: SnagChecklistItem) => {
    updateSnagForm({
      qualityRoomId: item.qualityRoomId ?? "",
      defectTitle: item.title,
      trade: item.trade || "",
      linkedChecklistItemId: item.id,
    });
  };

  const toggleItemSelection = (itemId: number) => {
    setSelectedItemIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    );
  };

  const openEvidenceDialog = (
    mode: EvidenceMode,
    itemIds: number[],
    title: string,
  ) => {
    setEvidenceDialog({ mode, itemIds, title });
    setEvidenceFiles(null);
    setEvidenceNotes("");
  };

  const submitEvidence = async () => {
    if (!detail?.id || !currentRound || !evidenceDialog) return;
    if (evidenceDialog.mode === "RECTIFY" && !evidenceFiles?.length) {
      alert("Photo evidence is required");
      return;
    }

    setBusy(true);
    try {
      const photoUrls = evidenceFiles?.length
        ? await uploadFiles(evidenceFiles)
        : [];
      const data =
        evidenceDialog.mode === "RECTIFY"
          ? await snagService.bulkRectifyItems(
              pId,
              detail.id,
              currentRound.roundNumber,
              {
                itemIds: evidenceDialog.itemIds,
                afterPhotoUrls: photoUrls,
                rectificationNotes: evidenceNotes.trim() || undefined,
              },
            )
          : await snagService.bulkCloseItems(
              pId,
              detail.id,
              currentRound.roundNumber,
              {
                itemIds: evidenceDialog.itemIds,
                closurePhotoUrls: photoUrls,
                remarks: evidenceNotes.trim() || undefined,
              },
            );

      setDetail(data);
      setEvidenceDialog(null);
      setSelectedItemIds([]);
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert("Failed to update selected snags");
    } finally {
      setBusy(false);
    }
  };

  const holdItem = async (item: SnagItemDetail) => {
    const reason = prompt("Enter hold reason");
    if (!reason) return;
    setBusy(true);
    try {
      const data = await snagService.holdItem(pId, item.id, reason);
      setDetail(data);
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert("Failed to put snag on hold");
    } finally {
      setBusy(false);
    }
  };

  const submitSnagPhase = async () => {
    if (!currentRound) return;
    setBusy(true);
    try {
      const data = await snagService.submitSnagPhase(pId, currentRound.id);
      setDetail(data);
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert("Failed to submit snag phase");
    } finally {
      setBusy(false);
    }
  };

  const submitRelease = async () => {
    if (!currentRound) return;
    setBusy(true);
    try {
      const data = await snagService.submitRelease(pId, currentRound.id);
      setDetail(data);
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert("Failed to submit release approval");
    } finally {
      setBusy(false);
    }
  };

  const openSkipDialog = () => {
    if (!currentRound) return;
    setSkipReason("");
    setSkipDialog({
      roundId: currentRound.id,
      currentLabel: getSnagCycleLabel(currentRound.roundNumber),
      currentDesnagLabel: getDesnagCycleLabel(currentRound.roundNumber),
      nextLabel: getNextSnagCycleLabel(currentRound.roundNumber),
    });
  };

  const openResetRoundDialog = () => {
    if (!currentRound || !detail) return;
    setResetRoundReason("");
    setResetRoundDialog({
      roundId: currentRound.id,
      currentLabel: getSnagCycleLabel(currentRound.roundNumber),
      currentDesnagLabel: getDesnagCycleLabel(currentRound.roundNumber),
      laterCycleCount: detail.rounds.filter(
        (round) => round.roundNumber > currentRound.roundNumber,
      ).length,
      rollsBackHandover: detail.overallStatus === "handover_ready",
    });
  };

  const submitSkipRound = async () => {
    if (!skipDialog) return;
    setBusy(true);
    try {
      const data = await snagService.skipRound(pId, skipDialog.roundId, {
        reason: skipReason.trim() || undefined,
      });
      setDetail(data);
      setRoundNumber(data.currentRound || 1);
      setSkipDialog(null);
      setSkipReason("");
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Failed to skip the selected snag cycle"));
    } finally {
      setBusy(false);
    }
  };

  const submitResetRound = async () => {
    if (!resetRoundDialog) return;
    if (!resetRoundReason.trim()) {
      alert("Reset reason is required");
      return;
    }

    setBusy(true);
    try {
      const data = await snagService.resetRound(pId, resetRoundDialog.roundId, {
        reason: resetRoundReason.trim(),
      });
      setDetail(data);
      setRoundNumber(data.currentRound || 1);
      setResetRoundDialog(null);
      setResetRoundReason("");
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Failed to reset the selected snag cycle"));
    } finally {
      setBusy(false);
    }
  };

  const canDeleteItem = (_item: SnagItemDetail) => {
    return canDeleteSnag;
  };

  const confirmDeleteItem = (item: SnagItemDetail) => {
    setDeleteItemDialog({
      itemId: item.id,
      defectTitle: item.defectTitle,
    });
  };

  const submitDeleteItem = async () => {
    if (!deleteItemDialog) return;

    setBusy(true);
    try {
      const data = await snagService.deleteItem(pId, deleteItemDialog.itemId);
      setDetail(data);
      setSelectedItemIds((current) =>
        current.filter((id) => id !== deleteItemDialog.itemId),
      );
      setDeleteItemDialog(null);
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error, "Failed to delete the selected snag item"));
    } finally {
      setBusy(false);
    }
  };

  const advanceApproval = async (
    approvalId: number,
    action: "APPROVE" | "REJECT",
  ) => {
    setBusy(true);
    try {
      const data = await snagService.advanceApproval(pId, approvalId, { action });
      setDetail(data);
      await loadUnits();
    } catch (error) {
      console.error(error);
      alert("Failed to update release approval");
    } finally {
      setBusy(false);
    }
  };

  const canBulkRectify =
    selectedItems.selected.length > 0 &&
    selectedItems.selected.every((item) => item.status === "open");
  const canBulkClose =
    selectedItems.selected.length > 0 &&
    selectedItems.selected.every((item) => item.status === "rectified");
  const hasUnitsLoadFailure = Boolean(unitsError && units.length === 0);
  const hasSearchTerm = deferredSearchQuery.trim().length > 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SectionCard
            title="Units in Scope"
            icon={<Home className="h-4 w-4" />}
          >
            <div className="text-3xl font-bold text-text-primary">
              {hasUnitsLoadFailure ? "--" : summary.totalUnits}
            </div>
            <p className="mt-1 text-sm text-text-muted">
              Structured handover units ready for snag workflows.
            </p>
          </SectionCard>
          <SectionCard
            title="Lists Activated"
            icon={<ClipboardList className="h-4 w-4" />}
          >
            <div className="text-3xl font-bold text-text-primary">
              {hasUnitsLoadFailure ? "--" : summary.activeLists}
            </div>
            <p className="mt-1 text-sm text-text-muted">
              Units where snagging has already started.
            </p>
          </SectionCard>
          <SectionCard
            title="In De-snag"
            icon={<Hammer className="h-4 w-4" />}
          >
            <div className="text-3xl font-bold text-info">
              {hasUnitsLoadFailure ? "--" : summary.desnagging}
            </div>
            <p className="mt-1 text-sm text-text-muted">
              Units waiting for rectification or closeout review.
            </p>
          </SectionCard>
          <SectionCard
            title="Released to Handover"
            icon={<ShieldCheck className="h-4 w-4" />}
          >
            <div className="text-3xl font-bold text-success">
              {hasUnitsLoadFailure ? "--" : summary.handoverReady}
            </div>
            <p className="mt-1 text-sm text-text-muted">
              Units that have cleared all configured snag cycles.
            </p>
          </SectionCard>
        </div>

        <SectionCard
          title="Real-World Process"
          icon={<ListChecks className="h-4 w-4" />}
        >
          <div className="space-y-3 text-sm text-text-secondary">
            <div>
              1. Drill down block, tower, floor, then open a flat popup instead
              of working from a giant unit list.
            </div>
            <div>
              2. Use the common snag checklist to mark standard points as
              identified, rectified, or not applicable.
            </div>
            <div>
              3. Raise only the actual defects as snag items, then bulk
              rectify, close, and release them with photo evidence.
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-3xl border border-border-default bg-surface-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Snag Explorer
              </h2>
              <p className="text-sm text-text-muted">
                Drill through the project hierarchy and open each flat in a
                focused snag workspace.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="relative w-72 max-w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search block, tower, floor or flat"
                  className="w-full rounded-xl border border-border-default bg-surface-base pl-9 pr-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                />
              </label>
              <button
                onClick={() => void loadUnits()}
                className="inline-flex items-center gap-2 rounded-xl border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-surface-base"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          <div className="max-h-[72vh] overflow-y-auto p-5">
            {loadingUnits ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border-default px-6 py-16 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading project units...
              </div>
            ) : unitsError && units.length === 0 ? (
              <div className="rounded-2xl border border-error/25 bg-error-muted/50 px-6 py-8 text-sm text-error">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  Snag Explorer could not load the project units.
                </div>
                <p className="mt-3 text-sm leading-6">
                  {unitsError}
                </p>
                <p className="mt-2 text-xs text-error/90">
                  The project structure may already exist, but the snag API has
                  to load successfully before block, tower, floor, and flat
                  drill-down becomes visible here.
                </p>
                <button
                  onClick={() => void loadUnits()}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-error/30 bg-white px-3 py-2 font-medium text-error hover:bg-error-muted/40"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry loading units
                </button>
              </div>
            ) : explorer.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-default px-6 py-16 text-center text-sm text-text-muted">
                {hasSearchTerm
                  ? "No quality units match the current search."
                  : "No quality units are available yet. Open Structure and create units/rooms for the EPS floors first."}
              </div>
            ) : (
              <div className="space-y-4">
                {unitsError && (
                  <div className="rounded-2xl border border-warning/25 bg-warning-muted/40 px-4 py-3 text-sm text-warning">
                    <div className="font-semibold">
                      Snag Explorer is showing the last loaded unit tree.
                    </div>
                    <div className="mt-1">
                      {unitsError}
                    </div>
                  </div>
                )}
                {explorer.map((block) => {
                  const blockExpanded = expandedKeys.has(block.key);
                  return (
                    <div
                      key={block.key}
                      className="rounded-2xl border border-border-default bg-surface-base/60"
                    >
                      <button
                        onClick={() => toggleExpanded(block.key)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      >
                        <div className="flex items-center gap-3">
                          {blockExpanded ? (
                            <ChevronDown className="h-4 w-4 text-text-muted" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-text-muted" />
                          )}
                          <div className="rounded-xl bg-surface-card p-2 text-primary">
                            <Grid2X2 className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-text-primary">
                              {block.label}
                            </div>
                            <div className="text-xs text-text-muted">
                              {block.towers.reduce(
                                (count, tower) =>
                                  count +
                                  tower.floors.reduce(
                                    (floorCount, floor) =>
                                      floorCount + floor.units.length,
                                    0,
                                  ),
                                0,
                              )}{" "}
                              units
                            </div>
                          </div>
                        </div>
                      </button>

                      {blockExpanded && (
                        <div className="space-y-3 border-t border-border-subtle p-3">
                          {block.towers.map((tower) => {
                            const towerExpanded = expandedKeys.has(tower.key);
                            return (
                              <div
                                key={tower.key}
                                className="rounded-2xl border border-border-subtle bg-surface-card"
                              >
                                <button
                                  onClick={() => toggleExpanded(tower.key)}
                                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                                >
                                  <div className="flex items-center gap-3">
                                    {towerExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-text-muted" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-text-muted" />
                                    )}
                                    <div className="rounded-xl bg-surface-base p-2 text-secondary">
                                      <Building2 className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <div className="font-medium text-text-primary">
                                        {tower.label}
                                      </div>
                                      <div className="text-xs text-text-muted">
                                        {tower.floors.length} floors
                                      </div>
                                    </div>
                                  </div>
                                </button>

                                {towerExpanded && (
                                  <div className="space-y-3 border-t border-border-subtle p-3">
                                    {tower.floors.map((floor) => {
                                      const floorExpanded = expandedKeys.has(
                                        floor.key,
                                      );
                                      return (
                                        <div
                                          key={floor.key}
                                          className="rounded-2xl border border-border-subtle bg-surface-base"
                                        >
                                          <button
                                            onClick={() => toggleExpanded(floor.key)}
                                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                                          >
                                            <div className="flex items-center gap-3">
                                              {floorExpanded ? (
                                                <ChevronDown className="h-4 w-4 text-text-muted" />
                                              ) : (
                                                <ChevronRight className="h-4 w-4 text-text-muted" />
                                              )}
                                              <div className="rounded-xl bg-surface-card p-2 text-info">
                                                <Layers className="h-4 w-4" />
                                              </div>
                                              <div>
                                                <div className="font-medium text-text-primary">
                                                  {floor.label}
                                                </div>
                                                <div className="text-xs text-text-muted">
                                                  {floor.units.length} units
                                                </div>
                                              </div>
                                            </div>
                                          </button>

                                          {floorExpanded && (
                                            <div className="grid gap-3 border-t border-border-subtle p-3 sm:grid-cols-2 xl:grid-cols-3">
                                              {floor.units.map((unit) => (
                                                <button
                                                  key={unit.qualityUnitId}
                                                  onClick={() => void openUnit(unit)}
                                                  className="rounded-2xl border border-border-default bg-surface-card p-4 text-left transition-colors hover:border-primary hover:bg-primary-muted/20"
                                                >
                                                  <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                      <div className="font-semibold text-text-primary">
                                                        {unit.unitLabel}
                                                      </div>
                                                      <div className="mt-1 text-xs text-text-muted">
                                                        {getSnagCycleLabel(
                                                          unit.currentRound,
                                                        )} |{" "}
                                                        {unit.roomCount} rooms
                                                      </div>
                                                    </div>
                                                    <span
                                                      className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusBadgeClass(unit.overallStatus)}`}
                                                    >
                                                      {getWorkflowStatusLabel(
                                                        unit.overallStatus,
                                                        unit.currentRound,
                                                      )}
                                                    </span>
                                                  </div>
                                                  <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
                                                    <span>
                                                      Checklist:{" "}
                                                      {unit.commonChecklistCount}
                                                    </span>
                                                    <span>
                                                      {unit.snagListId
                                                        ? "Continue"
                                                        : "Start"}
                                                    </span>
                                                  </div>
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <SectionCard
            title="Live Queue"
            icon={<AlertTriangle className="h-4 w-4" />}
          >
            <div className="space-y-2">
              {pendingQueue.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border-default px-3 py-6 text-center text-sm text-text-muted">
                  No active snag units right now.
                </div>
              ) : (
                pendingQueue.map((unit) => (
                  <button
                    key={unit.qualityUnitId}
                    onClick={() => void openUnit(unit)}
                    className="flex w-full items-center justify-between rounded-xl border border-border-default bg-surface-base px-3 py-3 text-left hover:border-primary"
                  >
                    <div>
                      <div className="font-medium text-text-primary">
                        {unit.unitLabel}
                      </div>
                      <div className="text-xs text-text-muted">
                        {unit.towerLabel} / {unit.floorLabel}
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusBadgeClass(unit.overallStatus)}`}
                    >
                      {getWorkflowStatusLabel(
                        unit.overallStatus,
                        unit.currentRound,
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>
          </SectionCard>
        </aside>
      </div>

      {unitModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-surface-base/80 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center p-4">
            <div className="flex h-[94vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-[28px] border border-border-default bg-surface-card shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-6 py-5">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-primary-muted p-3 text-primary">
                      <Home className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold text-text-primary">
                        {selectedUnit?.unitLabel || detail?.unitLabel || "Unit"}
                      </h2>
                      <p className="text-sm text-text-muted">
                        {selectedUnit?.blockLabel || "Project"} /{" "}
                        {selectedUnit?.towerLabel} / {selectedUnit?.floorLabel}
                      </p>
                    </div>
                  </div>
                  {detail && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusBadgeClass(detail.overallStatus)}`}
                      >
                        {getWorkflowStatusLabel(
                          detail.overallStatus,
                          detail.currentRound,
                        )}
                      </span>
                      <span className="rounded-full border border-border-default bg-surface-base px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                        Current {getSnagCycleLabel(detail.currentRound)} /{" "}
                        {getDesnagCycleLabel(detail.currentRound)}
                      </span>
                      {detail.overallStatus === "handover_ready" && (
                        <span className="rounded-full border border-success/20 bg-success-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-success">
                          After Release to Handover
                        </span>
                      )}
                      {savingChecklist && (
                        <span className="rounded-full border border-border-default bg-surface-base px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                          Saving checklist...
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void refreshCurrentDetail()}
                    className="inline-flex items-center gap-2 rounded-xl border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-surface-base"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                  <button
                    onClick={() => {
                      setUnitModalOpen(false);
                      setSkipDialog(null);
                      setResetRoundDialog(null);
                      setResetRoundReason("");
                      setDeleteItemDialog(null);
                    }}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border-default text-text-secondary hover:bg-surface-base"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {loadingDetail || !detail ? (
                <div className="flex flex-1 items-center justify-center gap-2 text-sm text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading snag workspace...
                </div>
              ) : (
                <>
                  <div className="border-b border-border-subtle px-6 py-3">
                    <div className="flex flex-wrap gap-2">
                      {detail.rounds.map((round) => (
                        <button
                          key={round.id}
                          onClick={() => setRoundNumber(round.roundNumber)}
                          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                            round.roundNumber === roundNumber
                              ? "bg-primary text-white"
                              : "border border-border-default bg-surface-base text-text-secondary"
                          }`}
                        >
                          {getSnagCycleLabel(round.roundNumber)}
                          {round.isSkipped ? " (Skipped)" : ""}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-3 xl:grid-cols-4">
                      {workflowSteps.map((step) => (
                        <div
                          key={step.key}
                          className={`rounded-2xl border px-4 py-3 ${
                            step.state === "complete"
                              ? "border-success/20 bg-success-muted/60"
                              : step.state === "current"
                                ? "border-primary/30 bg-primary-muted/40"
                                : step.state === "skipped"
                                  ? "border-secondary/20 bg-secondary-muted/40"
                                  : "border-border-default bg-surface-base"
                          }`}
                        >
                          <div className="text-sm font-semibold text-text-primary">
                            {step.title}
                          </div>
                          <div className="mt-1 text-xs text-text-muted">
                            {step.subtitle}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid flex-1 gap-5 overflow-hidden p-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <div className="space-y-4 overflow-y-auto pr-1">
                      <SectionCard
                        title={`${currentCycleLabel} Status`}
                        icon={<ShieldCheck className="h-4 w-4" />}
                      >
                        <div className="space-y-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-text-muted">
                              {currentCycleLabel}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusBadgeClass(
                                formatPhaseStatus(
                                  currentRound?.snagPhaseStatus || "open",
                                  currentRound?.isSkipped,
                                ),
                              )}`}
                            >
                              {formatPhaseStatus(
                                currentRound?.snagPhaseStatus || "open",
                                currentRound?.isSkipped,
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-text-muted">
                              {currentDesnagLabel}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusBadgeClass(
                                formatPhaseStatus(
                                  currentRound?.desnagPhaseStatus || "locked",
                                  currentRound?.isSkipped,
                                ),
                              )}`}
                            >
                              {formatPhaseStatus(
                                currentRound?.desnagPhaseStatus || "locked",
                                currentRound?.isSkipped,
                              )}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border-default bg-surface-base/70 p-3 text-xs text-text-muted">
                            <div>
                              <div className="font-semibold text-text-primary">
                                {currentRoundSummary.open}
                              </div>
                              <div>Open</div>
                            </div>
                            <div>
                              <div className="font-semibold text-text-primary">
                                {currentRoundSummary.rectified}
                              </div>
                              <div>Rectified</div>
                            </div>
                            <div>
                              <div className="font-semibold text-text-primary">
                                {currentRoundSummary.closed}
                              </div>
                              <div>Closed</div>
                            </div>
                            <div>
                              <div className="font-semibold text-text-primary">
                                {currentRoundSummary.onHold}
                              </div>
                              <div>On Hold</div>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-border-default bg-surface-base/70 p-3 text-xs leading-6 text-text-muted">
                            {detail.overallStatus === "handover_ready" ? (
                              <>
                                All three snag and de-snag cycles are complete.
                                This unit is now after final release to handover.
                              </>
                            ) : currentRound?.isSkipped ? (
                              <>
                                {currentCycleLabel} was skipped by an authorized
                                user and released directly to{" "}
                                {getNextSnagCycleLabel(currentRound.roundNumber)}.
                                {currentRound.skipReason
                                  ? ` Reason: ${currentRound.skipReason}`
                                  : ""}
                              </>
                            ) : (
                              <>
                                Close snag items from the live list below, then
                                send {currentDesnagLabel} for approval. After
                                approval, this unit will be released to{" "}
                                {nextReleaseTargetLabel}.
                              </>
                            )}
                          </div>
                          <div className="grid gap-2 pt-2">
                            <button
                              onClick={() => void submitSnagPhase()}
                              disabled={
                                busy ||
                                currentRound?.snagPhaseStatus !== "open" ||
                                currentRound?.isSkipped
                              }
                              className="rounded-xl border border-border-default px-3 py-2 text-sm text-text-primary hover:bg-surface-base disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {getSubmitSnagActionLabel(
                                currentRound?.roundNumber || 1,
                              )}
                            </button>
                            <button
                              onClick={() => void submitRelease()}
                              disabled={
                                busy ||
                                currentRound?.desnagPhaseStatus !== "open" ||
                                currentRound?.isSkipped ||
                                unresolvedForRelease > 0
                              }
                              className="rounded-xl border border-border-default px-3 py-2 text-sm text-text-primary hover:bg-surface-base disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {getReleaseActionLabel(
                                currentRound?.roundNumber || 1,
                              )}
                            </button>
                            {canApproveSnagRelease && (
                              <button
                                onClick={openSkipDialog}
                                disabled={!canSkipSelectedCycle || busy}
                                className="rounded-xl border border-border-default px-3 py-2 text-sm text-text-primary hover:bg-surface-base disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Skip {currentCycleLabel} and {currentDesnagLabel}
                              </button>
                            )}
                            <button
                              onClick={openResetRoundDialog}
                              disabled={!canResetSelectedCycle || busy}
                              className="rounded-xl border border-error/20 px-3 py-2 text-sm text-error hover:bg-error-muted disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {canDeleteSnag
                                ? `Delete ${currentCycleLabel} and ${currentDesnagLabel}`
                                : `Delete ${currentCycleLabel} and ${currentDesnagLabel} (Admin only)`}
                            </button>
                            {!canDeleteSnag && (
                              <div className="rounded-xl border border-border-default bg-surface-base/70 px-3 py-2 text-xs text-text-muted">
                                Cycle reset is available only to users with
                                snag delete permission.
                              </div>
                            )}
                            {canApproveSnagRelease &&
                              !canSkipSelectedCycle &&
                              currentRound &&
                              !currentRound.isSkipped &&
                              currentRound.snagPhaseStatus === "open" &&
                              currentRound.desnagPhaseStatus === "locked" &&
                              currentRoundSummary.total > 0 && (
                                <div className="rounded-xl border border-warning/20 bg-warning-muted/40 px-3 py-2 text-xs text-warning">
                                  Skip is available only before any snag is raised
                                  in this cycle.
                                </div>
                              )}
                          </div>
                        </div>
                      </SectionCard>

                      <SectionCard
                        title={`Raise ${currentCycleLabel}`}
                        icon={<Hammer className="h-4 w-4" />}
                      >
                        <div className="space-y-3">
                          {!canCreateInSelectedCycle && (
                            <div className="rounded-xl border border-border-default bg-surface-base/70 px-3 py-3 text-xs leading-6 text-text-muted">
                              {currentCycleLabel} is not open for new defects.
                              Switch to the current snag cycle if you want to
                              raise fresh snag items.
                            </div>
                          )}
                          <select
                            value={snagForm.qualityRoomId}
                            disabled={!canCreateInSelectedCycle}
                            onChange={(event) =>
                              updateSnagForm({
                                qualityRoomId: event.target.value
                                  ? Number(event.target.value)
                                  : "",
                              })
                            }
                            className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm outline-none focus:border-primary"
                          >
                            <option value="">Room / area (optional)</option>
                            {(detail.unit?.rooms || []).map((room) => (
                              <option key={room.id} value={room.id}>
                                {room.name}
                              </option>
                            ))}
                          </select>
                          <input
                            value={snagForm.defectTitle}
                            disabled={!canCreateInSelectedCycle}
                            onChange={(event) =>
                              updateSnagForm({ defectTitle: event.target.value })
                            }
                            placeholder="Defect title"
                            className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                          <textarea
                            value={snagForm.defectDescription}
                            disabled={!canCreateInSelectedCycle}
                            onChange={(event) =>
                              updateSnagForm({
                                defectDescription: event.target.value,
                              })
                            }
                            rows={4}
                            placeholder="Describe the snag or defect"
                            className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input
                              value={snagForm.trade}
                              disabled={!canCreateInSelectedCycle}
                              onChange={(event) =>
                                updateSnagForm({ trade: event.target.value })
                              }
                              placeholder="Trade"
                              className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm outline-none focus:border-primary"
                            />
                            <select
                              value={snagForm.priority}
                              disabled={!canCreateInSelectedCycle}
                              onChange={(event) =>
                                updateSnagForm({ priority: event.target.value })
                              }
                              className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm outline-none focus:border-primary"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="critical">Critical</option>
                            </select>
                          </div>
                          <label
                            className={`flex items-center gap-2 rounded-xl border border-dashed border-border-default bg-surface-base px-3 py-3 text-sm ${
                              canCreateInSelectedCycle
                                ? "cursor-pointer text-text-secondary"
                                : "cursor-not-allowed text-text-disabled"
                            }`}
                          >
                            <Upload className="h-4 w-4" />
                            Upload before photos
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              disabled={!canCreateInSelectedCycle}
                              onChange={(event) =>
                                updateSnagForm({ beforeFiles: event.target.files })
                              }
                            />
                          </label>
                          <button
                            onClick={() => void createItem()}
                            disabled={busy || !canCreateInSelectedCycle}
                            className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Add Snag Item
                          </button>
                        </div>
                      </SectionCard>

                      {activeApproval && (
                        <SectionCard
                          title={getReleaseWorkflowTitle(
                            currentRound?.roundNumber || 1,
                          )}
                          icon={<ShieldCheck className="h-4 w-4" />}
                        >
                          <div className="space-y-2">
                            {activeApproval.steps.map((step) => (
                              <div
                                key={step.id}
                                className="rounded-xl border border-border-default bg-surface-base px-3 py-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="font-medium text-text-primary">
                                      {step.stepName}
                                    </div>
                                    <div className="text-xs text-text-muted">
                                      {step.status}
                                    </div>
                                  </div>
                                  {step.status === "pending" && (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() =>
                                          void advanceApproval(
                                            activeApproval.id,
                                            "APPROVE",
                                          )
                                        }
                                        className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() =>
                                          void advanceApproval(
                                            activeApproval.id,
                                            "REJECT",
                                          )
                                        }
                                        className="rounded-xl border border-error/20 px-3 py-1.5 text-xs font-semibold text-error"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </SectionCard>
                      )}
                    </div>

                    <div className="space-y-4 overflow-y-auto pr-1">
                      <SectionCard
                        title="Common Snag Checklist"
                        icon={<ListChecks className="h-4 w-4" />}
                        actions={
                          <button
                            onClick={addChecklistRow}
                            className="rounded-xl border border-border-default px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-base"
                          >
                            Add Point
                          </button>
                        }
                      >
                        <div className="space-y-3">
                          {checklistDraft.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border-default px-4 py-8 text-center text-sm text-text-muted">
                              No common snag points added yet. Add the standard
                              handover points you want checked for every unit.
                            </div>
                          ) : (
                            checklistDraft.map((item) => (
                              <div
                                key={item.id}
                                className="rounded-2xl border border-border-default bg-surface-base/60 p-4"
                              >
                                <div className="grid gap-3 lg:grid-cols-[200px_minmax(0,1fr)_140px_auto]">
                                  <select
                                    value={item.qualityRoomId ?? ""}
                                    onChange={(event) => {
                                      const roomId = event.target.value
                                        ? Number(event.target.value)
                                        : null;
                                      const room = detail.unit?.rooms?.find(
                                        (entry) => entry.id === roomId,
                                      );
                                      setChecklistField(item.id, {
                                        qualityRoomId: roomId,
                                        roomLabel: room?.name || null,
                                      });
                                    }}
                                    className="rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm outline-none focus:border-primary"
                                  >
                                    <option value="">Room / area</option>
                                    {(detail.unit?.rooms || []).map((room) => (
                                      <option key={room.id} value={room.id}>
                                        {room.name}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    value={item.title}
                                    onChange={(event) =>
                                      setChecklistField(item.id, {
                                        title: event.target.value,
                                      })
                                    }
                                    placeholder="Common snag point"
                                    className="rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm outline-none focus:border-primary"
                                  />
                                  <input
                                    value={item.trade || ""}
                                    onChange={(event) =>
                                      setChecklistField(item.id, {
                                        trade: event.target.value || null,
                                      })
                                    }
                                    placeholder="Trade"
                                    className="rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm outline-none focus:border-primary"
                                  />
                                  <button
                                    onClick={() => removeChecklistRow(item.id)}
                                    className="rounded-xl border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-surface-card"
                                  >
                                    Remove
                                  </button>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  {CHECKLIST_STATUSES.map((status) => (
                                    <button
                                      key={status}
                                      onClick={() =>
                                        setChecklistField(item.id, { status })
                                      }
                                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] ${
                                        item.status === status
                                          ? checklistStatusClass(status)
                                          : "border-border-default bg-surface-card text-text-muted"
                                      }`}
                                    >
                                      {status}
                                    </button>
                                  ))}
                                  <input
                                    value={item.remarks || ""}
                                    onChange={(event) =>
                                      setChecklistField(item.id, {
                                        remarks: event.target.value || null,
                                      })
                                    }
                                    placeholder="Remarks"
                                    className="min-w-[220px] flex-1 rounded-xl border border-border-default bg-surface-card px-3 py-2 text-sm outline-none focus:border-primary"
                                  />
                                  <button
                                    onClick={() => prefillSnagFromChecklist(item)}
                                    className="rounded-xl border border-border-default px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-card"
                                  >
                                    Raise Snag
                                  </button>
                                  {item.linkedSnagItemId && (
                                    <span className="rounded-full border border-border-default bg-surface-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                                      Linked snag #{item.linkedSnagItemId}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </SectionCard>

                      <SectionCard
                        title={`Live ${currentCycleLabel} List`}
                        icon={<Hammer className="h-4 w-4" />}
                        actions={
                          selectedItemIds.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-border-default bg-surface-base px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                                {selectedItemIds.length} selected
                              </span>
                              <button
                                onClick={() =>
                                  openEvidenceDialog(
                                    "RECTIFY",
                                    selectedItemIds,
                                    "Bulk Rectify Selected Snags",
                                  )
                                }
                                disabled={!canBulkRectify}
                                className="rounded-xl border border-border-default px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-base disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Bulk Rectify
                              </button>
                              <button
                                onClick={() =>
                                  openEvidenceDialog(
                                    "CLOSE",
                                    selectedItemIds,
                                    "Bulk Close Selected Snags",
                                  )
                                }
                                disabled={!canBulkClose}
                                className="rounded-xl border border-border-default px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-base disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Bulk Close
                              </button>
                            </div>
                          ) : null
                        }
                      >
                        <div className="space-y-4">
                          <div className="rounded-2xl border border-border-default bg-surface-base/70 px-4 py-3 text-xs leading-6 text-text-muted">
                            Rectified items can be closed here, with or without
                            photo evidence. Once every item is Closed or On
                            Hold,{" "}
                            {currentDesnagLabel} can be sent for approval and
                            then released to {nextReleaseTargetLabel}.
                          </div>
                          <div className="rounded-2xl border border-border-default bg-surface-base/70 px-4 py-3 text-xs leading-6 text-text-muted">
                            Snag items can be permanently deleted only by users
                            with snag delete permission, including after final
                            release to handover.
                          </div>
                          {selectedItems.items.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border-default px-4 py-8 text-center text-sm text-text-muted">
                              No snag items added in this snag cycle yet.
                            </div>
                          ) : (
                            selectedItems.items.map((item) => (
                              <article
                                key={item.id}
                                className="rounded-2xl border border-border-default bg-surface-base/60"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle px-4 py-4">
                                  <div className="flex items-start gap-3">
                                    <input
                                      type="checkbox"
                                      checked={selectedItemIds.includes(item.id)}
                                      onChange={() => toggleItemSelection(item.id)}
                                      className="mt-1 h-4 w-4 rounded border-border-default text-primary focus:ring-primary"
                                    />
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="font-semibold text-text-primary">
                                          {item.defectTitle}
                                        </h4>
                                        <span
                                          className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusBadgeClass(item.status)}`}
                                        >
                                          {item.status.replace("_", " ")}
                                        </span>
                                        {item.priority && (
                                          <span className="rounded-full border border-border-default bg-surface-card px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                                            {item.priority}
                                          </span>
                                        )}
                                      </div>
                                      <div className="mt-1 text-xs text-text-muted">
                                        {item.roomLabel || "Common area"} |{" "}
                                        {item.trade || "General"}
                                      </div>
                                      {item.defectDescription && (
                                        <p className="mt-2 text-sm text-text-secondary">
                                          {item.defectDescription}
                                        </p>
                                      )}
                                      {item.rectificationNotes && (
                                        <p className="mt-2 text-xs text-text-muted">
                                          Rectification note: {item.rectificationNotes}
                                        </p>
                                      )}
                                      {item.closureRemarks && (
                                        <p className="mt-1 text-xs text-text-muted">
                                          Closure note: {item.closureRemarks}
                                        </p>
                                      )}
                                      {item.holdReason && (
                                        <p className="mt-1 text-xs text-warning">
                                          Hold: {item.holdReason}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {item.status === "open" && (
                                      <>
                                        <button
                                          onClick={() =>
                                            openEvidenceDialog(
                                              "RECTIFY",
                                              [item.id],
                                              `Rectify ${item.defectTitle}`,
                                            )
                                          }
                                          className="rounded-xl border border-border-default px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-card"
                                        >
                                          Rectify
                                        </button>
                                        <button
                                          onClick={() => void holdItem(item)}
                                          className="rounded-xl border border-warning/20 px-3 py-2 text-xs font-semibold text-warning hover:bg-warning-muted"
                                        >
                                          Hold
                                        </button>
                                      </>
                                    )}
                                    {item.status === "rectified" && (
                                      <button
                                        onClick={() =>
                                          openEvidenceDialog(
                                            "CLOSE",
                                            [item.id],
                                            `Close ${item.defectTitle}`,
                                          )
                                        }
                                        className="rounded-xl border border-border-default px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-card"
                                      >
                                        Close
                                      </button>
                                    )}
                                    {canDeleteItem(item) && (
                                      <button
                                        onClick={() => confirmDeleteItem(item)}
                                        className="rounded-xl border border-error/20 px-3 py-2 text-xs font-semibold text-error hover:bg-error-muted"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="grid gap-4 p-4 xl:grid-cols-3">
                                  <div>
                                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                                      <Camera className="h-3.5 w-3.5" />
                                      Before
                                    </div>
                                    {renderPhotoStrip(
                                      item.beforePhotos,
                                      "No before photos uploaded.",
                                    )}
                                  </div>
                                  <div>
                                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                                      <ImagePlus className="h-3.5 w-3.5" />
                                      Rectification
                                    </div>
                                    {renderPhotoStrip(
                                      item.afterPhotos,
                                      "No rectification photos yet.",
                                    )}
                                  </div>
                                  <div>
                                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      Closure
                                    </div>
                                    {renderPhotoStrip(
                                      item.closurePhotos,
                                      "No closure photos yet.",
                                    )}
                                  </div>
                                </div>
                              </article>
                            ))
                          )}
                        </div>
                      </SectionCard>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {evidenceDialog && (
        <div className="fixed inset-0 z-[1100] bg-surface-base/80 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-3xl border border-border-default bg-surface-card shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">
                    {evidenceDialog.title}
                  </h3>
                  <p className="text-sm text-text-muted">
                    {evidenceDialog.mode === "RECTIFY"
                      ? "Upload evidence once and apply it to the selected snag items."
                      : "Upload closure evidence if available, or close the selected snag items without photos."}
                  </p>
                </div>
                <button
                  onClick={() => setEvidenceDialog(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border-default text-text-secondary hover:bg-surface-base"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 px-5 py-5">
                <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-border-default bg-surface-base px-4 py-4 text-sm text-text-secondary">
                  <Upload className="h-4 w-4" />
                  Upload{" "}
                  {evidenceDialog.mode === "RECTIFY"
                    ? "rectification"
                    : "closure"}{" "}
                  photos
                  {evidenceDialog.mode === "CLOSE" ? " (optional)" : ""}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => setEvidenceFiles(event.target.files)}
                  />
                </label>
                <textarea
                  value={evidenceNotes}
                  onChange={(event) => setEvidenceNotes(event.target.value)}
                  rows={4}
                  placeholder={
                    evidenceDialog.mode === "RECTIFY"
                      ? "Rectification notes"
                      : "Closure remarks (optional)"
                  }
                  className="w-full rounded-2xl border border-border-default bg-surface-base px-4 py-3 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={() => void submitEvidence()}
                  disabled={busy}
                  className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {evidenceDialog.mode === "RECTIFY"
                    ? "Submit Rectification"
                    : "Submit Closure"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {skipDialog && (
        <div className="fixed inset-0 z-[1100] bg-surface-base/80 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-3xl border border-border-default bg-surface-card shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">
                    Skip {skipDialog.currentLabel} /{" "}
                    {skipDialog.currentDesnagLabel}
                  </h3>
                  <p className="text-sm text-text-muted">
                    This will bypass this full snag and de-snag cycle and
                    release the unit directly to {skipDialog.nextLabel}.
                  </p>
                </div>
                <button
                  onClick={() => setSkipDialog(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border-default text-text-secondary hover:bg-surface-base"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 px-5 py-5">
                <div className="rounded-2xl border border-warning/20 bg-warning-muted/40 px-4 py-3 text-sm text-warning">
                  Only authorized users should skip a snag cycle, and only
                  before any snag item is raised in that cycle.
                </div>
                <textarea
                  value={skipReason}
                  onChange={(event) => setSkipReason(event.target.value)}
                  rows={4}
                  placeholder="Reason for skipping this snag cycle"
                  className="w-full rounded-2xl border border-border-default bg-surface-base px-4 py-3 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={() => void submitSkipRound()}
                  disabled={busy}
                  className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Skip This Cycle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {resetRoundDialog && (
        <div className="fixed inset-0 z-[1100] bg-surface-base/80 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-3xl border border-border-default bg-surface-card shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">
                    Delete {resetRoundDialog.currentLabel} /{" "}
                    {resetRoundDialog.currentDesnagLabel}
                  </h3>
                  <p className="text-sm text-text-muted">
                    This permanently deletes the selected snag cycle and reopens
                    it from scratch.
                  </p>
                </div>
                <button
                  onClick={() => setResetRoundDialog(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border-default text-text-secondary hover:bg-surface-base"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 px-5 py-5">
                <div className="rounded-2xl border border-error/20 bg-error-muted/40 px-4 py-3 text-sm text-error">
                  This is a permanent hard delete.{" "}
                  {resetRoundDialog.laterCycleCount > 0
                    ? `${resetRoundDialog.currentLabel} and ${resetRoundDialog.laterCycleCount} later cycle(s) will be removed.`
                    : "Only this selected cycle will be removed."}{" "}
                  The unit will reopen at {resetRoundDialog.currentLabel}.
                  {resetRoundDialog.rollsBackHandover
                    ? " Final handover release will also be rolled back."
                    : ""}
                </div>
                <textarea
                  value={resetRoundReason}
                  onChange={(event) => setResetRoundReason(event.target.value)}
                  rows={4}
                  placeholder="Reason for deleting and reopening this snag cycle"
                  className="w-full rounded-2xl border border-border-default bg-surface-base px-4 py-3 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={() => void submitResetRound()}
                  disabled={busy || !resetRoundReason.trim()}
                  className="w-full rounded-2xl bg-error px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Permanently Delete This Cycle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteItemDialog && (
        <div className="fixed inset-0 z-[1100] bg-surface-base/80 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-3xl border border-border-default bg-surface-card shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">
                    Delete Snag Item
                  </h3>
                  <p className="text-sm text-text-muted">
                    This will permanently remove the selected snag item and its
                    photo evidence.
                  </p>
                </div>
                <button
                  onClick={() => setDeleteItemDialog(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border-default text-text-secondary hover:bg-surface-base"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 px-5 py-5">
                <div className="rounded-2xl border border-error/20 bg-error-muted/40 px-4 py-3 text-sm text-error">
                  <div className="flex items-start gap-3">
                    <Trash2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <div className="font-semibold">
                        {deleteItemDialog.defectTitle}
                      </div>
                      <div className="mt-1 text-sm">
                        This action cannot be undone.
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => void submitDeleteItem()}
                  disabled={busy}
                  className="w-full rounded-2xl bg-error px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Permanently Delete This Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
