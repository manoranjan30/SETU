import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../../api/axios';
import { Split, Link as LinkIcon } from 'lucide-react';
import BoqGridPanel from './BoqGridPanel';
import ActivityPickerModal from './ActivityPickerModal';

const ExecutionMapper: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const [selectedWoItemIds, setSelectedWoItemIds] = useState<number[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [vendorTree, setVendorTree] = useState<any[]>([]);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        if (projectId) {
            fetchActivities();
            fetchVendorTree();
        }
    }, [projectId, refreshTrigger]);

    const fetchVendorTree = async () => {
        try {
            const res = await api.get(`/workdoc/mapper/wo-items/${projectId}`);
            setVendorTree(res.data);
        } catch (error) {
            console.error('Failed to fetch WO items tree', error);
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

    const handleLink = async (targetActivityId: number) => {
        if (selectedWoItemIds.length === 0 || !targetActivityId) return;

        try {
            for (const woItemId of selectedWoItemIds) {
                await api.post(`/planning/distribute-wo`, {
                    projectId: parseInt(projectId as string, 10),
                    activityId: targetActivityId,
                    workOrderItemId: woItemId,
                    quantity: -1,
                });
            }

            setIsLinkModalOpen(false);
            setSelectedWoItemIds([]);
            setRefreshTrigger(prev => prev + 1);
            alert('Successfully linked to schedule!');
        } catch (error) {
            console.error('Linking failed', error);
            alert('Linking failed. See console for details.');
        }
    };

    const handleUnlink = async () => {
        if (selectedWoItemIds.length === 0) return;
        if (!confirm('Are you sure you want to unlink the selected items?')) return;

        try {
            for (const woItemId of selectedWoItemIds) {
                await api.post(`/planning/unlink-wo`, {
                    projectId: parseInt(projectId as string, 10),
                    workOrderItemId: woItemId,
                });
            }
            setSelectedWoItemIds([]);
            setRefreshTrigger(prev => prev + 1);
            alert('Successfully unlinked!');
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
                    <h1 className="font-bold text-lg">WO Qty Mapper</h1>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-medium">
                        Project #{projectId}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 mr-2">
                        {selectedWoItemIds.length} items selected
                    </span>

                    <button
                        onClick={handleUnlink}
                        disabled={selectedWoItemIds.length === 0}
                        className={`px-3 py-2 rounded shadow-sm text-sm font-medium transition-colors border
                            ${selectedWoItemIds.length > 0
                                ? 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                                : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'}`}
                    >
                        Unlink
                    </button>

                    <button
                        onClick={() => setIsLinkModalOpen(true)}
                        disabled={selectedWoItemIds.length === 0}
                        className={`flex items-center gap-2 px-4 py-2 rounded shadow-sm transition-colors text-sm font-medium
                            ${selectedWoItemIds.length > 0
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                    >
                        <LinkIcon size={16} />
                        Link to Schedule
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden p-4">
                <div className="bg-white rounded-lg shadow h-full border overflow-hidden">
                    <BoqGridPanel
                        vendorTree={vendorTree}
                        selectedWoItemIds={selectedWoItemIds}
                        onSelectionChange={setSelectedWoItemIds}
                    />
                </div>
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
