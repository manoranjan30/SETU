import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Beaker,
  ClipboardCheck,
  FileUp,
  Layers3,
  PackagePlus,
  Plus,
  RefreshCcw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { qualityService } from "../../../services/quality.service";
import type {
  QualityMaterialItpCheckpoint,
  QualityMaterialItpTemplate,
  QualityMaterialReceipt,
  QualityMaterialTestObligation,
  QualityMaterialTestResult,
} from "../../../types/quality";

interface Props {
  projectId: number;
}

type ModalMode = "itp" | "receipt" | "result" | null;
type TabKey = "itps" | "approvals" | "receipts" | "obligations" | "results";

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
  const [activeTab, setActiveTab] = useState<TabKey>("itps");
  const [templates, setTemplates] = useState<QualityMaterialItpTemplate[]>([]);
  const [receipts, setReceipts] = useState<QualityMaterialReceipt[]>([]);
  const [obligations, setObligations] = useState<QualityMaterialTestObligation[]>([]);
  const [results, setResults] = useState<QualityMaterialTestResult[]>([]);
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
    return {
      activeItps: activeTemplates.length,
      pendingTests: due.length,
      overdue: obligations.filter((item) => item.status === "OVERDUE").length,
      approvals: templateApprovals + resultApprovals,
    };
  }, [activeTemplates.length, obligations, results, templates]);

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

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextTemplates, nextReceipts, nextObligations, nextResults] =
        await Promise.all([
          qualityService.getMaterialItps(projectId),
          qualityService.getMaterialReceipts(projectId),
          qualityService.getMaterialTestObligations(projectId),
          qualityService.getMaterialTestResults(projectId),
        ]);
      setTemplates(nextTemplates);
      setReceipts(nextReceipts);
      setObligations(nextObligations);
      setResults(nextResults);
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
    if (evidenceFile) {
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
            onClick={() => setModalMode("receipt")}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
          >
            <PackagePlus className="h-4 w-4" />
            Material Receipt
          </button>
          <button
            onClick={() => setModalMode("itp")}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700"
          >
            <Plus className="h-4 w-4" />
            ITP Template
          </button>
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
          <ApprovalPanel items={approvalItems} onAction={actOnApproval} compact />
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
                  {template.status === "DRAFT" && (
                    <button
                      onClick={() => submitTemplate(template.id)}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-900"
                    >
                      Submit Approval
                    </button>
                  )}
                  {template.status === "APPROVED" && (
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
        <ApprovalPanel items={approvalItems} onAction={actOnApproval} />
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
              {!["COMPLETED", "RESULT_LOGGED"].includes(obligation.status) && (
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
              {result.reviewStatus === "DRAFT" && (
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
                    <label className="block text-sm font-bold text-text-secondary md:col-span-2">
                      Evidence
                      <input
                        type="file"
                        className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm"
                        onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)}
                      />
                    </label>
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
                  {pendingStep && (
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
    value === "ACTIVE" || value === "APPROVED" || value === "PASS" || value === "COMPLETED"
      ? "bg-emerald-100 text-emerald-700"
      : value === "OVERDUE" || value === "FAIL" || value === "REJECTED"
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
