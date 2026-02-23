import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, ClipboardCheck, ArrowLeft, CheckCircle2, XCircle, Camera, PenTool, Lock, Plus } from 'lucide-react';
import api from '../../../api/axios';

interface Props {
    projectId: number;
}

const QualityInspection: React.FC<Props> = ({ projectId }) => {
    const navigate = useNavigate();
    const [inspections, setInspections] = useState<any[]>([]);
    const [selectedInspection, setSelectedInspection] = useState<any>(null);
    const [activeStageId, setActiveStageId] = useState<number | null>(null);

    const [executionData, setExecutionData] = useState<any>({});
    const [signatureData, setSignatureData] = useState({ role: 'Site Engineer', name: '' });

    // Observation Modal State
    const [showObsModal, setShowObsModal] = useState(false);
    const [obsText, setObsText] = useState('');
    const [obsRemarks, setObsRemarks] = useState('');

    const fetchInspections = async () => {
        try {
            const response = await api.get(`/quality/inspections?projectId=${projectId}`);
            setInspections(response.data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchInspections();
    }, [projectId]);

    const openInspection = async (id: number) => {
        try {
            const response = await api.get(`/quality/inspections/${id}`);
            setSelectedInspection(response.data);
            if (response.data.stages && response.data.stages.length > 0) {
                setActiveStageId(response.data.stages[0].id);
            }

            // Format state for execution
            const execState: any = {};
            response.data.stages.forEach((s: any) => {
                s.items.forEach((item: any) => {
                    execState[item.id] = {
                        value: item.value || '',
                        isOk: item.isOk || false,
                        remarks: item.remarks || '',
                        photos: item.photos || []
                    };
                });
            });
            setExecutionData(execState);

        } catch (error) {
            console.error('Failed to load inspection details:', error);
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'bg-emerald-100 text-emerald-700';
            case 'REJECTED': return 'bg-red-100 text-red-700';
            case 'IN_PROGRESS':
            case 'UNDER_INSPECTION': return 'bg-blue-100 text-blue-700';
            case 'RFI_RAISED': return 'bg-yellow-100 text-yellow-700';
            case 'PENDING_OBSERVATION': return 'bg-amber-100 text-amber-800 ring-1 ring-amber-300';
            case 'NOT_STARTED': return 'bg-gray-100 text-gray-500';
            default: return 'bg-orange-100 text-orange-700'; // PENDING
        }
    };

    const handleItemChange = (itemId: number, field: string, val: any) => {
        setExecutionData((prev: any) => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: val
            }
        }));
    };

    const handleSubmitStage = async (stageId: number, status: 'APPROVED' | 'REJECTED') => {
        const stage = selectedInspection.stages.find((s: any) => s.id === stageId);

        // Prepare items array
        const itemsToUpdate = stage.items.map((i: any) => ({
            itemTemplateId: i.itemTemplate.id,
            value: executionData[i.id].value,
            isOk: executionData[i.id].isOk,
            remarks: executionData[i.id].remarks,
            photos: executionData[i.id].photos
        }));

        try {
            await api.patch(`/quality/inspections/stage/${stageId}`, {
                status,
                items: itemsToUpdate,
                signature: {
                    role: signatureData.role,
                    signedBy: signatureData.name,
                    signatureData: "data:image/png;base64,mocksignaturedata",
                    metadata: { lat: 12.9716, lng: 77.5946, ip: "127.0.0.1" }
                }
            });

            // Refresh
            openInspection(selectedInspection.id);
            alert(`Stage digitally locked and marked as ${status}!`);

        } catch (error) {
            console.error('Failed to submit stage:', error);
            alert('Error updating stage. Ensure all mandatory fields are filled.');
        }
    };

    const handleAddObservation = async () => {
        if (!obsText.trim()) return alert("Observation text is required.");

        const currentStage = selectedInspection?.stages?.find((s: any) => s.id === activeStageId);

        try {
            await api.post(`/quality/activities/${selectedInspection.activityId}/observation`, {
                observationText: obsText,
                remarks: obsRemarks,
                checklistId: currentStage?.stageTemplateId
            });
            setShowObsModal(false);
            setObsText('');
            setObsRemarks('');
            alert('Observation added successfully. Activity flagged as PENDING_OBSERVATION.');
            navigate(`/dashboard/projects/${projectId}/quality`);
        } catch (error) {
            console.error('Failed to add observation:', error);
        }
    };

    // If viewing a specific inspection
    if (selectedInspection) {
        const currentStage = selectedInspection.stages.find((s: any) => s.id === activeStageId);
        const stageLocked = ['APPROVED', 'REJECTED'].includes(currentStage?.status);

        return (
            <div className="h-full flex flex-col bg-gray-50 animate-in fade-in duration-300">
                {/* Header */}
                <div className="bg-white px-6 py-4 border-b border-gray-200 shadow-sm flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSelectedInspection(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-bold text-gray-900">Inspection #{selectedInspection.id}</h2>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${getStatusStyle(selectedInspection.status)}`}>
                                    {selectedInspection.status}
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 font-medium">{selectedInspection.activity?.activityName || 'Activity'}</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex">
                    {/* Sidebar: Stages */}
                    <div className="w-80 bg-white border-r border-gray-200 flex flex-col items-stretch overflow-y-auto">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Inspection Stages</h3>
                        </div>
                        <div className="flex-1 p-3 space-y-2">
                            {selectedInspection.stages?.map((stage: any) => (
                                <button
                                    key={stage.id}
                                    onClick={() => setActiveStageId(stage.id)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all ${activeStageId === stage.id
                                        ? 'bg-orange-50 border-orange-200 shadow-sm'
                                        : 'bg-white border-gray-100 hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-sm font-bold truncate ${activeStageId === stage.id ? 'text-orange-900' : 'text-gray-700'}`}>
                                            {stage.stageTemplate.name}
                                        </span>
                                        {stage.status === 'APPROVED' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                        {stage.status === 'REJECTED' && <XCircle className="w-4 h-4 text-red-500" />}
                                        {stage.status === 'PENDING' && <div className="w-2 h-2 rounded-full bg-gray-300"></div>}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        {stage.stageTemplate.isHoldPoint && (
                                            <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold">Hold Point</span>
                                        )}
                                        <span>{stage.items.length} items</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Stage Execution Area */}
                    {currentStage && (
                        <div className="flex-1 overflow-y-auto bg-gray-50 p-6 custom-scrollbar">
                            <div className="max-w-4xl mx-auto space-y-6">

                                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">{currentStage.stageTemplate.name}</h3>
                                        {stageLocked && (
                                            <div className="mt-2 flex items-center gap-2 text-sm text-emerald-700 font-medium bg-emerald-50 px-3 py-1 rounded-lg w-max border border-emerald-100">
                                                <Lock className="w-4 h-4" /> Digitally Locked
                                            </div>
                                        )}
                                    </div>
                                    {!stageLocked && (
                                        <div className="text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-xl font-medium">
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
                                            <div key={item.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden group">
                                                <div className="p-5 flex gap-4 items-start border-b border-gray-50">
                                                    <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-sm shrink-0">
                                                        {index + 1}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div className="font-bold text-gray-900 flex-1">{template.itemText}</div>
                                                            <div className="flex gap-2 shrink-0 ml-4">
                                                                {template.isMandatory && <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded uppercase">Req</span>}
                                                            </div>
                                                        </div>

                                                        <div className="space-y-4 max-w-lg">
                                                            {/* YES/NA Type */}
                                                            {(template.type === 'YES_NO' || template.type === 'YES_OR_NA') && (
                                                                <div className="flex gap-3">
                                                                    <button
                                                                        disabled={stageLocked}
                                                                        onClick={() => {
                                                                            handleItemChange(item.id, 'isOk', true);
                                                                            handleItemChange(item.id, 'value', 'YES');
                                                                        }}
                                                                        className={`flex-1 py-2.5 rounded-xl border-2 font-bold text-sm transition-all focus:outline-none focus:ring-4 focus:ring-emerald-500/20 ${data.isOk === true && data.value === 'YES' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500 hover:border-emerald-200 disabled:opacity-50'}`}
                                                                    >
                                                                        YES
                                                                    </button>
                                                                    <button
                                                                        disabled={stageLocked}
                                                                        onClick={() => {
                                                                            handleItemChange(item.id, 'isOk', true);
                                                                            handleItemChange(item.id, 'value', 'NA');
                                                                        }}
                                                                        className={`flex-1 py-2.5 rounded-xl border-2 font-bold text-sm transition-all focus:outline-none focus:ring-4 focus:ring-gray-500/20 ${data.isOk === true && data.value === 'NA' ? 'border-gray-500 bg-gray-100 text-gray-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 disabled:opacity-50'}`}
                                                                    >
                                                                        N/A
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {/* TEXT Type */}
                                                            {template.type === 'TEXT' && (
                                                                <input
                                                                    type="text"
                                                                    disabled={stageLocked}
                                                                    placeholder="Enter observation..."
                                                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                                                                    value={data.value}
                                                                    onChange={(e) => {
                                                                        handleItemChange(item.id, 'value', e.target.value);
                                                                        handleItemChange(item.id, 'isOk', !!e.target.value); // Just arbitrary checking logic
                                                                    }}
                                                                />
                                                            )}

                                                            <div className="flex gap-4">
                                                                {template.photoRequired && (
                                                                    <button disabled={stageLocked} className="flex items-center gap-2 text-xs font-semibold text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
                                                                        <Camera className="w-4 h-4" /> Add Photo
                                                                    </button>
                                                                )}
                                                                <input
                                                                    type="text"
                                                                    disabled={stageLocked}
                                                                    placeholder="Add remarks (optional)..."
                                                                    className="flex-1 bg-transparent border-b border-gray-200 text-xs px-2 py-1 focus:border-indigo-500 outline-none disabled:opacity-50"
                                                                    value={data.remarks}
                                                                    onChange={(e) => handleItemChange(item.id, 'remarks', e.target.value)}
                                                                />
                                                            </div>
                                                        </div>

                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Sign Off Block */}
                                {!stageLocked && (
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mt-8">
                                        <h4 className="text-indigo-900 font-bold flex items-center gap-2 mb-4">
                                            <PenTool className="w-5 h-5 text-indigo-600" />
                                            Sign Off & Complete Stage
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4 mb-6">
                                            <div>
                                                <label className="block text-xs font-bold text-indigo-800/60 uppercase mb-1">Role</label>
                                                <select
                                                    className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                                                    value={signatureData.role}
                                                    onChange={(e) => setSignatureData(prev => ({ ...prev, role: e.target.value }))}
                                                >
                                                    <option>Site Engineer</option>
                                                    <option>QA/QC Manager</option>
                                                    <option>Client Rep</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-indigo-800/60 uppercase mb-1">Name / ID</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                                                    value={signatureData.name}
                                                    onChange={(e) => setSignatureData(prev => ({ ...prev, name: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 border-t border-indigo-200/50 pt-6">
                                            <button
                                                onClick={() => setShowObsModal(true)}
                                                className="px-6 py-3 rounded-xl font-bold text-orange-600 bg-white border-2 border-orange-100 hover:border-orange-200 hover:bg-orange-50 transition-colors"
                                            >
                                                Keep Pending with Observation
                                            </button>
                                            <button
                                                onClick={() => handleSubmitStage(currentStage.id, 'APPROVED')}
                                                className="flex-1 px-6 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Lock className="w-4 h-4" /> Sign & Lock Stage as Passed
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {stageLocked && (
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-emerald-800">
                                        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                                        <div className="text-center">
                                            <h4 className="font-bold text-lg">Stage Completed</h4>
                                            <p className="text-sm opacity-80">This stage's execution has been verified and digitally signed.</p>
                                        </div>
                                        <div className="mt-4 p-4 bg-white rounded-xl shadow-sm text-xs font-mono break-all text-gray-500 border border-emerald-100 max-w-full">
                                            <div className="font-bold text-emerald-700 mb-1 border-b pb-1">SHA-256 Signature Hash</div>
                                            {currentStage.signatures?.[0]?.lockHash || '9a4b8df2...'}
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
                        <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Add Observation</h3>
                            <p className="text-sm text-gray-500 mb-6">Describe the issue. The activity will be flagged as Pending Observation, and approval will be paused until this is resolved.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Observation Details</label>
                                    <textarea
                                        rows={4}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        placeholder="E.g., Surface uneven, reinforcement incorrect..."
                                        value={obsText}
                                        onChange={e => setObsText(e.target.value)}
                                    ></textarea>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Remarks / Action Required (Optional)</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        placeholder="Action for the contractor..."
                                        value={obsRemarks}
                                        onChange={e => setObsRemarks(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 mt-8">
                                <button
                                    onClick={() => setShowObsModal(false)}
                                    className="px-6 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors flex-1"
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
        );
    }

    // List View
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100 w-96 focus-within:ring-2 focus-within:ring-orange-500 transition-all">
                    <Search className="w-5 h-5 text-gray-400" />
                    <input type="text" placeholder="Search Request for Inspections..." className="bg-transparent border-none focus:ring-0 text-sm w-full p-0" />
                </div>
                <button
                    onClick={() => navigate(`/dashboard/projects/${projectId}/quality/inspections`)}
                    className="flex items-center gap-2 bg-orange-600 text-white px-6 py-2.5 rounded-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-200"
                >
                    <Plus className="w-5 h-5" />
                    <span className="font-bold">Raise RFI</span>
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">ID / Activity</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Location</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date Raised</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {inspections.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-12 text-center text-gray-500">
                                    <ClipboardCheck className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                                    No Inspections found. Raise an RFI from the Schedule to start.
                                </td>
                            </tr>
                        ) : (
                            inspections.map((item) => (
                                <tr key={item.id} className="hover:bg-orange-50/30 transition-colors group cursor-pointer" onClick={() => openInspection(item.id)}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="font-mono text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">#{item.id}</div>
                                            <p className="font-bold text-gray-900 group-hover:text-orange-600 transition-colors">{item.activity?.activityName || 'N/A'}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600">
                                            <MapPin className="w-4 h-4 text-gray-400" /> EPS Node {item.epsNodeId}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${getStatusStyle(item.status)}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600">
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            {new Date(item.createdAt).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-sm font-bold text-orange-600 hover:text-orange-700 bg-orange-50 px-4 py-2 rounded-xl transition-all">
                                            Execute
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default QualityInspection;
