import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  MapPin,
  Calendar,
  ClipboardCheck,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Camera,
  PenTool,
  Lock,
  Plus,
  FileDown,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import api from "../../../api/axios";
import SignatureModal from "../../../components/quality/SignatureModal";

interface Props {
  projectId: number;
}

type TabView = "all" | "my-pending";

const QualityInspection: React.FC<Props> = ({ projectId }) => {
  const navigate = useNavigate();
  const [inspections, setInspections] = useState<any[]>([]);
  const [myPending, setMyPending] = useState<any[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<any>(null);
  const [activeStageId, setActiveStageId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabView>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [executionData, setExecutionData] = useState<any>({});

  // Observation Modal State
  const [showObsModal, setShowObsModal] = useState(false);
  const [obsText, setObsText] = useState("");
  const [obsRemarks, setObsRemarks] = useState("");

  // Reversal Modal State
  const [showReversalModal, setShowReversalModal] = useState(false);
  const [reversalTarget, setReversalTarget] = useState<any>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalLoading, setReversalLoading] = useState(false);

  // Signature Modal
  const [showSignOffModal, setShowSignOffModal] = useState(false);

  // User info (from localStorage)
  const userRole = localStorage.getItem("userRole") || "";
  const isAdmin = userRole === "Admin";

  const fetchInspections = async () => {
    try {
      const response = await api.get(
        `/quality/inspections?projectId=${projectId}`,
      );
      setInspections(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchMyPending = async () => {
    try {
      const response = await api.get(
        `/quality/inspections/my-pending?projectId=${projectId}`,
      );
      setMyPending(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchInspections();
    fetchMyPending();
  }, [projectId]);

  const openInspection = async (id: number) => {
    try {
      const response = await api.get(`/quality/inspections/${id}`);
      setSelectedInspection(response.data);
      if (response.data.stages && response.data.stages.length > 0) {
        setActiveStageId(response.data.stages[0].id);
      }

      const execState: any = {};
      response.data.stages.forEach((s: any) => {
        s.items.forEach((item: any) => {
          execState[item.id] = {
            value: item.value || "",
            isOk: item.isOk || false,
            remarks: item.remarks || "",
            photos: item.photos || [],
          };
        });
      });
      setExecutionData(execState);
    } catch (error) {
      console.error("Failed to load inspection details:", error);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-emerald-100 text-emerald-700";
      case "REJECTED":
        return "bg-red-100 text-red-700";
      case "REVERSED":
        return "bg-amber-100 text-amber-800 ring-1 ring-amber-300";
      case "IN_PROGRESS":
      case "UNDER_INSPECTION":
        return "bg-info-muted text-blue-700";
      case "RFI_RAISED":
        return "bg-yellow-100 text-yellow-700";
      case "PENDING_OBSERVATION":
        return "bg-amber-100 text-amber-800 ring-1 ring-amber-300";
      case "NOT_STARTED":
        return "bg-surface-raised text-text-muted";
      default:
        return "bg-orange-100 text-orange-700";
    }
  };

  const handleItemChange = (itemId: number, field: string, val: any) => {
    setExecutionData((prev: any) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: val,
      },
    }));
  };

  const handleInitiateStageSubmit = () => {
    setShowSignOffModal(true);
  };

  const handleSubmitStage = async (signatureDataUrl: string) => {
    const stageId = activeStageId;
    if (!stageId) return;
    const stage = selectedInspection.stages.find((s: any) => s.id === stageId);

    const itemsToUpdate = stage.items.map((i: any) => ({
      itemTemplateId: i.itemTemplate.id,
      value: executionData[i.id].value,
      isOk: executionData[i.id].isOk,
      remarks: executionData[i.id].remarks,
      photos: executionData[i.id].photos,
    }));

    try {
      await api.post(
        `/quality/inspections/${selectedInspection.id}/stages/${stageId}/approve`,
        {
          items: itemsToUpdate,
          signatureData:
            signatureDataUrl || "data:image/png;base64,mocksignaturedata",
        },
      );

      setShowSignOffModal(false);
      openInspection(selectedInspection.id);
      alert(`Stage digitally locked and marked as APPROVED!`);
    } catch (error) {
      console.error("Failed to submit stage:", error);
      alert("Error updating stage. Ensure all mandatory fields are filled.");
    }
  };

  const handleAddObservation = async () => {
    if (!obsText.trim()) return alert("Observation text is required.");

    const currentStage = selectedInspection?.stages?.find(
      (s: any) => s.id === activeStageId,
    );

    try {
      await api.post(
        `/quality/activities/${selectedInspection.activityId}/observation`,
        {
          observationText: obsText,
          remarks: obsRemarks,
          checklistId: currentStage?.stageTemplateId,
        },
      );
      setShowObsModal(false);
      setObsText("");
      setObsRemarks("");
      alert(
        "Observation added successfully. Activity flagged as PENDING_OBSERVATION.",
      );
      navigate(`/dashboard/projects/${projectId}/quality`);
    } catch (error) {
      console.error("Failed to add observation:", error);
    }
  };

  // ─── PDF Report Download ──────────────────────────────────────────
  const downloadReport = async (inspectionId: number) => {
    try {
      const res = await api.get(`/quality/inspections/${inspectionId}/report`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RFI_Report_${inspectionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download report:", error);
      alert("Failed to download PDF report.");
    }
  };

  // ─── RFI Reversal ──────────────────────────────────────────────────
  const handleReverse = async () => {
    if (!reversalReason.trim()) return alert("Reversal reason is required.");
    if (!reversalTarget) return;

    setReversalLoading(true);
    try {
      await api.post(
        `/quality/inspections/${reversalTarget.id}/workflow/reverse`,
        {
          reason: reversalReason,
        },
      );
      alert("RFI reversed successfully. Original raiser has been notified.");
      setShowReversalModal(false);
      setReversalReason("");
      setReversalTarget(null);
      fetchInspections();
      fetchMyPending();
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to reverse RFI.");
    } finally {
      setReversalLoading(false);
    }
  };

  // ─── Admin Delete ──────────────────────────────────────────────────
  const handleDelete = async (inspectionId: number) => {
    if (
      !confirm(
        "Are you sure you want to permanently delete this RFI? This action cannot be undone.",
      )
    )
      return;
    try {
      await api.delete(`/quality/inspections/${inspectionId}`);
      alert("RFI deleted successfully.");
      fetchInspections();
      fetchMyPending();
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to delete RFI.");
    }
  };

  // If viewing a specific inspection
  if (selectedInspection) {
    const currentStage = selectedInspection.stages.find(
      (s: any) => s.id === activeStageId,
    );
    const stageLocked = ["APPROVED", "REJECTED"].includes(currentStage?.status);

    return (
      <>
        <div className="h-full flex flex-col bg-surface-base animate-in fade-in duration-300">
          {/* Header */}
          <div className="bg-surface-card px-6 py-4 border-b border-border-default shadow-sm flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedInspection(null)}
                className="p-2 hover:bg-surface-raised rounded-full text-text-muted transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-text-primary">
                    Inspection #{selectedInspection.id}
                  </h2>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${getStatusStyle(selectedInspection.status)}`}
                  >
                    {selectedInspection.status}
                  </span>
                </div>
                <p className="text-sm text-text-muted font-medium">
                  {selectedInspection.activity?.activityName || "Activity"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* PDF Download Button — only if APPROVED or PARTIALLY_APPROVED */}
              {["APPROVED", "PARTIALLY_APPROVED", "REVERSED"].includes(
                selectedInspection.status,
              ) && (
                <button
                  onClick={() => downloadReport(selectedInspection.id)}
                  className="flex items-center gap-2 bg-success-muted text-emerald-700 border border-emerald-200 px-4 py-2 rounded-xl hover:bg-emerald-100 transition-colors text-sm font-bold"
                >
                  <FileDown className="w-4 h-4" /> Download PDF
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex">
            {/* Sidebar: Stages */}
            <div className="w-80 bg-surface-card border-r border-border-default flex flex-col items-stretch overflow-y-auto">
              <div className="px-4 py-3 bg-surface-base border-b border-border-default">
                <h3 className="text-xs font-bold text-text-disabled uppercase tracking-wider">
                  Inspection Stages
                </h3>
              </div>
              <div className="flex-1 p-3 space-y-2">
                {selectedInspection.stages?.map((stage: any) => (
                  <button
                    key={stage.id}
                    onClick={() => setActiveStageId(stage.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      activeStageId === stage.id
                        ? "bg-orange-50 border-orange-200 shadow-sm"
                        : "bg-surface-card border-border-subtle hover:border-border-strong"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-sm font-bold truncate ${activeStageId === stage.id ? "text-orange-900" : "text-text-secondary"}`}
                      >
                        {stage.stageTemplate.name}
                      </span>
                      {stage.status === "APPROVED" && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      )}
                      {stage.status === "REJECTED" && (
                        <XCircle className="w-4 h-4 text-error" />
                      )}
                      {stage.status === "PENDING" && (
                        <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      {stage.stageTemplate.isHoldPoint && (
                        <span className="bg-error-muted text-error px-1.5 py-0.5 rounded font-bold">
                          Hold Point
                        </span>
                      )}
                      <span>{stage.items.length} items</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Stage Execution Area */}
            {currentStage && (
              <div className="flex-1 overflow-y-auto bg-surface-base p-6 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="bg-surface-card rounded-2xl border border-border-default shadow-sm p-6 flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-bold text-text-primary">
                        {currentStage.stageTemplate.name}
                      </h3>
                      {stageLocked && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-emerald-700 font-medium bg-success-muted px-3 py-1 rounded-lg w-max border border-emerald-100">
                          <Lock className="w-4 h-4" /> Digitally Locked
                        </div>
                      )}
                    </div>
                    {!stageLocked && (
                      <div className="text-sm text-text-muted bg-surface-raised px-4 py-2 rounded-xl font-medium">
                        Execute Checklist
                      </div>
                    )}
                  </div>

                  {/* Items List */}
                  <div className="space-y-4">
                    {currentStage.items.map((item: any, index: number) => {
                      const template = item.itemTemplate;
                      const data = executionData[item.id] || {};

                      return (
                        <div
                          key={item.id}
                          className="bg-surface-card rounded-2xl border border-border-default shadow-sm overflow-hidden group"
                        >
                          <div className="p-5 flex gap-4 items-start border-b border-gray-50">
                            <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-sm shrink-0">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-4">
                                <div className="font-bold text-text-primary flex-1">
                                  {template.itemText}
                                </div>
                                <div className="flex gap-2 shrink-0 ml-4">
                                  {template.isMandatory && (
                                    <span className="text-[10px] font-bold bg-error-muted text-error px-2 py-1 rounded uppercase">
                                      Req
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-4 max-w-lg">
                                {/* YES/NA Type */}
                                {(template.type === "YES_NO" ||
                                  template.type === "YES_OR_NA") && (
                                  <div className="flex gap-3">
                                    <button
                                      disabled={stageLocked}
                                      onClick={() => {
                                        handleItemChange(item.id, "isOk", true);
                                        handleItemChange(
                                          item.id,
                                          "value",
                                          "YES",
                                        );
                                      }}
                                      className={`flex-1 py-2.5 rounded-xl border-2 font-bold text-sm transition-all focus:outline-none focus:ring-4 focus:ring-emerald-500/20 ${data.isOk === true && data.value === "YES" ? "border-emerald-500 bg-success-muted text-emerald-700" : "border-border-default bg-surface-card text-text-muted hover:border-emerald-200 disabled:opacity-50"}`}
                                    >
                                      YES
                                    </button>
                                    <button
                                      disabled={stageLocked}
                                      onClick={() => {
                                        handleItemChange(item.id, "isOk", true);
                                        handleItemChange(
                                          item.id,
                                          "value",
                                          "NA",
                                        );
                                      }}
                                      className={`flex-1 py-2.5 rounded-xl border-2 font-bold text-sm transition-all focus:outline-none focus:ring-4 focus:ring-gray-500/20 ${data.isOk === true && data.value === "NA" ? "border-gray-500 bg-surface-raised text-text-secondary" : "border-border-default bg-surface-card text-text-muted hover:border-border-strong disabled:opacity-50"}`}
                                    >
                                      N/A
                                    </button>
                                  </div>
                                )}

                                {/* TEXT Type */}
                                {template.type === "TEXT" && (
                                  <input
                                    type="text"
                                    disabled={stageLocked}
                                    placeholder="Enter observation..."
                                    className="w-full bg-surface-base border border-border-default rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary disabled:opacity-60"
                                    value={data.value}
                                    onChange={(e) => {
                                      handleItemChange(
                                        item.id,
                                        "value",
                                        e.target.value,
                                      );
                                      handleItemChange(
                                        item.id,
                                        "isOk",
                                        !!e.target.value,
                                      );
                                    }}
                                  />
                                )}

                                <div className="flex gap-4">
                                  {template.photoRequired && (
                                    <button
                                      disabled={stageLocked}
                                      className="flex items-center gap-2 text-xs font-semibold text-text-muted bg-surface-base hover:bg-surface-raised border border-border-default px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                      <Camera className="w-4 h-4" /> Add Photo
                                    </button>
                                  )}
                                  <input
                                    type="text"
                                    disabled={stageLocked}
                                    placeholder="Add remarks (optional)..."
                                    className="flex-1 bg-transparent border-b border-border-default text-xs px-2 py-1 focus:border-secondary outline-none disabled:opacity-50"
                                    value={data.remarks}
                                    onChange={(e) =>
                                      handleItemChange(
                                        item.id,
                                        "remarks",
                                        e.target.value,
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {!stageLocked && (
                    <div className="bg-secondary-muted border border-indigo-100 rounded-2xl p-6 mt-8">
                      <h4 className="text-indigo-900 font-bold flex items-center gap-2 mb-4">
                        <PenTool className="w-5 h-5 text-secondary" />
                        Sign Off & Complete Stage
                      </h4>
                      <div className="flex items-center gap-4 border-t border-indigo-200/50 pt-6">
                        <button
                          onClick={() => setShowObsModal(true)}
                          className="px-6 py-3 rounded-xl font-bold text-orange-600 bg-surface-card border-2 border-orange-100 hover:border-orange-200 hover:bg-orange-50 transition-colors"
                        >
                          Keep Pending with Observation
                        </button>
                        <button
                          onClick={handleInitiateStageSubmit}
                          className="flex-1 px-6 py-3 rounded-xl font-bold bg-secondary text-white hover:bg-secondary-dark shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                        >
                          <Lock className="w-4 h-4" /> Sign & Lock Stage as
                          Passed
                        </button>
                      </div>
                    </div>
                  )}

                  {stageLocked && (
                    <div className="bg-success-muted border border-emerald-100 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-emerald-800">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                      <div className="text-center">
                        <h4 className="font-bold text-lg">Stage Completed</h4>
                        <p className="text-sm opacity-80">
                          This stage's execution has been verified and digitally
                          signed.
                        </p>
                      </div>
                      <div className="mt-4 p-4 bg-surface-card rounded-xl shadow-sm text-xs font-mono break-all text-text-muted border border-emerald-100 max-w-full">
                        <div className="font-bold text-emerald-700 mb-1 border-b pb-1">
                          SHA-256 Signature Hash
                        </div>
                        {currentStage.signatures?.[0]?.lockHash || "Pending..."}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Observation Modal */}
          {showObsModal && (
            <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-surface-card rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
                <h3 className="text-xl font-bold text-text-primary mb-2">
                  Add Observation
                </h3>
                <p className="text-sm text-text-muted mb-6">
                  Describe the issue. The activity will be flagged as Pending
                  Observation, and approval will be paused until this is
                  resolved.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-text-secondary mb-1">
                      Observation Details
                    </label>
                    <textarea
                      rows={4}
                      className="w-full bg-surface-base border border-border-default rounded-xl p-4 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                      placeholder="E.g., Surface uneven, reinforcement incorrect..."
                      value={obsText}
                      onChange={(e) => setObsText(e.target.value)}
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-text-secondary mb-1">
                      Remarks / Action Required (Optional)
                    </label>
                    <input
                      type="text"
                      className="w-full bg-surface-base border border-border-default rounded-xl p-4 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                      placeholder="Action for the contractor..."
                      value={obsRemarks}
                      onChange={(e) => setObsRemarks(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    onClick={() => setShowObsModal(false)}
                    className="px-6 py-3 rounded-xl font-bold text-text-secondary bg-surface-raised hover:bg-gray-200 transition-colors flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddObservation}
                    className="px-6 py-3 rounded-xl font-bold text-white bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-200 transition-all flex-1"
                  >
                    Save Observation
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <SignatureModal
          isOpen={showSignOffModal}
          onClose={() => setShowSignOffModal(false)}
          onSign={(signatureDataUrl: string) =>
            handleSubmitStage(signatureDataUrl)
          }
          title="Stage Approval Signature"
          description="Sign to approve and lock this execution stage."
        />
      </>
    );
  }

  // ─── Filter logic ──────────────────────────────────────────────────
  const filteredInspections = inspections.filter((item) => {
    const name = item.activity?.activityName || "";
    return (
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(item.id).includes(searchTerm)
    );
  });

  // List View
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center bg-surface-card p-4 rounded-2xl shadow-sm border border-border-subtle">
        <div className="flex items-center gap-4">
          {/* Tabs */}
          <div className="flex bg-surface-raised rounded-xl p-1">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "all" ? "bg-surface-card text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"}`}
            >
              All RFIs
            </button>
            <button
              onClick={() => setActiveTab("my-pending")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === "my-pending" ? "bg-surface-card text-orange-700 shadow-sm" : "text-text-muted hover:text-text-secondary"}`}
            >
              <Clock className="w-4 h-4" />
              My Pending
              {myPending.length > 0 && (
                <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {myPending.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3 bg-surface-base px-4 py-2.5 rounded-xl border border-border-subtle w-72 focus-within:ring-2 focus-within:ring-orange-500 transition-all">
            <Search className="w-5 h-5 text-text-disabled" />
            <input
              type="text"
              placeholder="Search inspections..."
              className="bg-transparent border-none focus:ring-0 text-sm w-full p-0"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={() =>
            navigate(`/dashboard/projects/${projectId}/quality/inspections`)
          }
          className="flex items-center gap-2 bg-orange-600 text-white px-6 py-2.5 rounded-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-200"
        >
          <Plus className="w-5 h-5" />
          <span className="font-bold">Raise RFI</span>
        </button>
      </div>

      <div className="bg-surface-card rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-surface-base border-b border-border-subtle">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-text-disabled uppercase tracking-wider">
                ID / Activity
              </th>
              <th className="px-6 py-4 text-xs font-bold text-text-disabled uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-4 text-xs font-bold text-text-disabled uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-xs font-bold text-text-disabled uppercase tracking-wider">
                Date Raised
              </th>
              <th className="px-6 py-4 text-xs font-bold text-text-disabled uppercase tracking-wider text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(activeTab === "all" ? filteredInspections : myPending).length ===
            0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-text-muted">
                  <ClipboardCheck className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  {activeTab === "my-pending"
                    ? "No pending inspections. All your RFIs are resolved."
                    : "No Inspections found. Raise an RFI from the Schedule to start."}
                </td>
              </tr>
            ) : (
              (activeTab === "all" ? filteredInspections : myPending).map(
                (item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-orange-50/30 transition-colors group"
                  >
                    <td
                      className="px-6 py-4 cursor-pointer"
                      onClick={() => openInspection(item.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="font-mono text-xs font-bold text-text-disabled bg-surface-raised px-2 py-1 rounded">
                          #{item.id}
                        </div>
                        <p className="font-bold text-text-primary group-hover:text-orange-600 transition-colors">
                          {item.activity?.activityName || "N/A"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-text-secondary">
                        <MapPin className="w-4 h-4 text-text-disabled" />
                        {item.epsNode?.label || `Node ${item.epsNodeId}`}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${getStatusStyle(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-text-secondary">
                        <Calendar className="w-4 h-4 text-text-disabled" />
                        {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openInspection(item.id)}
                          className="text-sm font-bold text-orange-600 hover:text-orange-700 bg-orange-50 px-3 py-1.5 rounded-lg transition-all"
                        >
                          Open
                        </button>

                        {/* PDF Download for approved */}
                        {["APPROVED", "PARTIALLY_APPROVED"].includes(
                          item.status,
                        ) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadReport(item.id);
                            }}
                            className="text-sm font-bold text-success hover:text-emerald-700 bg-success-muted px-3 py-1.5 rounded-lg transition-all"
                            title="Download PDF Report"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>
                        )}

                        {/* Reverse for approved items (permission-based) */}
                        {item.status === "APPROVED" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReversalTarget(item);
                              setShowReversalModal(true);
                            }}
                            className="text-sm font-bold text-warning hover:text-amber-700 bg-warning-muted px-3 py-1.5 rounded-lg transition-all"
                            title="Reverse Approval"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}

                        {/* Admin Delete */}
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item.id);
                            }}
                            className="text-sm font-bold text-error hover:text-error bg-error-muted px-3 py-1.5 rounded-lg transition-all"
                            title="Delete RFI (Admin Only)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Reversal Modal */}
      {showReversalModal && reversalTarget && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface-card rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-warning" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-text-primary">
                  Reverse RFI #{reversalTarget.id}
                </h3>
                <p className="text-sm text-text-muted">
                  {reversalTarget.activity?.activityName}
                </p>
              </div>
            </div>

            <div className="bg-warning-muted border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
              <strong>Warning:</strong> This will reverse the approved RFI back
              to REVERSED status. The original raiser will be notified. All
              previous signatures are preserved for audit trail.
            </div>

            <div>
              <label className="block text-sm font-bold text-text-secondary mb-1">
                Reason for Reversal *
              </label>
              <textarea
                rows={4}
                className="w-full bg-surface-base border border-border-default rounded-xl p-4 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                placeholder="Explain why this approval is being reversed..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
              ></textarea>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setShowReversalModal(false);
                  setReversalReason("");
                  setReversalTarget(null);
                }}
                className="px-6 py-3 rounded-xl font-bold text-text-secondary bg-surface-raised hover:bg-gray-200 transition-colors flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleReverse}
                disabled={reversalLoading || !reversalReason.trim()}
                className="px-6 py-3 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-200 transition-all flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {reversalLoading ? "Reversing..." : "Confirm Reversal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualityInspection;
