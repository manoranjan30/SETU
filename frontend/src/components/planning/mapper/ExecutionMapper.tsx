import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../../api/axios';
import { Split, Link as LinkIcon } from 'lucide-react';
// import BoqTreePanel from './BoqTreePanel'; // Replaced
import BoqGridPanel from './BoqGridPanel';
import ActivityPickerModal from './ActivityPickerModal';

const ExecutionMapper: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const [selectedBoqIds, setSelectedBoqIds] = useState<(number | string)[]>([]); // Allow Strings for SubItems
    const [activities, setActivities] = useState<any[]>([]);
    const [boqItems, setBoqItems] = useState<any[]>([]); // New State
    const [epsNodes, setEpsNodes] = useState<any[]>([]); // EPS Data
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        if (projectId) {
            fetchActivities();
            fetchBoqItems();
            fetchEpsNodes();
        }
    }, [projectId, refreshTrigger]); // Refresh BOQ when trigger changes

    const fetchBoqItems = async () => {
        try {
            const res = await api.get(`/planning/mapper/boq/${projectId}`);
            setBoqItems(res.data);
        } catch (error) {
            console.error('Failed to fetch BOQ items', error);
        }
    };

    const fetchActivities = async () => {
        try {
            const res = await api.get(`/projects/${projectId}/wbs/activities`);
            setActivities(res.data);
        } catch (error) {
            console.error('Failed to fetch activities', error);
        }
    };

    const fetchEpsNodes = async () => {
        try {
            const res = await api.get(`/eps`); // Fetch all EPS (filtered by user access usually)
            setEpsNodes(res.data);
        } catch (error) {
            console.error('Failed to fetch EPS nodes', error);
        }
    };

    const handleLink = async (targetActivityId: number) => {
        if (selectedBoqIds.length === 0 || !targetActivityId) return;

        try {
            for (const id of selectedBoqIds) {
                let payload: any = {
                    activityId: targetActivityId,
                    quantity: -1, // Full remaining
                    basis: 'INITIAL'
                };

                if (typeof id === 'number') {
                    // Main Item
                    payload.boqItemId = id;
                } else if (typeof id === 'string') {
                    // Granular Item: Format TYPE:ParentID:SubID[:MeasID]
                    const parts = id.split(':');
                    const type = parts[0];
                    const boqItemId = parseInt(parts[1]);

                    if (type === 'SUB') {
                        payload.boqItemId = boqItemId;
                        payload.boqSubItemId = parseInt(parts[2]);
                    } else if (type === 'MEAS') {
                        payload.boqItemId = boqItemId;
                        // payload.boqSubItemId = parseInt(parts[2]); // Meas also belongs to sub, probably good to send?
                        // Schema has measurementId. Backend distribute logic doesn't strictly require subId if measId is present, 
                        // but it helps finding unique constraint.
                        // Let's send both.
                        payload.boqSubItemId = parseInt(parts[2]);
                        payload.measurementId = parseInt(parts[3]);
                    }
                }

                if (payload.boqItemId) {
                    await api.post(`/planning/distribute`, payload);
                }
            }

            // Success
            setIsLinkModalOpen(false);
            setSelectedBoqIds([]);
            setRefreshTrigger(prev => prev + 1); // Increment refresh trigger

            // UX Improvement: Show success toast/alert instead of reload
            // In a real app, we would refetch data here.
            // For MVP, alerting user is better than jarring reload.
            alert('Successfully Linked! Please refresh manually if needed to see status updates.');

        } catch (error) {
            console.error('Linking failed', error);
            alert('Linking failed. See console.');
        }
    };

    const handleUnlink = async () => {
        if (selectedBoqIds.length === 0) return;
        if (!confirm('Are you sure you want to unlink the selected items?')) return;

        try {
            for (const id of selectedBoqIds) {
                let payload: any = {};

                if (typeof id === 'number') {
                    payload.boqItemId = id;
                } else if (typeof id === 'string') {
                    const parts = id.split(':');
                    const type = parts[0];
                    const boqItemId = parseInt(parts[1]);

                    payload.boqItemId = boqItemId;

                    if (type === 'SUB') {
                        payload.boqSubItemId = parseInt(parts[2]);
                    } else if (type === 'MEAS') {
                        // For Unlink, we might need specific measurement ID
                        // Check if backend unlink supports it. Yes, updated service supports measurementId
                        payload.boqSubItemId = parseInt(parts[2]); // Optional but good for safety
                        payload.measurementId = parseInt(parts[3]);
                    }
                }

                if (payload.boqItemId) {
                    await api.post(`/planning/unlink`, payload);
                }
            }
            setSelectedBoqIds([]);
            setRefreshTrigger(prev => prev + 1);
            alert('Successfully Unlinked!');
        } catch (error) {
            console.error('Unlink failed', error);
            alert('Unlink failed.');
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header / Toolbar */}
            <div className="h-14 bg-white border-b flex items-center justify-between px-4 shadow-sm z-10">
                <div className="flex items-center gap-2 text-gray-700">
                    <Split className="text-blue-600" size={20} />
                    <h1 className="font-bold text-lg">Qty Mapper</h1>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-medium">
                        Project #{projectId}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 mr-2">
                        {selectedBoqIds.length} items selected
                    </span>

                    <button
                        onClick={handleUnlink}
                        disabled={selectedBoqIds.length === 0}
                        className={`px-3 py-2 rounded shadow-sm text-sm font-medium transition-colors border
                            ${selectedBoqIds.length > 0
                                ? 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                                : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'}`}
                    >
                        Unlink
                    </button>

                    <button
                        onClick={() => setIsLinkModalOpen(true)}
                        disabled={selectedBoqIds.length === 0}
                        className={`flex items-center gap-2 px-4 py-2 rounded shadow-sm transition-colors text-sm font-medium
                            ${selectedBoqIds.length > 0
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                    >
                        <LinkIcon size={16} />
                        Link to Schedule
                    </button>
                </div>
            </div>

            {/* Main Content: Full Width BOQ Tree */}
            <div className="flex-1 overflow-hidden p-4">
                <div className="bg-white rounded-lg shadow h-full border overflow-hidden">
                    <BoqGridPanel
                        projectId={parseInt(projectId!)}
                        items={boqItems}
                        selectedIds={selectedBoqIds}
                        onSelectionChange={setSelectedBoqIds}
                        epsNodes={epsNodes}
                    />
                </div>
                {/* Modal for Linking */}
                <ActivityPickerModal
                    isOpen={isLinkModalOpen}
                    onClose={() => setIsLinkModalOpen(false)}
                    onConfirm={handleLink}
                    activities={activities}
                    projectId={parseInt(projectId!)}
                />
            </div>
        </div>
    );
};

export default ExecutionMapper;
