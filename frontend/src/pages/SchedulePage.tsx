import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { Play, Upload } from 'lucide-react';
import ScheduleTable from '../components/schedule/ScheduleTable';
import ScheduleImportWizard from '../components/schedule/ScheduleImportWizard';

const SchedulePage: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const [searchParams] = useSearchParams();
    const versionId = searchParams.get('versionId');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scheduleData, setScheduleData] = useState<{ activities: any[], relationships: any[] } | null>(null);
    const [wbsNodes, setWbsNodes] = useState<any[]>([]); // New State for WBS
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%

    const [projectCode, setProjectCode] = useState<string>('');
    const [lastRefresh, setLastRefresh] = useState(new Date());

    useEffect(() => {
        if (projectId) fetchData();
    }, [projectId, lastRefresh, versionId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const promises: any[] = [
                api.get(`/projects/${projectId}/wbs`),
                api.get(`/eps/${projectId}/profile`)
            ];

            if (versionId) {
                // Fetch Version Data
                promises.unshift(api.get(`/planning/versions/${versionId}/activities?projectId=${projectId}`));
                // Fetch Relationships (from Master for now)
                promises.push(api.get(`/planning/${projectId}/relationships`));
            } else {
                // Fetch Master Data
                promises.unshift(api.get(`/projects/${projectId}/schedule`));
            }

            const results = await Promise.all(promises);
            let schedData, wbsRes, profileRes, relRes;

            if (versionId) {
                // results: [activities, wbs, profile, relationships]
                schedData = { data: results[0].data };
                wbsRes = results[1];
                profileRes = results[2];
                relRes = results[3];
            } else {
                // results: [schedule, wbs, profile]
                const [s, w, p] = results;
                schedData = s;
                wbsRes = w;
                profileRes = p;
            }

            setWbsNodes(wbsRes.data);
            setProjectCode(profileRes.data?.projectCode || '');

            if (versionId) {
                // Map ActivityVersion to Activity shape
                const versionActivities = schedData.data.map((av: any) => ({
                    ...av.activity, // Base info (id, code, name)
                    ...av,          // Version info (dates, float) overrides base
                    id: av.activity.id, // Keep original Activity ID for linking
                    _versionId: av.id, // Store key to ActivityVersion record

                    startDatePlanned: av.startDate,
                    finishDatePlanned: av.finishDate,
                    durationPlanned: av.duration,
                }));

                setScheduleData({
                    activities: versionActivities,
                    relationships: relRes.data // use fetched relationships
                });
            } else {
                setScheduleData(schedData.data);
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to fetch schedule");
        } finally {
            setLoading(false);
        }
    };

    const handleCalculate = async () => {
        try {
            setLoading(true);
            await api.post(`/projects/${projectId}/schedule/calculate`);
            setLastRefresh(new Date()); // Trigger refetch
        } catch (err) {
            console.error(err);
            alert('Calculation Failed');
            setLoading(false);
        }
    };

    const handleUpdateActivity = async (activityId: number, field: string, value: any) => {
        try {
            // Optimistic update could go here, but for now just wait for reload or direct patch

            if (versionId) {
                // VERSION MODE UPDATE
                // 1. Find current activity to get other date
                const currentActivity = scheduleData?.activities.find(a => a.id === activityId);
                if (!currentActivity) return;

                // 2. Call Version Endpoint
                const payload: any = {};
                if (field === 'startDatePlanned') payload.startDate = value;
                if (field === 'finishDatePlanned') payload.finishDate = value;
                if (field === 'startDateActual') payload.actualStart = value;
                if (field === 'finishDateActual') payload.actualFinish = value;

                // Pass existing planned dates if not changing them? 
                // The backend treats undefined as "no change", so we only send what changed or explicit nulls.
                // However, the previous logic was sending BOTH planned dates always.
                // Let's keep it simple: only send what we modify + existing planned if needed?
                // Actually, backend now handles optional. So we can just send the changed field.

                // Note: The previous code retrieved current planned dates. 
                // "let start = currentActivity.startDatePlanned..."
                // if we are editing actuals, we don't need to send planned.

                // Let's construct a cleaner payload
                if (field === 'startDatePlanned' || field === 'finishDatePlanned') {
                    payload.startDate = field === 'startDatePlanned' ? value : currentActivity.startDatePlanned;
                    payload.finishDate = field === 'finishDatePlanned' ? value : currentActivity.finishDatePlanned;
                }

                await api.patch(`/planning/versions/${versionId}/activities/${activityId}?projectId=${projectId}`, payload);

            } else {
                // MASTER MODE UPDATE
                await api.patch(`/projects/${projectId}/wbs/activities/${activityId}`, { [field]: value });
            }

            // Update local state to reflect change immediately
            setScheduleData(prev => {
                if (!prev) return null;
                const updatedActivities = prev.activities.map(a =>
                    a.id === activityId ? { ...a, [field]: value } : a
                );
                return { ...prev, activities: updatedActivities };
            });
        } catch (err) {
            console.error("Failed to update activity", err);
            alert("Failed to update date");
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-gray-800">
                        {versionId ? 'Working Schedule Version' : 'Master Project Schedule'}
                    </h1>
                    <p className="text-sm text-gray-500">
                        {versionId ? 'Editing Baseline / revised dates' : 'CPM Engine & Imports'}
                    </p>
                </div>
                <div className="flex gap-2 items-center">

                    {/* Zoom Controls */}
                    <div className="bg-gray-100 p-1 rounded-lg flex mr-2">
                        <button onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.1))} className="px-3 py-1 text-gray-600 hover:bg-white rounded">-</button>
                        <span className="px-2 py-1 text-xs text-gray-500 min-w-[3rem] text-center">{Math.round(zoomLevel * 100)}%</span>
                        <button onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.1))} className="px-3 py-1 text-gray-600 hover:bg-white rounded">+</button>
                    </div>

                    <button
                        onClick={async () => {
                            if (!confirm('This will recalculate all activity DURATIONS based on their Planned Start and Finish dates using the Project Calendar. This creates proper alignment for CPM. Continue?')) return;
                            try {
                                setLoading(true);
                                await api.post(`/projects/${projectId}/schedule/repair-durations`);
                                alert('Durations Repaired & Schedule Recalculated');
                                setLastRefresh(new Date());
                            } catch (e) {
                                console.error(e);
                                alert('Failed to repair durations');
                                setLoading(false);
                            }
                        }}
                        className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 font-medium shadow-sm transition-colors mr-2"
                        title="Sync Durations with Dates"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-wrench w-4 h-4 mr-2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
                        Repair Durations
                    </button>

                    <button
                        onClick={async () => {
                            if (!confirm('This will Synchronize your PLANNED dates to match the CPM Calculated dates. Your original dates will be saved as MSP Dates. Continue?')) return;
                            try {
                                setLoading(true);
                                await api.post(`/projects/${projectId}/schedule/reschedule`);
                                alert('Project Rescheduled Successfully');
                                setLastRefresh(new Date());
                            } catch (e) {
                                console.error(e);
                                alert('Failed to reschedule');
                                setLoading(false);
                            }
                        }}
                        className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 font-medium shadow-sm transition-colors mr-2"
                        title="Sync Planned Dates to CPM"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-refresh-cw w-4 h-4 mr-2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" /></svg>
                        Reschedule
                    </button>

                    <button
                        onClick={handleCalculate}
                        className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium shadow-sm transition-colors"
                    >
                        <Play className="w-4 h-4 mr-2" />
                        Run CPM
                    </button>

                    <button
                        onClick={() => setIsImportOpen(true)}
                        className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium shadow-sm"
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        Import (MSP/P6)
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden bg-gray-50 p-4">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-gray-500">Loading Schedule...</div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full text-red-600 font-bold bg-white rounded shadow p-10">
                        Error Loading Schedule: {error}
                    </div>
                ) : !scheduleData ? (
                    <div className="flex items-center justify-center h-full text-gray-400 font-medium bg-white rounded shadow p-10">
                        No Schedule Data Found. Please Import a Project.
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow h-full overflow-hidden flex flex-col">
                        <ScheduleTable
                            activities={scheduleData.activities}
                            relationships={scheduleData.relationships}
                            wbsNodes={wbsNodes}
                            zoom={zoomLevel}
                            projectCode={projectCode}
                            onUpdateActivity={handleUpdateActivity}
                        />
                    </div>
                )}
            </div>

            {/* Modals */}
            <ScheduleImportWizard
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
                projectId={Number(projectId)}
                onSuccess={() => {
                    fetchData();
                }}
            />
        </div>
    );
};

export default SchedulePage;
