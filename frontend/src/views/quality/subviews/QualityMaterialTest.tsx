import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowUpDown,
  Beaker,
  ClipboardCheck,
  Download,
  FileUp,
  Layers3,
  Maximize2,
  Minimize2,
  PackagePlus,
  Plus,
  RefreshCcw,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { qualityService } from "../../../services/quality.service";
import { getPublicFileUrl } from "../../../api/baseUrl";
import { exportUtils } from "../../../utils/export.utils";
import { useAuth } from "../../../context/AuthContext";
import { PermissionCode } from "../../../config/permissions";
import type {
  QualityMaterialEvidenceFile,
  QualityMaterialItpCheckpoint,
  QualityMaterialItpTemplate,
  QualityMaterialReceipt,
  QualityMaterialTestObligation,
  QualityMaterialTestResult,
  QualityCubeTestRegister,
  QualityConcreteGrade,
} from "../../../types/quality";

interface Props {
  projectId: number;
}

type ModalMode = "itp" | "receipt" | "result" | null;
type TabKey =
  | "itps"
  | "approvals"
  | "receipts"
  | "obligations"
  | "results"
  | "cubes";

const today = () => new Date().toISOString().slice(0, 10);

const emptyCheckpoint = (sequence: number): QualityMaterialItpCheckpoint => ({
  sequence,
  section: "MATERIAL_TEST",
  characteristic: "",
  testSpecification: "",
  verifyingDocument: "LAB_REPORT",
  frequencyType: "EACH_LOT",
  isMandatory: true,
  requiresDocument: true,
  requiresPhotoEvidence: false,
  requiresNumericResult: false,
  requiresLabReport: true,
  minPhotoCount: 0,
  dueOffsetHours: 72,
  expiryWindowDays: 2,
});

