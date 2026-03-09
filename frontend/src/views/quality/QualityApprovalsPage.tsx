import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PermissionCode } from '../../config/permissions';
import {
    ClipboardCheck, AlertCircle, CheckCircle2, Clock,
    Save, ShieldCheck, UserCheck,
    MessageSquareWarning, X, Camera, FileDown, RotateCcw,
    Trash2, AlertTriangle
} from 'lucide-react';
import api from '../../api/axios';
import SignatureModal from '../../components/quality/SignatureModal';

interface QualityInspection {
    id: number;
    activityId: number;
    epsNodeId: number;
    status: 'PENDING' | 'APPROVED' | 'PROVISIONALLY_APPROVED' | 'REJECTED' | 'CANCELED' | 'REVERSED' | 'PARTIALLY_APPROVED';
    requestDate: string;
    inspectionDate?: string;
    comments?: string;
    inspectedBy?: string;
    activity?: {
        id: number;
        activityName: string;
    };
    epsNode?: {
        label: string;
    };
    stages?: any[]; // Populated in detail view
}

export default function QualityApprovalsPage() {
    const { projectId } = useParams();
    const [inspections, setInspections] = useState<QualityInspection[]>([]);
    const [selectedInspectionId, setSelectedInspectionId] = useState<number | null>(null);
    const [inspectionDetail, setInspectionDetail] = useState<any>(null);
    const [loadingList, setLoadingList] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // Workflow State
    const [workflowState, setWorkflowState] = useState<any>(null);

    // Observations State
    const [observations, setObservations] = useState<any[]>([]);
    const [obsTab, setObsTab] = useState<'PENDING' | 'RECTIFIED' | 'CLOSED' | 'ALL'>('PENDING');
    const [showObsModal, setShowObsModal] = useState(false);
    const [showDelegationModal, setShowDelegationModal] = useState(false);
    const [delegating, setDelegating] = useState(false);
    const [eligibleUsers, setEligibleUsers] = useState<any[]>([]);
    const [selectedDelegateId, setSelectedDelegateId] = useState<number | null>(null);
    const [obsText, setObsText] = useState('');
    const [obsType, setObsType] = useState('Minor');
    const [currentPhotos, setCurrentPhotos] = useState<string[]>([]);
    const [savingObs, setSavingObs] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Reversal Modal
    const [showReversalModal, setShowReversalModal] = useState(false);
    const [reversalReason, setReversalReason] = useState('');
    const [reversalLoading, setReversalLoading] = useState(false);

    // Signature Modals
    const [showFinalApproveSig, setShowFinalApproveSig] = useState(false);
    // showReversalSig could also be added if reversal needs digital signature, but reason is already captured in modal.


    // User info
    const { user, hasPermission } = useAuth();
    const [showDraftOrSignModal, setShowDraftOrSignModal] = useState(false);
    const isAdmin = hasPermission(PermissionCode.QUALITY_INSPECTION_DELETE);

    // Helper for correct image URLs
    const getFileUrl = (path: string) => {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        return `${baseUrl}${path}`;
    };

    // Filter states
    const [filterStatus, setFilterStatus] = useState<string>('PENDING');

    useEffect(() => {
        if (projectId) {
            setLoadingList(true);
            api.get('/quality/inspections', {
                params: { projectId }
            }).then(res => {
                setInspections(res.data);
            }).finally(() => setLoadingList(false));
        }
    }, [projectId, refreshKey]);

    useEffect(() => {
        if (selectedInspectionId) {
            setLoadingDetail(true);

            // Bring down detail, workflow, and observations
            Promise.all([
                api.get(`/quality/inspections/${selectedInspectionId}`),
                api.get(`/quality/inspections/${selectedInspectionId}/workflow`).catch(() => ({ data: null }))
            ]).then(([detailRes, flowRes]) => {
                setInspectionDetail(detailRes.data);
                setWorkflowState(flowRes.data);

                // Fetch observations for this activity
                if (detailRes.data.activityId) {
                    api.get(`/quality/activities/${detailRes.data.activityId}/observations`)
                        .then(obsRes => setObservations(obsRes.data))
                        .catch(err => console.error('Failed to load observations', err));
                }
            }).finally(() => setLoadingDetail(false));

        } else {
            setInspectionDetail(null);
            setWorkflowState(null);
            setObservations([]);
        }
    }, [selectedInspectionId, refreshKey]);

    const filteredInspections = useMemo(() => {
        return inspections.filter(i => filterStatus === 'ALL' || i.status === filterStatus);
    }, [inspections, filterStatus]);

    const filteredObservations = useMemo(() => {
        if (obsTab === 'PENDING') return observations.filter(o => o.status === 'PENDING' || o.status === 'OPEN');
        if (obsTab === 'RECTIFIED') return observations.filter(o => o.status === 'RECTIFIED');
        if (obsTab === 'CLOSED') return observations.filter(o => o.status === 'CLOSED' || o.status === 'RESOLVED');
        return observations;
    }, [observations, obsTab]);

    const getDaysOpen = (createdAt: string) => {
        const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
        if (days === 0) return { text: 'Today', color: 'text-emerald-600' };
        if (days === 1) return { text: '1 day ago', color: 'text-emerald-600' };
        if (days <= 3) return { text: `${days} days ago`, color: 'text-emerald-600' };
        if (days <= 7) return { text: `${days} days ago`, color: 'text-amber-600' };
        return { text: `${days} days ago`, color: 'text-red-500 font-bold' };
    };

    const handleItemValueChange = (itemId: number, val: string) => {
        setInspectionDetail((prev: any) => {
            if (!prev) return prev;
            const newStages = prev.stages.map((stage: any) => ({
                ...stage,
                items: stage.items.map((item: any) =>
                    item.id === itemId ? { ...item, value: val, isOk: val === 'YES' || val === 'NA' } : item
                )
            }));
            return { ...prev, stages: newStages };
        });
    };

    const handleItemRemarksChange = (itemId: number, val: string) => {
        setInspectionDetail((prev: any) => {
            if (!prev) return prev;
            const newStages = prev.stages.map((stage: any) => ({
                ...stage,
                items: stage.items.map((item: any) =>
                    item.id === itemId ? { ...item, remarks: val } : item
                )
            }));
            return { ...prev, stages: newStages };
        });
    };

    const saveChecklistProgress = async () => {
        if (!inspectionDetail) return;
        try {
            // Must save each stage sequentially
            for (const stage of inspectionDetail.stages) {
                const checkedCount = stage.items.filter((it: any) => it.value === 'YES' || it.value === 'NA' || it.isOk).length;
                const totalCount = stage.items.length;

                let stageStatus = stage.status;
                if (checkedCount > 0 && checkedCount < totalCount) {
                    stageStatus = 'IN_PROGRESS';
                } else if (checkedCount === totalCount && totalCount > 0) {
                    stageStatus = 'COMPLETED';
                }

                await api.patch(`/quality/inspections/stage/${stage.id}`, {
                    status: stageStatus, // Keep existing status or update to IN_PROGRESS
                    items: stage.items.map((it: any) => ({
                        id: it.id,
                        value: it.value,
                        isOk: it.value === 'YES' || it.value === 'NA' || it.isOk,
                        remarks: it.remarks,
                    }))
                });
            }
            alert('Checklist progress saved successfully.');
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to save progress.');
        }
    };

    const fetchEligibleUsers = async () => {
        try {
            const res = await api.get('/users/list'); // Assuming a user list endpoint exists
            setEligibleUsers(res.data);
        } catch (err) {
            console.error('Failed to fetch users', err);
        }
    };

    const handleDelegate = async () => {
        if (!selectedDelegateId || !selectedInspectionId || !workflowState) return;
        setDelegating(true);
        try {
            await api.post(`/quality/inspections/${selectedInspectionId}/workflow/delegate`, {
                targetUserId: selectedDelegateId,
                comments: 'Delegated via UI'
            });
            setShowDelegationModal(false);
            // Refresh
            const [inspRes, wfRes] = await Promise.all([
                api.get(`/quality/inspections/${selectedInspectionId}`),
                api.get(`/quality/inspections/${selectedInspectionId}/workflow`)
            ]);
            setInspectionDetail(inspRes.data);
            setWorkflowState(wfRes.data);
            alert('Step successfully delegated.');
        } catch (err: any) {
            alert(err.response?.data?.message || 'Delegation failed.');
        } finally {
            setDelegating(false);
        }
    };
    const handleInitiateApprove = async () => {
        // Just save progress and show signature modal
        await saveChecklistProgress();
        setShowFinalApproveSig(true);
    };

    const executeFinalApprove = async (signatureData: string) => {
        try {
            if (workflowState) {
                const currentStep = workflowState.steps.find((s: any) => s.stepOrder === workflowState.currentStepOrder);
                const wfRes = await api.post(`/quality/inspections/${inspectionDetail.id}/workflow/advance`, {
                    signatureData,
                    signedBy: user?.displayName || user?.username || currentStep?.workflowNode?.label || 'Approver',
                    comments: 'Approved digitally',
                });

                if (wfRes.data?.isFinal) {
                    alert('All workflow steps completed. Inspection is now Final Approved!');
                } else {
                    alert('Workflow Step Approved!');
                }
            } else {
                // Legacy / Direct final approve
                await api.post(`/quality/inspections/${inspectionDetail.id}/final-approve`, {
                    signatureData,
                    comments: 'Final Approval given digitally',
                });
                alert('Inspection Final Approved!');
            }

            setShowFinalApproveSig(false);
            setSelectedInspectionId(null);
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to approve RFI.');
        }
    };


    const handleReject = async () => {
        const reason = prompt('Please enter rejection reason:');
        if (reason === null) return;

        try {
            // Save checklist progress first
            for (const stage of inspectionDetail.stages) {
                await api.patch(`/quality/inspections/stage/${stage.id}`, {
                    status: 'REJECTED',
                    items: stage.items.map((it: any) => ({
                        id: it.id,
                        value: it.value,
                        isOk: it.isOk,
                        remarks: it.remarks,
                    }))
                });
            }

            if (workflowState && workflowState.status === 'IN_PROGRESS') {
                await api.post(`/quality/inspections/${inspectionDetail.id}/workflow/reject`, {
                    comments: reason || 'Rejected during checklist execution'
                });
            } else {
                await api.patch(`/quality/inspections/${inspectionDetail.id}/status`, {
                    status: 'REJECTED',
                    comments: reason || 'Rejected during checklist execution',
                    inspectionDate: new Date().toISOString().split('T')[0]
                });
            }
            alert('Inspection Rejected.');
            setSelectedInspectionId(null);
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to reject RFI.');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/files/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setCurrentPhotos(prev => [...prev, res.data.url]);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleProvisionallyApprove = async () => {
        const reason = prompt('Please enter justification for Provisional Approval:');
        if (!reason) return;

        try {
            // Save checklist progress first
            for (const stage of inspectionDetail.stages) {
                await api.patch(`/quality/inspections/stage/${stage.id}`, {
                    status: 'COMPLETED',
                    items: stage.items.map((it: any) => ({
                        id: it.id,
                        value: it.value,
                        isOk: it.isOk,
                        remarks: it.remarks,
                    }))
                });
            }

            await api.patch(`/quality/inspections/${inspectionDetail.id}/status`, {
                status: 'PROVISIONALLY_APPROVED',
                comments: reason,
                inspectionDate: new Date().toISOString().split('T')[0]
            });
            alert('Inspection Provisionally Approved.');
            setSelectedInspectionId(null);
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to provisionally approve RFI.');
        }
    };

    const handleRaiseObservation = async () => {
        if (!obsText.trim()) return;
        setSavingObs(true);
        try {
            await api.post(`/quality/activities/${inspectionDetail.activityId}/observation`, {
                observationText: obsText,
                type: obsType,
                photos: currentPhotos
            });
            alert('Observation Raised.');
            setObsText('');
            setCurrentPhotos([]);
            // Refresh to show in the list inside the modal
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to raise observation.');
        } finally {
            setSavingObs(false);
        }
    };

    const handleCloseObservation = async (obsId: string) => {
        if (!confirm('Verify and close this observation?')) return;
        try {
            await api.patch(`/quality/activities/${inspectionDetail.activityId}/observation/${obsId}/close`);
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to close observation.');
        }
    };

    const handleDeleteObservation = async (obsId: string) => {
        if (!confirm('Permanently delete this observation?')) return;
        try {
            await api.delete(`/quality/activities/${inspectionDetail.activityId}/observation/${obsId}`);
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to delete observation.');
        }
    };

    const allChecked = useMemo(() => {
        if (!inspectionDetail?.stages) return false;
        if (inspectionDetail.stages.length === 0) return true; // Empty checklist can be approved
        return inspectionDetail.stages.every((s: any) => s.items?.every((i: any) => i.value === 'YES' || i.value === 'NA' || i.isOk));
    }, [inspectionDetail]);

    const pendingObservationsCount = useMemo(() => {
        return observations.filter(o => o.status !== 'CLOSED').length;
    }, [observations]);

    return (
        <>
            <div className="h-full flex flex-col bg-gray-50">
                {/* Header */}
                <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10 shrink-0">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-indigo-600" />
                            QA/QC Approvals
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Review Requests for Inspection (RFI) and execute checklists.</p>
                    </div>
                </header>

                <div className="flex-1 flex min-h-0 overflow-hidden">
                    {/* Left Panel: List of RFIs */}
                    <aside className="w-[400px] bg-white border-r flex flex-col shrink-0 flex-grow-0">
                        <div className="p-4 border-b">
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button
                                    className={`px-4 py-2 font-medium text-sm flex-1 sm:flex-none border-b-2 transition-colors ${filterStatus === 'PENDING' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                                    onClick={() => setFilterStatus('PENDING')}
                                >
                                    Pending QC
                                </button>
                                <button
                                    className={`px-4 py-2 font-medium text-sm flex-1 sm:flex-none border-b-2 transition-colors ${filterStatus === 'ALL' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                                    onClick={() => setFilterStatus('ALL')}
                                >
                                    All RFIs
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {loadingList ? (
                                <div className="text-center text-sm text-gray-400 p-4">Loading RFIs...</div>
                            ) : filteredInspections.length === 0 ? (
                                <div className="text-center text-sm text-gray-400 p-8 border-2 border-dashed rounded-lg">No RFIs found.</div>
                            ) : (
                                filteredInspections.map(insp => (
                                    <div
                                        key={insp.id}
                                        onClick={() => setSelectedInspectionId(insp.id)}
                                        className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedInspectionId === insp.id ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200' : 'border-gray-200 hover:border-indigo-300 hover:shadow-sm bg-white'}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${insp.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                insp.status === 'PARTIALLY_APPROVED' ? 'bg-blue-100 text-blue-700' :
                                                    insp.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                        insp.status === 'REVERSED' ? 'bg-amber-100 text-amber-800' :
                                                            'bg-amber-100 text-amber-700'
                                                }`}>
                                                {insp.status === 'PARTIALLY_APPROVED' ? 'PARTIALLY APPROVED - REVIEW UNDER PROGRESS' : insp.status}
                                            </span>
                                            <span className="text-xs text-gray-500">{insp.requestDate}</span>
                                        </div>
                                        <h4 className="text-sm font-semibold text-gray-900 mb-1">{insp.activity?.activityName || `Activity #${insp.activityId}`}</h4>
                                        <p className="text-xs text-gray-500">Node ID: {insp.epsNodeId}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </aside>

                    {/* Right Panel: Checklist Execution */}
                    <main className="flex-1 min-w-0 bg-gray-50 flex flex-col relative overflow-hidden">
                        {!selectedInspectionId ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                <ClipboardCheck className="w-16 h-16 mb-4 text-gray-200" />
                                <h3 className="text-lg font-medium text-gray-900 mb-1">Select an RFI</h3>
                                <p className="max-w-sm text-center">Select an inspection request from the left panel to review and execute its checklist.</p>
                            </div>
                        ) : loadingDetail ? (
                            <div className="flex-1 flex items-center justify-center text-gray-500">Loading checklist details...</div>
                        ) : inspectionDetail ? (
                            <>
                                {/* RFI Info Header */}
                                <div className="bg-white px-8 py-6 border-b shrink-0 flex items-start justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                            {inspectionDetail.activity?.activityName}
                                        </h2>
                                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                                            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-gray-400" /> Requested: {inspectionDetail.requestDate}</span>
                                            <span className="flex items-center gap-1.5"><UserCheck className="w-4 h-4 text-gray-400" /> Requester: {inspectionDetail.inspectedBy || 'System'}</span>
                                            {inspectionDetail.comments && (
                                                <span className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded text-xs italic">
                                                    "{inspectionDetail.comments}"
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setShowDraftOrSignModal(true)}
                                            disabled={inspectionDetail.status !== 'PENDING' && inspectionDetail.status !== 'PARTIALLY_APPROVED'}
                                            className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm disabled:opacity-50"
                                        >
                                            <Save className="w-4 h-4" /> Save Progress
                                        </button>
                                        {/* PDF Download */}
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const res = await api.get(`/quality/inspections/${inspectionDetail.id}/report`, { responseType: 'blob' });
                                                    const url = URL.createObjectURL(res.data);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    const isApproved = inspectionDetail.status === 'APPROVED';
                                                    a.download = `RFI_${isApproved ? 'Final' : 'WIP'}_Report_${inspectionDetail.id}.pdf`;
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    document.body.removeChild(a);
                                                    URL.revokeObjectURL(url);
                                                } catch { alert('Failed to download report.'); }
                                            }}
                                            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium shadow-sm ${inspectionDetail.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                                        >
                                            <FileDown className="w-4 h-4" /> {inspectionDetail.status === 'APPROVED' ? 'Final Report' : 'WIP Report'}
                                        </button>
                                        {/* Reverse for Approved */}
                                        {inspectionDetail.status === 'APPROVED' && (
                                            <button
                                                onClick={() => setShowReversalModal(true)}
                                                className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 shadow-sm"
                                            >
                                                <RotateCcw className="w-4 h-4" /> Reverse
                                            </button>
                                        )}
                                        {/* Admin Delete */}
                                        {isAdmin && (
                                            <button
                                                onClick={async () => {
                                                    if (!confirm('Permanently delete this RFI?')) return;
                                                    try {
                                                        await api.delete(`/quality/inspections/${inspectionDetail.id}`);
                                                        alert('RFI deleted.');
                                                        setSelectedInspectionId(null);
                                                        setRefreshKey(k => k + 1);
                                                    } catch (err: any) { alert(err.response?.data?.message || 'Delete failed.'); }
                                                }}
                                                className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 shadow-sm"
                                            >
                                                <Trash2 className="w-4 h-4" /> Delete
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Final Action Bar (Desktop only, or keep sticky bottom as is) */}

                                {/* Workflow Status Indicator */}
                                {workflowState && (
                                    <div className="bg-white px-8 py-4 border-b shrink-0 flex items-center justify-between border-t border-gray-100">
                                        <div className="flex gap-4 items-center flex-1">
                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">Workflow</div>
                                            <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1">
                                                {workflowState.steps.sort((a: any, b: any) => a.stepOrder - b.stepOrder).map((step: any, sIdx: number) => {
                                                    const isCurrent = workflowState.currentStepOrder === step.stepOrder;
                                                    const isCompleted = step.status === 'COMPLETED';
                                                    const isRejected = step.status === 'REJECTED';
                                                    const isRaiserStep = step.workflowNode?.stepType === 'RAISE_RFI' || (step.stepOrder === 1 && step.workflowNode?.label?.toLowerCase?.()?.includes?.('raise'));
                                                    const isLastStepNode = step.stepOrder === Math.max(...workflowState.steps.map((s: any) => s.stepOrder));

                                                    let colorClass = "bg-gray-100 text-gray-500 border-gray-200";
                                                    if (isCompleted) colorClass = "bg-green-100 text-green-700 border-green-200";
                                                    if (isRejected) colorClass = "bg-red-100 text-red-700 border-red-200";
                                                    if (isCurrent) colorClass = "bg-indigo-100 text-indigo-700 border-indigo-300 ring-2 ring-indigo-200";

                                                    // Determine label and subtitle
                                                    const stepLabel = isLastStepNode && !isRaiserStep
                                                        ? 'Final Approval'
                                                        : (step.workflowNode?.label || `Step ${step.stepOrder}`);
                                                    const stepSubtitle = isCompleted
                                                        ? (isRaiserStep ? 'RFI Raised' : `Signed by ${step.signedBy}`)
                                                        : isRejected ? 'Rejected'
                                                            : isCurrent ? 'Pending Approval' : 'Waiting';

                                                    return (
                                                        <div key={step.id} className="flex items-center gap-2 shrink-0">
                                                            <div className={`flex flex-col border rounded-lg px-3 py-1.5 ${colorClass}`}>
                                                                <span className="text-[10px] font-bold uppercase">{stepLabel}</span>
                                                                <span className="text-[10px] truncate max-w-[120px]">
                                                                    {stepSubtitle}
                                                                </span>
                                                            </div>
                                                            {sIdx < workflowState.steps.length - 1 && (
                                                                <div className={`h-0.5 w-4 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Checklist Area */}
                                <div className="flex-1 overflow-y-auto p-8">
                                    <div className="max-w-4xl mx-auto space-y-6 pb-20">

                                        {/* Workflow Completed Banner */}
                                        {workflowState?.status === 'COMPLETED' && (
                                            <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-6 py-4 flex items-center gap-3 text-emerald-800">
                                                <CheckCircle2 className="w-6 h-6 shrink-0" />
                                                <div>
                                                    <h4 className="font-bold text-sm">Workflow Fully Approved</h4>
                                                    <p className="text-xs mt-1">All {workflowState.steps.length} approval levels have been completed and signed.</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Observation Banner */}
                                        {pendingObservationsCount > 0 && (
                                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800">
                                                <AlertCircle className="w-5 h-5 shrink-0" />
                                                <div>
                                                    <h4 className="font-bold text-sm">Cannot Approve RFI</h4>
                                                    <p className="text-xs mt-1">There are {pendingObservationsCount} pending observation(s). The field team must resolve these before you can approve.</p>
                                                </div>
                                            </div>
                                        )}

                                        {(!inspectionDetail.stages || inspectionDetail.stages.length === 0) ? (
                                            <div className="bg-white p-8 rounded-xl border text-center text-gray-500">
                                                No checklist template assigned to this activity.
                                            </div>
                                        ) : (
                                            inspectionDetail.stages.map((stage: any, sIdx: number) => (
                                                <div key={stage.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                                                    <div className="bg-gray-50 px-5 py-3 border-b flex justify-between items-center">
                                                        <h3 className="font-semibold text-gray-900">
                                                            Stage {sIdx + 1}: {stage.stageTemplate?.name || 'General Checks'}
                                                        </h3>
                                                        <span className="text-xs text-gray-500">
                                                            {stage.items?.filter((i: any) => i.value === 'YES' || i.value === 'NA' || i.isOk).length} / {stage.items?.length} Completed
                                                        </span>
                                                    </div>
                                                    <div className="divide-y">
                                                        {[...(stage.items || [])].sort((a: any, b: any) => (a.itemTemplate?.sequence || 0) - (b.itemTemplate?.sequence || 0)).map((item: any) => (
                                                            <div key={item.id} className="p-4 flex gap-4 hover:bg-gray-50 transition-colors">
                                                                <div className="mt-0.5 shrink-0 flex gap-2">
                                                                    <button
                                                                        onClick={() => handleItemValueChange(item.id, item.value === 'YES' ? '' : 'YES')}
                                                                        disabled={!['PENDING', 'PARTIALLY_APPROVED'].includes(inspectionDetail.status)}
                                                                        className={`px-3 py-1 rounded text-[10px] font-bold tracking-wider transition-colors disabled:opacity-50 border ${item.value === 'YES' || item.isOk && item.value !== 'NA' ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                                                                    >
                                                                        YES
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleItemValueChange(item.id, item.value === 'NA' ? '' : 'NA')}
                                                                        disabled={!['PENDING', 'PARTIALLY_APPROVED'].includes(inspectionDetail.status)}
                                                                        className={`px-3 py-1 rounded text-[10px] font-bold tracking-wider transition-colors disabled:opacity-50 border ${item.value === 'NA' ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                                                                    >
                                                                        NA
                                                                    </button>
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className={`text-sm ${(item.value === 'YES' || item.value === 'NA' || item.isOk) ? 'text-gray-700 font-medium' : 'text-gray-900'}`}>
                                                                        {item.itemTemplate?.itemText || 'Checklist Item'}
                                                                    </p>
                                                                    {['PENDING', 'PARTIALLY_APPROVED'].includes(inspectionDetail.status) ? (
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Add remarks..."
                                                                            value={item.remarks || ''}
                                                                            onChange={(e) => handleItemRemarksChange(item.id, e.target.value)}
                                                                            className="mt-2 w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                                                        />
                                                                    ) : item.remarks && (
                                                                        <p className="mt-1 text-xs text-gray-500 italic">Remark: {item.remarks}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Final Action Bar */}
                                {['PENDING', 'PARTIALLY_APPROVED'].includes(inspectionDetail.status) && (
                                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                                        <div className="max-w-4xl mx-auto flex items-center justify-between">
                                            <div className="text-sm">
                                                {!allChecked && pendingObservationsCount === 0 && (
                                                    <span className="text-red-600 font-medium flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Please complete all checklist items before approving.</span>
                                                )}
                                                {allChecked && pendingObservationsCount === 0 && (
                                                    <span className="text-green-600 font-medium flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Checklist complete. Ready for approval.</span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 justify-end">
                                                <button
                                                    onClick={() => setShowObsModal(true)}
                                                    className="px-4 py-2 bg-white border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-50 focus:ring-2 focus:ring-amber-200 font-medium flex items-center gap-2 text-sm"
                                                >
                                                    <MessageSquareWarning className="w-4 h-4" /> Observations ({observations.length})
                                                </button>
                                                <button
                                                    onClick={handleReject}
                                                    className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 focus:ring-2 focus:ring-red-200 font-medium text-sm border-l"
                                                >
                                                    Reject
                                                </button>
                                                {workflowState && (
                                                    <button
                                                        onClick={() => {
                                                            fetchEligibleUsers();
                                                            setShowDelegationModal(true);
                                                        }}
                                                        className="px-4 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 focus:ring-2 focus:ring-indigo-200 font-medium text-sm flex items-center gap-2"
                                                    >
                                                        <UserCheck className="w-4 h-4" /> Delegate
                                                    </button>
                                                )}
                                                {!workflowState && (
                                                    <button
                                                        onClick={handleProvisionallyApprove}
                                                        className="px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 focus:ring-2 focus:ring-blue-200 font-medium text-sm"
                                                    >
                                                        Provisional Approval
                                                    </button>
                                                )}
                                                <button
                                                    onClick={handleInitiateApprove}
                                                    disabled={!allChecked || pendingObservationsCount > 0}
                                                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm shadow-indigo-200 transition-all text-sm flex items-center gap-2"
                                                >
                                                    <ShieldCheck className="w-4 h-4" />
                                                    {workflowState ? 'Approve Workflow Step' : 'Final Approve'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : null}
                    </main>
                </div>

                {/* Raise Observation Modal */}
                {showObsModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-center p-6 border-b shrink-0">
                                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <MessageSquareWarning className="w-6 h-6 text-amber-600" />
                                    Observation Log
                                </h3>
                                <button onClick={() => setShowObsModal(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
                                {/* Observations Header / Tabs */}
                                <div className="space-y-4">
                                    <div className="flex gap-2 border-b border-gray-200 pb-2">
                                        {(['PENDING', 'RECTIFIED', 'CLOSED', 'ALL'] as const).map(tab => (
                                            <button
                                                key={tab}
                                                onClick={() => setObsTab(tab)}
                                                className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${obsTab === tab
                                                    ? 'border-amber-600 text-amber-700'
                                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-t'
                                                    }`}
                                            >
                                                {tab === 'PENDING' ? 'Pending' : tab === 'RECTIFIED' ? 'Rectified' : tab === 'CLOSED' ? 'Closed' : 'All'}
                                                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                                                    {tab === 'ALL'
                                                        ? observations.length
                                                        : tab === 'PENDING'
                                                            ? observations.filter(o => o.status === 'PENDING' || o.status === 'OPEN').length
                                                            : observations.filter(o => o.status === 'CLOSED' || o.status === 'RECTIFIED' || o.status === 'RESOLVED').length
                                                    }
                                                </span>
                                            </button>
                                        ))}
                                    </div>

                                    {filteredObservations.length === 0 ? (
                                        <div className="text-gray-500 text-sm italic py-4">No observations match the selected tab.</div>
                                    ) : (
                                        filteredObservations.map((obs, idx) => {
                                            const ageInfo = getDaysOpen(obs.createdAt);
                                            return (
                                                <div key={obs.id} className="bg-white rounded-xl p-4 shadow-sm border">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex flex-col gap-1">
                                                            <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded w-fit ${obs.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                                                                obs.status === 'RECTIFIED' ? 'bg-blue-100 text-blue-800' :
                                                                    'bg-gray-100 text-gray-600'
                                                                }`}>
                                                                {obs.status}
                                                            </span>
                                                            <span className="text-xs font-semibold text-gray-500">[{obs.type || 'Minor'}] #{idx + 1}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {hasPermission(PermissionCode.QUALITY_OBSERVATION_DELETE) && (
                                                                <button
                                                                    onClick={() => handleDeleteObservation(obs.id)}
                                                                    className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-xs text-gray-400">{new Date(obs.createdAt).toLocaleString()}</span>
                                                                <span className={`text-[10px] ${ageInfo.color}`}>{ageInfo.text}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm font-medium text-gray-900 mt-2">{obs.observationText}</p>

                                                    {obs.photos && obs.photos.length > 0 && (
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {obs.photos.map((url: string, pIdx: number) => (
                                                                <a key={pIdx} href={getFileUrl(url)} target="_blank" rel="noreferrer" className="w-16 h-16 rounded-md border overflow-hidden hover:opacity-80 transition-opacity">
                                                                    <img src={getFileUrl(url)} alt="Observation" className="w-full h-full object-cover" />
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {obs.status === 'RECTIFIED' && (
                                                        <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                                            <p className="text-xs font-bold text-blue-900 mb-1">Rectification Details (From Site Team):</p>
                                                            <p className="text-sm text-blue-800">{obs.closureText || 'No remarks provided.'}</p>

                                                            {obs.closureEvidence && obs.closureEvidence.length > 0 && (
                                                                <div className="mt-2 flex flex-wrap gap-2">
                                                                    {obs.closureEvidence.map((url: string, pIdx: number) => (
                                                                        <a key={pIdx} href={getFileUrl(url)} target="_blank" rel="noreferrer" className="w-12 h-12 rounded border border-blue-200 overflow-hidden">
                                                                            <img src={getFileUrl(url)} alt="Rectification" className="w-full h-full object-cover" />
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            <div className="mt-3">
                                                                <button
                                                                    onClick={() => handleCloseObservation(obs.id)}
                                                                    className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 shadow-sm transition-all"
                                                                >
                                                                    Verify & Close Observation
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Add New Observation Form */}
                                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-amber-600" /> Add New Observation
                                    </h4>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Severity Type</label>
                                            <select
                                                value={obsType}
                                                onChange={e => setObsType(e.target.value)}
                                                className="w-full sm:w-1/3 border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
                                            >
                                                <option value="Minor">Minor</option>
                                                <option value="Major">Major</option>
                                                <option value="Critical">Critical</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                                            <textarea
                                                className="w-full border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-h-[100px]"
                                                placeholder="Describe the issue specifically so the site team can fix it..."
                                                value={obsText}
                                                onChange={(e) => setObsText(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1.5">Evidence Photos</label>
                                            <div className="flex flex-wrap gap-3 items-center">
                                                {currentPhotos.map((url, idx) => (
                                                    <div key={idx} className="relative w-20 h-20 group">
                                                        <img src={getFileUrl(url)} alt="Preview" className="w-full h-full object-cover rounded-lg border shadow-sm" />
                                                        <button
                                                            onClick={() => setCurrentPhotos(prev => prev.filter((_, i) => i !== idx))}
                                                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <label className={`w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition-all cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                                    <Camera className="w-6 h-6 text-gray-400" />
                                                    <span className="text-[10px] text-gray-500 mt-1 font-medium">{uploading ? 'Uploading...' : 'Add Photo'}</span>
                                                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                                                </label>
                                            </div>
                                        </div>
                                        <div className="flex justify-end pt-2">
                                            <button
                                                onClick={handleRaiseObservation}
                                                disabled={savingObs || !obsText.trim() || uploading}
                                                className="px-6 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 shadow-md transform active:scale-95 transition-all"
                                            >
                                                {savingObs ? 'Submitting...' : 'Submit Observation'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Reversal Modal */}
            {
                showReversalModal && inspectionDetail && (
                    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">Reverse RFI #{inspectionDetail.id}</h3>
                                    <p className="text-sm text-gray-500">{inspectionDetail.activity?.activityName}</p>
                                </div>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
                                <strong>Warning:</strong> Reversing will change the status to REVERSED. The raiser will be notified. All signatures are preserved for audit.
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Reason for Reversal *</label>
                                <textarea
                                    rows={4}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                    placeholder="Explain why this approval is being reversed..."
                                    value={reversalReason}
                                    onChange={e => setReversalReason(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-4 mt-6">
                                <button
                                    onClick={() => { setShowReversalModal(false); setReversalReason(''); }}
                                    className="px-6 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors flex-1"
                                >Cancel</button>
                                <button
                                    onClick={async () => {
                                        if (!reversalReason.trim()) return alert('Reason required');
                                        setReversalLoading(true);
                                        try {
                                            await api.post(`/quality/inspections/${inspectionDetail.id}/workflow/reverse`, { reason: reversalReason });
                                            alert('RFI reversed. Raiser notified.');
                                            setShowReversalModal(false);
                                            setReversalReason('');
                                            setSelectedInspectionId(null);
                                            setRefreshKey(k => k + 1);
                                        } catch (err: any) { alert(err.response?.data?.message || 'Reversal failed.'); }
                                        finally { setReversalLoading(false); }
                                    }}
                                    disabled={reversalLoading || !reversalReason.trim()}
                                    className="px-6 py-3 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-200 transition-all flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    {reversalLoading ? 'Reversing...' : 'Confirm Reversal'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Signature Modals */}
            <SignatureModal
                isOpen={showFinalApproveSig}
                onClose={() => setShowFinalApproveSig(false)}
                onSign={executeFinalApprove}
                title="Final Approval Signature"
                description="Sign to grant final approval for this RFI."
            />
            {/* Delegation Modal */}
            {showDelegationModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <UserCheck className="w-6 h-6 text-indigo-600" />
                            Delegate Approval Step
                        </h3>
                        <p className="text-sm text-gray-500 mb-6">Select a user to delegate this approval step to. They will be notified and can approve on your behalf.</p>

                        <div className="space-y-4 mb-8">
                            <label className="block text-xs font-bold text-gray-500 uppercase">Select Approver</label>
                            <select
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                onChange={(e) => setSelectedDelegateId(Number(e.target.value))}
                                value={selectedDelegateId || ''}
                            >
                                <option value="">-- Choose User --</option>
                                {eligibleUsers.map(u => (
                                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDelegationModal(false)}
                                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelegate}
                                disabled={!selectedDelegateId || delegating}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {delegating ? 'Delegating...' : 'Confirm Delegation'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Draft vs Sign Modal */}
            {showDraftOrSignModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-200">
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Save Progress</h3>
                            <p className="text-sm text-gray-500 mb-6">
                                Would you like to just save this checklist as a draft, or sign and approve this stage?
                            </p>
                            <div className="space-y-3">
                                <button
                                    onClick={async () => {
                                        setShowDraftOrSignModal(false);
                                        await saveChecklistProgress();
                                    }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-700 font-medium"
                                >
                                    <Save className="w-4 h-4" /> Save as Draft
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDraftOrSignModal(false);
                                        handleInitiateApprove();
                                    }}
                                    disabled={!allChecked || pendingObservationsCount > 0}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium disabled:opacity-50 shadow-sm"
                                    title={(!allChecked || pendingObservationsCount > 0) ? "You must complete all checklist items and close all observations before approving." : ""}
                                >
                                    <ShieldCheck className="w-4 h-4" /> Sign & Approve Step
                                </button>
                            </div>
                            <button
                                onClick={() => setShowDraftOrSignModal(false)}
                                className="mt-4 w-full text-center text-sm text-gray-400 hover:text-gray-600 font-medium"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
