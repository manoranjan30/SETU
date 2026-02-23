import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
    ClipboardCheck, AlertCircle, CheckCircle2, Clock,
    Save, ShieldCheck, UserCheck, CheckSquare, Square
} from 'lucide-react';
import api from '../../api/axios';

interface QualityInspection {
    id: number;
    activityId: number;
    epsNodeId: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';
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
            api.get(`/quality/inspections/${selectedInspectionId}`).then(res => {
                setInspectionDetail(res.data);
            }).finally(() => setLoadingDetail(false));
        } else {
            setInspectionDetail(null);
        }
    }, [selectedInspectionId, refreshKey]);

    const filteredInspections = useMemo(() => {
        return inspections.filter(i => filterStatus === 'ALL' || i.status === filterStatus);
    }, [inspections, filterStatus]);

    const handleItemToggle = (stageIdx: number, itemIdx: number) => {
        setInspectionDetail((prev: any) => {
            const next = { ...prev };
            const item = next.stages[stageIdx].items[itemIdx];
            item.isOk = !item.isOk;
            return next;
        });
    };

    const handleItemRemarksChange = (stageIdx: number, itemIdx: number, val: string) => {
        setInspectionDetail((prev: any) => {
            const next = { ...prev };
            const item = next.stages[stageIdx].items[itemIdx];
            item.remarks = val;
            return next;
        });
    };

    const saveChecklistProgress = async () => {
        if (!inspectionDetail) return;
        try {
            // Must save each stage sequentially
            for (const stage of inspectionDetail.stages) {
                await api.patch(`/quality/inspections/stage/${stage.id}`, {
                    status: stage.status, // Keep existing status or update to IN_PROGRESS
                    items: stage.items.map((it: any) => ({
                        id: it.id,
                        value: it.value,
                        isOk: it.isOk,
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

    const handleApprove = async () => {
        if (!confirm('Are you sure you want to approve this RFI? All checklist items must be checked.')) return;
        try {
            // First save the checklist progress
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

            // Then approve the inspection
            await api.patch(`/quality/inspections/${inspectionDetail.id}/status`, {
                status: 'APPROVED',
                comments: 'Approved after completing checklist',
                inspectionDate: new Date().toISOString().split('T')[0]
            });
            alert('Inspection Approved!');
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

            await api.patch(`/quality/inspections/${inspectionDetail.id}/status`, {
                status: 'REJECTED',
                comments: reason || 'Rejected during checklist execution',
                inspectionDate: new Date().toISOString().split('T')[0]
            });
            alert('Inspection Rejected.');
            setSelectedInspectionId(null);
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to reject RFI.');
        }
    };

    // Calculate if all items are checked
    const allChecked = useMemo(() => {
        if (!inspectionDetail?.stages) return false;
        if (inspectionDetail.stages.length === 0) return true; // Empty checklist can be approved
        return inspectionDetail.stages.every((s: any) => s.items?.every((i: any) => i.isOk));
    }, [inspectionDetail]);

    return (
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
                                onClick={() => setFilterStatus('PENDING')}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${filterStatus === 'PENDING' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Pending QC
                            </button>
                            <button
                                onClick={() => setFilterStatus('ALL')}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${filterStatus === 'ALL' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
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
                                            insp.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                'bg-amber-100 text-amber-700'
                                            }`}>
                                            {insp.status}
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
                                        onClick={saveChecklistProgress}
                                        disabled={inspectionDetail.status !== 'PENDING'}
                                        className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm disabled:opacity-50"
                                    >
                                        <Save className="w-4 h-4" /> Save Progress
                                    </button>
                                </div>
                            </div>

                            {/* Checklist Area */}
                            <div className="flex-1 overflow-y-auto p-8">
                                <div className="max-w-4xl mx-auto space-y-6 pb-20">
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
                                                        {stage.items?.filter((i: any) => i.isOk).length} / {stage.items?.length} Completed
                                                    </span>
                                                </div>
                                                <div className="divide-y">
                                                    {stage.items?.sort((a: any, b: any) => (a.itemTemplate?.sequence || 0) - (b.itemTemplate?.sequence || 0)).map((item: any, iIdx: number) => (
                                                        <div key={item.id} className="p-4 flex gap-4 hover:bg-gray-50 transition-colors">
                                                            <button
                                                                onClick={() => handleItemToggle(sIdx, iIdx)}
                                                                disabled={inspectionDetail.status !== 'PENDING'}
                                                                className="mt-0.5 shrink-0 text-gray-400 hover:text-indigo-600 disabled:opacity-50"
                                                            >
                                                                {item.isOk ? <CheckSquare className="w-6 h-6 text-indigo-600" /> : <Square className="w-6 h-6" />}
                                                            </button>
                                                            <div className="flex-1">
                                                                <p className={`text-sm ${item.isOk ? 'text-gray-700 font-medium' : 'text-gray-900'}`}>
                                                                    {item.itemTemplate?.checkText || 'Checklist Item'}
                                                                </p>
                                                                {inspectionDetail.status === 'PENDING' ? (
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Add remarks..."
                                                                        value={item.remarks || ''}
                                                                        onChange={(e) => handleItemRemarksChange(sIdx, iIdx, e.target.value)}
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
                            {inspectionDetail.status === 'PENDING' && (
                                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                                    <div className="max-w-4xl mx-auto flex items-center justify-between">
                                        <div className="text-sm">
                                            {!allChecked ? (
                                                <span className="text-red-600 font-medium flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Please complete all checklist items before approving.</span>
                                            ) : (
                                                <span className="text-green-600 font-medium flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Checklist complete. Ready for approval.</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={handleReject}
                                                className="px-6 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 focus:ring-2 focus:ring-red-200 font-medium"
                                            >
                                                Reject Checklist
                                            </button>
                                            <button
                                                onClick={handleApprove}
                                                disabled={!allChecked}
                                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm transition-all"
                                            >
                                                Approve RFI
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : null}
                </main>
            </div>
        </div>
    );
}