const QualityMaterialTest: React.FC<Props> = ({ projectId }) => {
  const { hasPermission } = useAuth();
  const canReadItp = hasPermission(PermissionCode.QUALITY_MATERIAL_ITP_READ);
  const canReadReceipts = hasPermission(
    PermissionCode.QUALITY_MATERIAL_RECEIPT_READ,
  );
  const canReadMaterialTests = hasPermission(
    PermissionCode.QUALITY_MATERIAL_TEST_READ,
  );
  const canReadCubes = hasPermission(PermissionCode.QUALITY_CUBE_TEST_READ);
  const canReadGrades = hasPermission(
    PermissionCode.QUALITY_CONCRETE_GRADE_READ,
  );
  const canReadEvidence = hasPermission(
    PermissionCode.QUALITY_MATERIAL_EVIDENCE_READ,
  );
  const canCreateItp = hasPermission(PermissionCode.QUALITY_MATERIAL_ITP_CREATE);
  const canApproveItp = hasPermission(PermissionCode.QUALITY_MATERIAL_ITP_APPROVE);
  const canCreateReceipt = hasPermission(
    PermissionCode.QUALITY_MATERIAL_RECEIPT_CREATE,
  );
  const canLogMaterialTest = hasPermission(
    PermissionCode.QUALITY_MATERIAL_TEST_LOG,
  );
  const canApproveMaterialTest = hasPermission(
    PermissionCode.QUALITY_MATERIAL_TEST_APPROVE,
  );
  const canCreateCube = hasPermission(PermissionCode.QUALITY_CUBE_TEST_CREATE);
  const canUpdateCube = hasPermission(PermissionCode.QUALITY_CUBE_TEST_UPDATE);
  const canSaveCube = hasPermission(PermissionCode.QUALITY_CUBE_TEST_SAVE);
  const canApproveCube = hasPermission(PermissionCode.QUALITY_CUBE_TEST_APPROVE);
  const canDeleteCube = hasPermission(PermissionCode.QUALITY_CUBE_TEST_DELETE);
  const canCreateGrade = hasPermission(
    PermissionCode.QUALITY_CONCRETE_GRADE_CREATE,
  );
  const canUpdateGrade = hasPermission(
    PermissionCode.QUALITY_CONCRETE_GRADE_UPDATE,
  );
  const canDeleteGrade = hasPermission(
    PermissionCode.QUALITY_CONCRETE_GRADE_DELETE,
  );
  const canUploadEvidence = hasPermission(
    PermissionCode.QUALITY_MATERIAL_EVIDENCE_UPLOAD,
  );
  const [activeTab, setActiveTab] = useState<TabKey>("itps");
  const [templates, setTemplates] = useState<QualityMaterialItpTemplate[]>([]);
  const [receipts, setReceipts] = useState<QualityMaterialReceipt[]>([]);
  const [obligations, setObligations] = useState<QualityMaterialTestObligation[]>([]);
  const [results, setResults] = useState<QualityMaterialTestResult[]>([]);
  const [cubeRegister, setCubeRegister] = useState<QualityCubeTestRegister[]>([]);
  const [cubeEvidence, setCubeEvidence] = useState<Record<number, QualityMaterialEvidenceFile[]>>({});
  const [concreteGrades, setConcreteGrades] = useState<QualityConcreteGrade[]>([]);
  const [gradeSettingsOpen, setGradeSettingsOpen] = useState(false);
  const [cubeFullscreen, setCubeFullscreen] = useState(false);
  const [uploadingCubeEvidenceId, setUploadingCubeEvidenceId] = useState<number | null>(null);
  const [cubeDateFrom, setCubeDateFrom] = useState("");
  const [cubeDateTo, setCubeDateTo] = useState("");
  const [cubeSearch, setCubeSearch] = useState("");
  const [cubeStatusFilter, setCubeStatusFilter] = useState("ALL");
  const [cubeAgeFilter, setCubeAgeFilter] = useState("ALL");
  const [cubeSort, setCubeSort] = useState<{
    key: keyof QualityCubeTestRegister;
    direction: "asc" | "desc";
  }>({ key: "dueDate", direction: "asc" });
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedObligation, setSelectedObligation] =
    useState<QualityMaterialTestObligation | null>(null);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [itpForm, setItpForm] = useState({
    materialName: "",
    materialCode: "",
    itpNo: "",
    revNo: "01",
    title: "",
    description: "",
    checkpoints: [emptyCheckpoint(1)],
  });

  const [receiptForm, setReceiptForm] = useState({
    itpTemplateId: "",
    materialName: "",
    materialCode: "",
    brand: "",
    grade: "",
    supplier: "",
    manufacturer: "",
    batchNumber: "",
    challanNumber: "",
    quantity: "",
    uom: "MT",
    receivedDate: today(),
    manufactureDate: "",
  });

  const [resultForm, setResultForm] = useState({
    testDate: today(),
    testedByName: "",
    labType: "SITE",
    numericValue: "",
    textValue: "",
    result: "PENDING_REVIEW",
    remarks: "",
  });

  const [gradeForm, setGradeForm] = useState({
    grade: "",
    targetMeanStrengthMpa: "",
    characteristicStrengthMpa: "",
    mixRatio: "",
    slumpRangeMm: "",
    waterCementRatio: "",
    cementContentKgM3: "",
    remarks: "",
  });

  const activeTemplates = useMemo(
    () => templates.filter((item) => item.status === "ACTIVE"),
    [templates],
  );

  const stats = useMemo(() => {
    const due = obligations.filter((item) =>
      ["PENDING", "DUE_SOON", "OVERDUE"].includes(item.status),
    );
    const templateApprovals = templates.filter(
      (item) => item.approvalRun?.status === "IN_PROGRESS",
    ).length;
    const resultApprovals = results.filter(
      (item) => item.approvalRun?.status === "IN_PROGRESS",
    ).length;
    const dueCubes = cubeRegister.filter((item) =>
      ["PENDING", "DUE_TODAY", "OVERDUE"].includes(item.status),
    ).length;
    return {
      activeItps: activeTemplates.length,
      pendingTests: due.length + dueCubes,
      overdue:
        obligations.filter((item) => item.status === "OVERDUE").length +
        cubeRegister.filter((item) => item.status === "OVERDUE").length,
      approvals: templateApprovals + resultApprovals,
    };
  }, [activeTemplates.length, cubeRegister, obligations, results, templates]);

  const approvalItems = useMemo(
    () => [
      ...templates
        .filter((template) => template.approvalRun)
        .map((template) => ({
          kind: "ITP" as const,
          id: template.id,
          title: template.materialName,
          subtitle: `${template.itpNo} Rev ${template.revNo}`,
          status: template.approvalRun?.status || template.approvalStatus,
          run: template.approvalRun!,
        })),
      ...results
        .filter((result) => result.approvalRun)
        .map((result) => ({
          kind: "RESULT" as const,
          id: result.id,
          title: result.obligation?.materialName || "Material test result",
          subtitle: result.checkpoint?.characteristic || result.testDate,
          status: result.approvalRun?.status || result.reviewStatus,
          run: result.approvalRun!,
        })),
    ],
    [templates, results],
  );

  const filteredCubeRegister = useMemo(() => {
    const query = cubeSearch.trim().toLowerCase();
    const rows = cubeRegister.filter((cube) => {
      const matchesStatus =
        cubeStatusFilter === "ALL" ||
        (cubeStatusFilter === "DUE_FOR_TESTING"
          ? ["PENDING", "DUE_TODAY", "OVERDUE"].includes(cube.status) &&
            cube.dueDate <= today()
          : cube.status === cubeStatusFilter);
      const matchesAge = cubeAgeFilter === "ALL" || cube.testAge === cubeAgeFilter;
      const matchesDateFrom = !cubeDateFrom || cube.dueDate >= cubeDateFrom;
      const matchesDateTo = !cubeDateTo || cube.dueDate <= cubeDateTo;
      const haystack = [
        cube.cubeId,
        cube.locationText,
        cube.elementName,
        cube.goLabel,
        cube.goDetails,
        cube.mixIdOrGrade,
        cube.truckNo,
        cube.deliveryChallanNo,
        cube.inspectionId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        matchesStatus &&
        matchesAge &&
        matchesDateFrom &&
        matchesDateTo &&
        (!query || haystack.includes(query))
      );
    });
    return [...rows].sort((left, right) => {
      const leftValue = left[cubeSort.key] ?? "";
      const rightValue = right[cubeSort.key] ?? "";
      const comparison = String(leftValue).localeCompare(String(rightValue), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return cubeSort.direction === "asc" ? comparison : -comparison;
    });
  }, [
    cubeAgeFilter,
    cubeDateFrom,
    cubeDateTo,
    cubeRegister,
    cubeSearch,
    cubeSort,
    cubeStatusFilter,
  ]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        nextTemplates,
        nextReceipts,
        nextObligations,
        nextResults,
        nextCubeRegister,
        nextConcreteGrades,
        nextCubeEvidence,
      ] =
        await Promise.all([
          canReadItp
            ? qualityService.getMaterialItps(projectId)
            : Promise.resolve([]),
          canReadReceipts
            ? qualityService.getMaterialReceipts(projectId)
            : Promise.resolve([]),
          canReadMaterialTests
            ? qualityService.getMaterialTestObligations(projectId)
            : Promise.resolve([]),
          canReadMaterialTests
            ? qualityService.getMaterialTestResults(projectId)
            : Promise.resolve([]),
          canReadCubes
            ? qualityService.getCubeTestRegister(projectId)
            : Promise.resolve([]),
          canReadGrades
            ? qualityService.getConcreteGrades(projectId)
            : Promise.resolve([]),
          canReadEvidence
            ? qualityService.getMaterialEvidence(projectId, "CUBE_TEST")
            : Promise.resolve([]),
        ]);
      setTemplates(nextTemplates);
      setReceipts(nextReceipts);
      setObligations(nextObligations);
      setResults(nextResults);
      setCubeRegister(nextCubeRegister);
      setCubeEvidence(
        nextCubeEvidence.reduce<Record<number, QualityMaterialEvidenceFile[]>>((acc, item) => {
          const ownerId = Number(item.ownerId);
          if (!ownerId) return acc;
          acc[ownerId] = [...(acc[ownerId] || []), item];
          return acc;
        }, {}),
      );
      setConcreteGrades(nextConcreteGrades);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to load material ITP data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [projectId]);

  const createItp = async (event: React.FormEvent) => {
    event.preventDefault();
    await qualityService.createMaterialItp(projectId, {
      ...itpForm,
      checkpoints: itpForm.checkpoints.filter((item) => item.characteristic.trim()),
    } as any);
    closeModal();
    refresh();
  };

  const createReceipt = async (event: React.FormEvent) => {
    event.preventDefault();
    await qualityService.createMaterialReceipt(projectId, {
      ...receiptForm,
      itpTemplateId: Number(receiptForm.itpTemplateId),
    } as any);
    closeModal();
    setActiveTab("obligations");
    refresh();
  };

  const createResult = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedObligation) return;
    const created = await qualityService.createMaterialTestResult(
      selectedObligation.id,
      resultForm as any,
    );
    if (evidenceFile && canUploadEvidence) {
      const formData = new FormData();
      formData.append("file", evidenceFile);
      formData.append("ownerType", "RESULT");
      formData.append("ownerId", String(created.id));
      formData.append("evidenceType", evidenceFile.type.startsWith("image/") ? "PHOTO" : "LAB_REPORT");
      await qualityService.uploadMaterialEvidence(projectId, formData);
    }
    closeModal();
    setActiveTab("results");
    refresh();
  };

  const submitTemplate = async (templateId: number) => {
    await qualityService.submitMaterialItpApproval(templateId);
    refresh();
  };

  const activateTemplate = async (templateId: number) => {
    await qualityService.activateMaterialItp(templateId);
    refresh();
  };

  const submitResult = async (resultId: number) => {
    await qualityService.submitMaterialTestResultApproval(resultId);
    refresh();
  };

  const actOnApproval = async (
    kind: "ITP" | "RESULT",
    documentId: number,
    stepId: number,
    action: "approve" | "reject",
  ) => {
    const comments =
      action === "reject" ? window.prompt("Rejection comments") || "" : "";
    if (action === "reject" && !comments.trim()) return;
    if (kind === "ITP") {
      if (action === "approve") {
        await qualityService.approveMaterialItpStep(documentId, stepId);
      } else {
        await qualityService.rejectMaterialItpStep(documentId, stepId, comments);
      }
    } else if (action === "approve") {
      await qualityService.approveMaterialTestResultStep(documentId, stepId);
    } else {
      await qualityService.rejectMaterialTestResultStep(documentId, stepId, comments);
    }
    refresh();
  };

  const updateCheckpoint = (
    index: number,
    patch: Partial<QualityMaterialItpCheckpoint>,
  ) => {
    setItpForm((current) => ({
      ...current,
      checkpoints: current.checkpoints.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  };

  const updateCubeDraft = (
    id: number,
    patch: Partial<QualityCubeTestRegister>,
  ) => {
    setCubeRegister((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const saveCubeResult = async (
    cube: QualityCubeTestRegister,
    approve = false,
  ) => {
    const payload = {
      specimenSize: cube.specimenSize || "150 x 150 x 150 mm",
      loadKn: cube.loadKn,
      requiredStrengthMpa: cube.requiredStrengthMpa,
      testedDate: cube.testedDate || today(),
      remarks: cube.remarks,
      status: approve ? "APPROVED" : "TESTED",
    } as Partial<QualityCubeTestRegister>;
    const updated = approve
      ? await qualityService.approveCubeTestRegister(cube.id, payload)
      : await qualityService.updateCubeTestRegister(cube.id, payload);
    setCubeRegister((current) =>
      current.map((item) => (item.id === cube.id ? updated : item)),
    );
  };

  const deleteCubeResult = async (cubeId: number) => {
    if (!confirm("Delete this cube test register row?")) return;
    await qualityService.deleteCubeTestRegister(cubeId);
    setCubeRegister((current) => current.filter((item) => item.id !== cubeId));
  };

  const uploadCubeEvidence = async (
    cube: QualityCubeTestRegister,
    file?: File | null,
  ) => {
    if (!file) return;
    setUploadingCubeEvidenceId(cube.id);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("ownerType", "CUBE_TEST");
      formData.append("ownerId", String(cube.id));
      formData.append("evidenceType", file.type.startsWith("image/") ? "PHOTO" : "LAB_REPORT");
      formData.append("description", `Cube failure evidence for ${cube.cubeId}`);
      const uploaded = await qualityService.uploadMaterialEvidence(projectId, formData);
      setCubeEvidence((current) => ({
        ...current,
        [cube.id]: [uploaded, ...(current[cube.id] || [])],
      }));
    } finally {
      setUploadingCubeEvidenceId(null);
    }
  };

  const showDueForTesting = () => {
    setActiveTab("cubes");
    setCubeStatusFilter("DUE_FOR_TESTING");
    setCubeAgeFilter("ALL");
    setCubeDateFrom("");
    setCubeDateTo(today());
  };

  const saveConcreteGrade = async (event: React.FormEvent) => {
    event.preventDefault();
    const created = await qualityService.createConcreteGrade(projectId, {
      ...gradeForm,
      isActive: true,
    } as any);
    setConcreteGrades((current) => [...current, created].sort((a, b) => a.grade.localeCompare(b.grade, undefined, { numeric: true })));
    setGradeForm({
      grade: "",
      targetMeanStrengthMpa: "",
      characteristicStrengthMpa: "",
      mixRatio: "",
      slumpRangeMm: "",
      waterCementRatio: "",
      cementContentKgM3: "",
      remarks: "",
    });
  };

  const toggleConcreteGrade = async (grade: QualityConcreteGrade) => {
    const updated = await qualityService.updateConcreteGrade(grade.id, {
      isActive: !grade.isActive,
    });
    setConcreteGrades((current) =>
      current.map((item) => (item.id === grade.id ? updated : item)),
    );
  };

  const deleteConcreteGrade = async (id: number) => {
    if (!confirm("Delete this concrete grade setting?")) return;
    await qualityService.deleteConcreteGrade(id);
    setConcreteGrades((current) => current.filter((item) => item.id !== id));
  };

  const exportCubeRegister = () => {
    exportUtils.toExcel(
      filteredCubeRegister.map((cube) => ({
        cubeId: cube.cubeId,
        status: cube.status,
        testAge: cube.testAge,
        castDate: cube.castDate,
        dueDate: cube.dueDate,
        inspectionId: cube.inspectionId,
        goLabel: cube.goLabel,
        locationText: cube.locationText,
        elementName: cube.elementName,
        mixIdOrGrade: cube.mixIdOrGrade,
        truckNo: cube.truckNo,
        deliveryChallanNo: cube.deliveryChallanNo,
        loadKn: cube.loadKn,
        compressiveStrengthMpa: cube.compressiveStrengthMpa,
        requiredStrengthMpa: cube.requiredStrengthMpa,
        testedDate: cube.testedDate,
        testedByName: cube.testedByName,
        witnessedByName: cube.witnessedByName,
        remarks: cube.remarks,
      })),
      `cube-test-register-${cubeDateFrom || "all"}-${cubeDateTo || "all"}`,
      {
        sheetName: "Cube Test Register",
        columns: [
          { key: "cubeId", label: "Cube ID" },
          { key: "status", label: "Status" },
          { key: "testAge", label: "Age" },
          { key: "castDate", label: "Cast Date" },
          { key: "dueDate", label: "Due Date" },
          { key: "inspectionId", label: "RFI" },
          { key: "goLabel", label: "GO" },
          { key: "locationText", label: "Location" },
          { key: "elementName", label: "Element" },
          { key: "mixIdOrGrade", label: "Grade" },
          { key: "truckNo", label: "Truck" },
          { key: "deliveryChallanNo", label: "Challan" },
          { key: "loadKn", label: "Load kN" },
          { key: "compressiveStrengthMpa", label: "Compressive Strength MPa" },
          { key: "requiredStrengthMpa", label: "Required MPa" },
          { key: "testedDate", label: "Tested Date" },
          { key: "testedByName", label: "Tested By" },
          { key: "witnessedByName", label: "Witnessed By" },
          { key: "remarks", label: "Remarks" },
        ],
      },
    );
  };

  const addManualCubeRow = async () => {
    const created = await qualityService.createCubeTestRegister(projectId, {
      testAge: "7_DAY",
      castDate: today(),
      dueDate: today(),
      specimenSize: "150 x 150 x 150 mm",
      status: "PENDING",
    });
    setCubeRegister((current) => [created, ...current]);
    setActiveTab("cubes");
  };

  const sortCubeColumn = (key: keyof QualityCubeTestRegister) => {
    setCubeSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedObligation(null);
    setEvidenceFile(null);
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h3 className="text-xl font-bold text-text-primary">Material ITP and Testing</h3>
          <p className="text-sm text-text-muted">
            Define approved material inspection plans, receive material lots, and track due testing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-raised"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={showDueForTesting}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
          >
            <AlertTriangle className="h-4 w-4" />
            Due for Testing
          </button>
          {canCreateReceipt && (
            <button
              onClick={() => setModalMode("receipt")}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <PackagePlus className="h-4 w-4" />
              Material Receipt
            </button>
          )}
          {canCreateItp && (
            <button
              onClick={() => setModalMode("itp")}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700"
            >
              <Plus className="h-4 w-4" />
              ITP Template
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active ITPs" value={stats.activeItps} icon={<ClipboardCheck />} />
        <Stat label="Pending Tests" value={stats.pendingTests} icon={<Beaker />} />
        <Stat label="Overdue" value={stats.overdue} icon={<AlertTriangle />} danger />
        <Stat label="In Approval" value={stats.approvals} icon={<ShieldCheck />} />
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-border-subtle">
        {[
          ["itps", "ITP Templates"],
          ["approvals", "Approval Panel"],
          ["receipts", "Material Receipts"],
          ["obligations", "Due Tests"],
          ["results", "Test Results"],
          ["cubes", "Cube Test Register"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as TabKey)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold ${
              activeTab === key
                ? "border-orange-600 text-orange-700"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="text-sm text-text-muted">Loading material quality data...</div>}

      {activeTab === "itps" && (
        <div className="space-y-4">
          <ApprovalPanel
            items={approvalItems}
            onAction={actOnApproval}
            canAct={(kind) =>
              kind === "ITP" ? canApproveItp : canApproveMaterialTest
            }
            compact
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {templates.map((template) => (
              <div key={template.id} className="rounded-lg border border-border-subtle bg-surface-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase text-text-disabled">
                      {template.itpNo} Rev {template.revNo}
                    </div>
                    <h4 className="mt-1 text-lg font-bold text-text-primary">{template.materialName}</h4>
                    <p className="text-sm text-text-muted">{template.title}</p>
                  </div>
                  <StatusBadge value={template.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-text-muted">
                  <span>{template.checkpoints?.length || 0} checkpoints</span>
                  <span>Approval: {template.approvalStatus}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {template.status === "DRAFT" && canApproveItp && (
                    <button
                      onClick={() => submitTemplate(template.id)}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-900"
                    >
                      Submit Approval
                    </button>
                  )}
                  {template.status === "APPROVED" && canApproveItp && (
                    <button
                      onClick={() => activateTemplate(template.id)}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "approvals" && (
        <ApprovalPanel
          items={approvalItems}
          onAction={actOnApproval}
          canAct={(kind) =>
            kind === "ITP" ? canApproveItp : canApproveMaterialTest
          }
        />
      )}

      {activeTab === "receipts" && (
        <Table
          headers={["Material", "Batch", "Supplier", "Received", "Status"]}
          rows={receipts.map((receipt) => [
            receipt.materialName,
            receipt.batchNumber,
            receipt.supplier || "-",
            receipt.receivedDate,
            receipt.status,
          ])}
        />
      )}

      {activeTab === "obligations" && (
        <div className="space-y-3">
          {obligations.map((obligation) => (
            <div key={obligation.id} className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-bold text-text-primary">{obligation.materialName}</h4>
                  <StatusBadge value={obligation.status} />
                </div>
                <p className="mt-1 text-sm text-text-muted">
                  {obligation.checkpoint?.characteristic || obligation.reason}
                </p>
                <p className="mt-1 text-xs font-semibold text-text-disabled">
                  Due {obligation.dueDate || "-"} | Batch {obligation.receipt?.batchNumber || "-"}
                </p>
              </div>
              {!["COMPLETED", "RESULT_LOGGED"].includes(obligation.status) &&
                canLogMaterialTest && (
                <button
                  onClick={() => {
                    setSelectedObligation(obligation);
                    setModalMode("result");
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700"
                >
                  <Beaker className="h-4 w-4" />
                  Log Result
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === "results" && (
        <div className="space-y-3">
          {results.map((result) => (
            <div key={result.id} className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-bold text-text-primary">
                    {result.obligation?.materialName || "Material Test"}
                  </h4>
                  <StatusBadge value={result.result} />
                  <StatusBadge value={result.reviewStatus} />
                </div>
                <p className="mt-1 text-sm text-text-muted">
                  {result.checkpoint?.characteristic || "ITP checkpoint"}
                </p>
                <p className="mt-1 text-xs font-semibold text-text-disabled">
                  Tested {result.testDate} | {result.labType}
                </p>
              </div>
              {result.reviewStatus === "DRAFT" && canApproveMaterialTest && (
                <button
                  onClick={() => submitResult(result.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900"
                >
                  <Send className="h-4 w-4" />
                  Submit Approval
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === "cubes" && (
        <div
          className={
            cubeFullscreen
              ? "fixed inset-0 z-[9999] isolate overflow-auto bg-white p-4 text-text-primary shadow-2xl"
              : "space-y-3"
          }
        >
          {cubeFullscreen && (
            <div className="sticky top-0 z-30 mb-4 flex items-center justify-between border-b border-border-subtle bg-white px-1 py-3">
              <div>
                <div className="text-lg font-bold text-text-primary">
                  Cube Test Register
                </div>
                <div className="text-xs text-text-muted">
                  Fullscreen testing workspace
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCubeFullscreen(false)}
                className="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm font-bold text-text-secondary shadow-sm hover:bg-surface-raised"
              >
                <Minimize2 className="h-4 w-4" />
                Exit Fullscreen
              </button>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            <Stat
              label="Pending for Testing"
              value={cubeRegister.filter((item) => item.status === "PENDING").length}
              icon={<Beaker />}
            />
            <Stat
              label="Due Today"
              value={cubeRegister.filter((item) => item.status === "DUE_TODAY").length}
              icon={<AlertTriangle />}
            />
            <Stat
              label="7 / 28 Day Tests"
              value={cubeRegister.length}
              icon={<ClipboardCheck />}
            />
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface-card p-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="grid flex-1 gap-2 md:grid-cols-[minmax(220px,1fr)_160px_140px_140px_140px]">
                <input
                  value={cubeSearch}
                  onChange={(event) => setCubeSearch(event.target.value)}
                  placeholder="Search cube, RFI, GO, location, grade, truck, challan"
                  className="rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm"
                />
                <select
                  value={cubeStatusFilter}
                  onChange={(event) => setCubeStatusFilter(event.target.value)}
                  className="rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm"
                >
                  {[
                    "ALL",
                    "DUE_FOR_TESTING",
                    "PENDING",
                    "DUE_TODAY",
                    "OVERDUE",
                    "TESTED",
                    "PASSED",
                    "NEEDS_ATTENTION",
                    "APPROVED",
                    "FAILED",
                  ].map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <select
                  value={cubeAgeFilter}
                  onChange={(event) => setCubeAgeFilter(event.target.value)}
                  className="rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm"
                >
                  <option value="ALL">All Ages</option>
                  <option value="7_DAY">7 Day</option>
                  <option value="28_DAY">28 Day</option>
                </select>
                <input
                  type="date"
                  value={cubeDateFrom}
                  onChange={(event) => setCubeDateFrom(event.target.value)}
                  className="rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm"
                  title="Due date from"
                />
                <input
                  type="date"
                  value={cubeDateTo}
                  onChange={(event) => setCubeDateTo(event.target.value)}
                  className="rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm"
                  title="Due date to"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(canCreateGrade || canUpdateGrade || canDeleteGrade) && (
                  <button
                    type="button"
                    onClick={() => setGradeSettingsOpen((current) => !current)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm font-bold text-text-secondary hover:bg-surface-raised"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Grade Settings
                  </button>
                )}
                <button
                  type="button"
                  onClick={exportCubeRegister}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm font-bold text-text-secondary hover:bg-surface-raised"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
                {canCreateCube && (
                  <button
                    type="button"
                    onClick={addManualCubeRow}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm font-bold text-text-secondary hover:bg-surface-raised"
                  >
                    <Plus className="h-4 w-4" />
                    Manual Cube
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCubeFullscreen((current) => !current)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm font-bold text-text-secondary hover:bg-surface-raised"
                >
                  {cubeFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                  {cubeFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                </button>
              </div>
            </div>
            {gradeSettingsOpen && (
              <div className="mt-4 rounded-lg border border-border-subtle bg-surface-base p-3">
                {canCreateGrade && (
                <form onSubmit={saveConcreteGrade} className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
                  <input
                    required
                    value={gradeForm.grade}
                    onChange={(event) => setGradeForm((current) => ({ ...current, grade: event.target.value }))}
                    placeholder="Grade M25"
                    className="rounded border border-border-subtle bg-surface-card px-2 py-1 text-xs"
                  />
                  <input
                    type="number"
                    value={gradeForm.targetMeanStrengthMpa}
                    onChange={(event) => setGradeForm((current) => ({ ...current, targetMeanStrengthMpa: event.target.value }))}
                    placeholder="Target MPa"
                    className="rounded border border-border-subtle bg-surface-card px-2 py-1 text-xs"
                  />
                  <input
                    type="number"
                    value={gradeForm.characteristicStrengthMpa}
                    onChange={(event) => setGradeForm((current) => ({ ...current, characteristicStrengthMpa: event.target.value }))}
                    placeholder="Char. MPa"
                    className="rounded border border-border-subtle bg-surface-card px-2 py-1 text-xs"
                  />
                  <input
                    value={gradeForm.mixRatio}
                    onChange={(event) => setGradeForm((current) => ({ ...current, mixRatio: event.target.value }))}
                    placeholder="Mix ratio"
                    className="rounded border border-border-subtle bg-surface-card px-2 py-1 text-xs"
                  />
                  <input
                    value={gradeForm.slumpRangeMm}
                    onChange={(event) => setGradeForm((current) => ({ ...current, slumpRangeMm: event.target.value }))}
                    placeholder="Slump mm"
                    className="rounded border border-border-subtle bg-surface-card px-2 py-1 text-xs"
                  />
                  <input
                    type="number"
                    value={gradeForm.waterCementRatio}
                    onChange={(event) => setGradeForm((current) => ({ ...current, waterCementRatio: event.target.value }))}
                    placeholder="W/C"
                    className="rounded border border-border-subtle bg-surface-card px-2 py-1 text-xs"
                  />
                  <input
                    type="number"
                    value={gradeForm.cementContentKgM3}
                    onChange={(event) => setGradeForm((current) => ({ ...current, cementContentKgM3: event.target.value }))}
                    placeholder="Cement kg/m3"
                    className="rounded border border-border-subtle bg-surface-card px-2 py-1 text-xs"
                  />
                  <button
                    type="submit"
                    className="rounded bg-orange-600 px-3 py-1 text-xs font-bold text-white hover:bg-orange-700"
                  >
                    Add Grade
                  </button>
                </form>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {concreteGrades.map((grade) => (
                    <span
                      key={grade.id}
                      className={`inline-flex items-center gap-2 rounded border px-2 py-1 text-xs ${
                        grade.isActive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-border-subtle bg-surface-card text-text-muted"
                      }`}
                    >
                      <strong>{grade.grade}</strong>
                      {grade.targetMeanStrengthMpa && <span>TMS {grade.targetMeanStrengthMpa} MPa</span>}
                      {grade.mixRatio && <span>{grade.mixRatio}</span>}
                      {canUpdateGrade && (
                        <button type="button" onClick={() => toggleConcreteGrade(grade)} className="font-bold">
                          {grade.isActive ? "Disable" : "Enable"}
                        </button>
                      )}
                      {canDeleteGrade && (
                        <button type="button" onClick={() => deleteConcreteGrade(grade.id)} className="text-red-700">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[1720px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border-subtle text-text-muted">
                    {[
                      ["cubeId", "Cube ID"],
                      ["status", "Status"],
                      ["testAge", "Age"],
                      ["dueDate", "Due"],
                      ["castDate", "Cast"],
                      ["locationText", "Location / Trace"],
                      ["mixIdOrGrade", "Grade"],
                      ["loadKn", "Load kN"],
                      ["compressiveStrengthMpa", "MPa"],
                      ["requiredStrengthMpa", "Req MPa"],
                      ["testedDate", "Tested"],
                    ].map(([key, label]) => (
                      <th key={key} className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => sortCubeColumn(key as keyof QualityCubeTestRegister)}
                          className="inline-flex items-center gap-1 font-bold"
                        >
                          {label}
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-right">Actions</th>
                    <th className="px-2 py-2">Tested By</th>
                    <th className="px-2 py-2">Witnessed By</th>
                    <th className="px-2 py-2">Remarks</th>
                    <th className="px-2 py-2">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCubeRegister.map((cube) => (
                    <tr key={cube.id} className="border-b border-border-subtle align-top hover:bg-surface-base">
                      <td className="px-2 py-2 font-bold text-text-primary">{cube.cubeId}</td>
                      <td className="px-2 py-2"><StatusBadge value={cube.status} /></td>
                      <td className="px-2 py-2">{cube.testAge.replace("_", " ")}</td>
                      <td className="px-2 py-2">{cube.dueDate}</td>
                      <td className="px-2 py-2">{cube.castDate}</td>
                      <td className="px-2 py-2">
                        <div className="font-semibold text-text-primary">
                          {cube.locationText || "-"}
                        </div>
                        <div className="text-text-muted">
                          {cube.elementName || "-"} | {cube.goLabel || "-"} | RFI #{cube.inspectionId || "-"}
                        </div>
                        {cube.goDetails && <div className="mt-1 text-text-disabled">{cube.goDetails}</div>}
                      </td>
                      <td className="px-2 py-2">
                        <div>{cube.mixIdOrGrade || "-"}</div>
                        <div className="text-text-muted">Truck {cube.truckNo || "-"} | Challan {cube.deliveryChallanNo || "-"}</div>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={cube.loadKn || ""}
                          disabled={!canUpdateCube}
                          onChange={(event) => updateCubeDraft(cube.id, { loadKn: event.target.value })}
                          className="w-24 rounded border border-border-subtle bg-surface-base px-2 py-1"
                        />
                      </td>
                      <td className="px-2 py-2 font-bold">{cube.compressiveStrengthMpa || "Auto"}</td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={cube.requiredStrengthMpa || ""}
                          disabled={!canUpdateCube}
                          onChange={(event) => updateCubeDraft(cube.id, { requiredStrengthMpa: event.target.value })}
                          className="w-24 rounded border border-border-subtle bg-surface-base px-2 py-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="date"
                          value={cube.testedDate || today()}
                          disabled={!canUpdateCube}
                          onChange={(event) => updateCubeDraft(cube.id, { testedDate: event.target.value })}
                          className="w-32 rounded border border-border-subtle bg-surface-base px-2 py-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex justify-end gap-1">
                          {(canUpdateCube || canSaveCube) && (
                            <button
                              type="button"
                              onClick={() => saveCubeResult(cube)}
                              className="rounded bg-orange-600 px-2 py-1 font-bold text-white hover:bg-orange-700"
                            >
                              Save
                            </button>
                          )}
                          {canApproveCube && (
                            <button
                              type="button"
                              onClick={() => saveCubeResult(cube, true)}
                              disabled={cube.status === "APPROVED"}
                              className={`rounded px-2 py-1 font-bold ${
                                cube.status === "APPROVED"
                                  ? "cursor-not-allowed bg-gray-300 text-gray-600"
                                  : "bg-emerald-600 text-white hover:bg-emerald-700"
                              }`}
                            >
                              {cube.status === "APPROVED" ? "Approved" : "Approve"}
                            </button>
                          )}
                          {canDeleteCube && (
                            <button
                              type="button"
                              onClick={() => deleteCubeResult(cube.id)}
                              className="rounded border border-red-200 bg-red-50 px-2 py-1 font-bold text-red-700 hover:bg-red-100"
                              title="Delete cube row"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="w-32 rounded border border-border-subtle bg-surface-raised px-2 py-1 text-text-muted">
                          {cube.testedByName || "Auto on save"}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="w-32 rounded border border-border-subtle bg-surface-raised px-2 py-1 text-text-muted">
                          {cube.witnessedByName || "Auto on approve"}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={cube.remarks || ""}
                          disabled={!canUpdateCube}
                          onChange={(event) => updateCubeDraft(cube.id, { remarks: event.target.value })}
                          className="w-48 rounded border border-border-subtle bg-surface-base px-2 py-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div className="w-40 space-y-1">
                          {(cubeEvidence[cube.id] || []).length > 0 && (
                            <a
                              href={getPublicFileUrl((cubeEvidence[cube.id] || [])[0].relativeUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-xs font-semibold text-secondary hover:underline"
                            >
                              Evidence {(cubeEvidence[cube.id] || []).length}
                            </a>
                          )}
                          {cube.status === "FAILED" && canUploadEvidence && (
                            <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 font-bold text-red-700 hover:bg-red-100">
                              <FileUp className="h-3.5 w-3.5" />
                              {uploadingCubeEvidenceId === cube.id ? "Uploading" : "Upload"}
                              <input
                                type="file"
                                className="hidden"
                                onChange={(event) => {
                                  uploadCubeEvidence(cube, event.target.files?.[0] || null);
                                  event.currentTarget.value = "";
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {!filteredCubeRegister.length && (
            <div className="rounded-lg border border-dashed border-border-subtle bg-surface-card p-5 text-sm text-text-muted">
              No cube tests match the current filters. Approved pour cards with
              cube counts populate this register automatically.
            </div>
          )}
        </div>
      )}

      {modalMode &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-surface-overlay px-4 py-8 backdrop-blur-sm">
            <div className="w-full max-w-4xl overflow-hidden rounded-lg bg-surface-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-border-subtle bg-surface-base px-5 py-4">
                <h3 className="flex items-center gap-2 text-lg font-bold text-text-primary">
                  {modalMode === "itp" && <Layers3 className="h-5 w-5 text-orange-600" />}
                  {modalMode === "receipt" && <PackagePlus className="h-5 w-5 text-emerald-600" />}
                  {modalMode === "result" && <Beaker className="h-5 w-5 text-orange-600" />}
                  {modalMode === "itp" && "Create Material ITP"}
                  {modalMode === "receipt" && "Log Material Receipt"}
                  {modalMode === "result" && "Log Test Result"}
                </h3>
                <button onClick={closeModal} className="rounded-lg p-2 hover:bg-surface-raised">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {modalMode === "itp" && (
                <form onSubmit={createItp} className="space-y-4 p-5">
                  <div className="grid gap-3 md:grid-cols-3">
                    <TextInput label="Material" value={itpForm.materialName} onChange={(value) => setItpForm({ ...itpForm, materialName: value })} required />
                    <TextInput label="Material Code" value={itpForm.materialCode} onChange={(value) => setItpForm({ ...itpForm, materialCode: value })} />
                    <TextInput label="ITP No." value={itpForm.itpNo} onChange={(value) => setItpForm({ ...itpForm, itpNo: value })} required />
                    <TextInput label="Revision" value={itpForm.revNo} onChange={(value) => setItpForm({ ...itpForm, revNo: value })} />
                    <div className="md:col-span-2">
                      <TextInput label="Title" value={itpForm.title} onChange={(value) => setItpForm({ ...itpForm, title: value })} required />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {itpForm.checkpoints.map((checkpoint, index) => (
                      <div key={index} className="rounded-lg border border-border-subtle p-3">
                        <div className="grid gap-3 md:grid-cols-4">
                          <TextInput label="Checkpoint" value={checkpoint.characteristic} onChange={(value) => updateCheckpoint(index, { characteristic: value })} required />
                          <TextInput label="Specification" value={checkpoint.testSpecification || ""} onChange={(value) => updateCheckpoint(index, { testSpecification: value })} />
                          <TextInput label="Frequency" value={checkpoint.frequencyType || ""} onChange={(value) => updateCheckpoint(index, { frequencyType: value })} />
                          <TextInput label="Due Hours" type="number" value={String(checkpoint.dueOffsetHours || "")} onChange={(value) => updateCheckpoint(index, { dueOffsetHours: Number(value || 0) })} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold text-text-secondary">
                          <CheckBox label="Document" checked={Boolean(checkpoint.requiresDocument)} onChange={(checked) => updateCheckpoint(index, { requiresDocument: checked })} />
                          <CheckBox label="Photo" checked={Boolean(checkpoint.requiresPhotoEvidence)} onChange={(checked) => updateCheckpoint(index, { requiresPhotoEvidence: checked })} />
                          <CheckBox label="Numeric Result" checked={Boolean(checkpoint.requiresNumericResult)} onChange={(checked) => updateCheckpoint(index, { requiresNumericResult: checked })} />
                          <CheckBox label="Mandatory" checked={Boolean(checkpoint.isMandatory)} onChange={(checked) => updateCheckpoint(index, { isMandatory: checked })} />
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setItpForm((current) => ({
                          ...current,
                          checkpoints: [
                            ...current.checkpoints,
                            emptyCheckpoint(current.checkpoints.length + 1),
                          ],
                        }))
                      }
                      className="rounded-lg border border-border-subtle px-3 py-2 text-sm font-bold text-text-secondary hover:bg-surface-raised"
                    >
                      Add Checkpoint
                    </button>
                  </div>
                  <ModalActions onCancel={closeModal} submitLabel="Save ITP" />
                </form>
              )}
              {modalMode === "receipt" && (
                <form onSubmit={createReceipt} className="space-y-4 p-5">
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="block text-sm font-bold text-text-secondary">
                      ITP Template
                      <select
                        required
                        className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm"
                        value={receiptForm.itpTemplateId}
                        onChange={(event) => {
                          const template = templates.find((item) => item.id === Number(event.target.value));
                          setReceiptForm({
                            ...receiptForm,
                            itpTemplateId: event.target.value,
                            materialName: template?.materialName || receiptForm.materialName,
                            materialCode: template?.materialCode || receiptForm.materialCode,
                          });
                        }}
                      >
                        <option value="">Select active ITP</option>
                        {activeTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.materialName} | {template.itpNo}
                          </option>
                        ))}
                      </select>
                    </label>
                    <TextInput label="Material" value={receiptForm.materialName} onChange={(value) => setReceiptForm({ ...receiptForm, materialName: value })} required />
                    <TextInput label="Batch" value={receiptForm.batchNumber} onChange={(value) => setReceiptForm({ ...receiptForm, batchNumber: value })} required />
                    <TextInput label="Brand" value={receiptForm.brand} onChange={(value) => setReceiptForm({ ...receiptForm, brand: value })} />
                    <TextInput label="Grade" value={receiptForm.grade} onChange={(value) => setReceiptForm({ ...receiptForm, grade: value })} />
                    <TextInput label="Supplier" value={receiptForm.supplier} onChange={(value) => setReceiptForm({ ...receiptForm, supplier: value })} />
                    <TextInput label="Challan" value={receiptForm.challanNumber} onChange={(value) => setReceiptForm({ ...receiptForm, challanNumber: value })} />
                    <TextInput label="Quantity" type="number" value={receiptForm.quantity} onChange={(value) => setReceiptForm({ ...receiptForm, quantity: value })} />
                    <TextInput label="Received Date" type="date" value={receiptForm.receivedDate} onChange={(value) => setReceiptForm({ ...receiptForm, receivedDate: value })} required />
                  </div>
                  <ModalActions onCancel={closeModal} submitLabel="Save Receipt" />
                </form>
              )}
              {modalMode === "result" && selectedObligation && (
                <form onSubmit={createResult} className="space-y-4 p-5">
                  <div className="rounded-lg bg-surface-base p-3">
                    <div className="text-sm font-bold text-text-primary">
                      {selectedObligation.materialName}
                    </div>
                    <div className="text-sm text-text-muted">
                      {selectedObligation.checkpoint?.characteristic || selectedObligation.reason}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <TextInput label="Test Date" type="date" value={resultForm.testDate} onChange={(value) => setResultForm({ ...resultForm, testDate: value })} required />
                    <TextInput label="Tested By" value={resultForm.testedByName} onChange={(value) => setResultForm({ ...resultForm, testedByName: value })} />
                    <TextInput label="Numeric Value" type="number" value={resultForm.numericValue} onChange={(value) => setResultForm({ ...resultForm, numericValue: value })} />
                    <label className="block text-sm font-bold text-text-secondary">
                      Result
                      <select
                        className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm"
                        value={resultForm.result}
                        onChange={(event) => setResultForm({ ...resultForm, result: event.target.value })}
                      >
                        <option value="PENDING_REVIEW">Pending Review</option>
                        <option value="PASS">Pass</option>
                        <option value="FAIL">Fail</option>
                      </select>
                    </label>
                    {canUploadEvidence && (
                      <label className="block text-sm font-bold text-text-secondary md:col-span-2">
                        Evidence
                        <input
                          type="file"
                          className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm"
                          onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)}
                        />
                      </label>
                    )}
                    <label className="block text-sm font-bold text-text-secondary md:col-span-3">
                      Remarks
                      <textarea
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm"
                        value={resultForm.remarks}
                        onChange={(event) => setResultForm({ ...resultForm, remarks: event.target.value })}
                      />
                    </label>
                  </div>
                  <ModalActions onCancel={closeModal} submitLabel="Save Result" />
                </form>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

const Stat = ({
  label,
  value,
  icon,
  danger,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  danger?: boolean;
}) => (
  <div className="rounded-lg border border-border-subtle bg-surface-card p-4 shadow-sm">
    <div className={`mb-3 h-5 w-5 ${danger ? "text-red-600" : "text-orange-600"}`}>
      {icon}
    </div>
    <div className="text-2xl font-black text-text-primary">{value}</div>
    <div className="text-xs font-bold uppercase text-text-disabled">{label}</div>
  </div>
);

const ApprovalPanel = ({
  items,
  onAction,
  canAct,
  compact,
}: {
  items: Array<{
    kind: "ITP" | "RESULT";
    id: number;
    title: string;
    subtitle: string;
    status: string;
    run: NonNullable<QualityMaterialItpTemplate["approvalRun"]>;
  }>;
  onAction: (
    kind: "ITP" | "RESULT",
    documentId: number,
    stepId: number,
    action: "approve" | "reject",
  ) => void;
  canAct: (kind: "ITP" | "RESULT") => boolean;
  compact?: boolean;
}) => {
  const visibleItems = compact
    ? items.filter((item) => item.run.status === "IN_PROGRESS").slice(0, 3)
    : items;

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-base font-black text-text-primary">
            <ShieldCheck className="h-4 w-4 text-orange-600" />
            Approval Panel
          </h4>
          <p className="text-xs font-semibold text-text-muted">
            ITP template and material test result approvals from release strategy.
          </p>
        </div>
        <StatusBadge value={`${visibleItems.length} ITEM${visibleItems.length === 1 ? "" : "S"}`} />
      </div>
      {!visibleItems.length ? (
        <div className="rounded-lg border border-dashed border-border-subtle px-4 py-5 text-sm font-semibold text-text-muted">
          No material approval workflows are pending or submitted yet.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item) => {
            const pendingStep = item.run.steps?.find((step) => step.status === "PENDING");
            return (
              <div key={`${item.kind}-${item.id}`} className="rounded-lg border border-border-subtle bg-surface-base p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black uppercase text-text-disabled">
                        {item.kind === "ITP" ? "ITP Template" : "Test Result"}
                      </span>
                      <StatusBadge value={item.run.status} />
                    </div>
                    <h5 className="mt-1 font-bold text-text-primary">{item.title}</h5>
                    <p className="text-sm text-text-muted">{item.subtitle}</p>
                    <p className="mt-1 text-xs font-semibold text-text-disabled">
                      {item.run.strategyName} | {pendingStep?.stepName || "Workflow closed"}
                    </p>
                  </div>
                  {pendingStep && canAct(item.kind) && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onAction(item.kind, item.id, pendingStep.id, "approve")}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onAction(item.kind, item.id, pendingStep.id, "reject")}
                        className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
                {!compact && (
                  <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {(item.run.steps || []).map((step) => (
                      <div key={step.id} className="rounded border border-border-subtle bg-surface-card px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-text-primary">
                            L{step.stepOrder} {step.stepName || "Approval"}
                          </span>
                          <StatusBadge value={step.status} />
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-text-disabled">
                          {step.approverMode === "USER" ? "User" : "Project role"} | {step.currentApprovalCount}/{step.minApprovalsRequired}
                        </p>
                      </div>
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
};

const StatusBadge = ({ value }: { value: string }) => {
  const tone =
    value === "ACTIVE" ||
    value === "APPROVED" ||
    value === "PASSED" ||
    value === "PASS" ||
    value === "COMPLETED"
      ? "bg-emerald-100 text-emerald-700"
    : value === "OVERDUE" || value === "FAIL" || value === "FAILED" || value === "REJECTED"
      ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";
  return <span className={`rounded-full px-2 py-1 text-xs font-bold ${tone}`}>{value}</span>;
};

const TextInput = ({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) => (
  <label className="block text-sm font-bold text-text-secondary">
    {label}
    <input
      type={type}
      required={required}
      className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

const CheckBox = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <label className="inline-flex items-center gap-2">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 rounded border-border-subtle text-orange-600"
    />
    {label}
  </label>
);

const ModalActions = ({
  onCancel,
  submitLabel,
}: {
  onCancel: () => void;
  submitLabel: string;
}) => (
  <div className="flex justify-end gap-3 border-t border-border-subtle pt-4">
    <button
      type="button"
      onClick={onCancel}
      className="rounded-lg px-4 py-2 text-sm font-bold text-text-muted hover:bg-surface-raised"
    >
      Cancel
    </button>
    <button
      type="submit"
      className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2 text-sm font-bold text-white hover:bg-orange-700"
    >
      <FileUp className="h-4 w-4" />
      {submitLabel}
    </button>
  </div>
);

const Table = ({ headers, rows }: { headers: string[]; rows: string[][] }) => (
  <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-card shadow-sm">
    <table className="min-w-full divide-y divide-border-subtle text-sm">
      <thead className="bg-surface-base">
        <tr>
          {headers.map((header) => (
            <th key={header} className="px-4 py-3 text-left text-xs font-black uppercase text-text-disabled">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border-subtle">
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 font-medium text-text-secondary">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default QualityMaterialTest;
