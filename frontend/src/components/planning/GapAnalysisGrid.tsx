import React, { useState, useEffect, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community'; // Type-only import
import api from '../../api/axios';
import { Loader2 } from 'lucide-react';

interface ActivityGapData {
    id: number;
    activityName: string;
    activityCode: string;
    wbsPath: string;
    isLinked: boolean;
    linkCount: number;
    percentComplete: number;
    status: string;
    gapStatus: 'OK' | 'MISSING_BOQ' | 'CRITICAL_UNLINKED_EXECUTION' | 'READY';
}

interface GapAnalysisGridProps {
    projectId: number;
}

export const GapAnalysisGrid: React.FC<GapAnalysisGridProps> = ({ projectId }) => {
    const [rowData, setRowData] = useState<ActivityGapData[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, missing: 0, critical: 0, ready: 0 });

    const fetchGapAnalysis = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/planning/${projectId}/gap-analysis`);
            setRowData(response.data);

            // Calculate stats
            const s = response.data.reduce((acc: any, row: ActivityGapData) => {
                acc.total++;
                if (row.gapStatus === 'MISSING_BOQ') acc.missing++;
                if (row.gapStatus === 'CRITICAL_UNLINKED_EXECUTION') acc.critical++;
                if (row.gapStatus === 'READY') acc.ready++;
                return acc;
            }, { total: 0, missing: 0, critical: 0, ready: 0 });
            setStats(s);

        } catch (error) {
            console.error("Failed to fetch gap analysis", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) fetchGapAnalysis();
    }, [projectId]);

    const colDefs = useMemo<ColDef[]>(() => [
        { field: 'wbsPath', headerName: 'WBS Location', flex: 2, filter: true },
        { field: 'activityName', headerName: 'Activity Name', flex: 2, filter: true },
        {
            field: 'expectStatus', headerName: 'Link Status', flex: 1,
            valueGetter: (p: any) => p.data.gapStatus,
            cellRenderer: (p: any) => {
                const status = p.value;
                const baseClass = "px-2 py-1 rounded text-xs font-semibold";
                if (status === 'OK') return <span className={`${baseClass} bg-green-100 text-green-800`}>Linked</span>;
                if (status === 'READY') return <span className={`${baseClass} bg-blue-100 text-blue-800`}>Ready</span>;
                if (status === 'MISSING_BOQ') return <span className={`${baseClass} bg-orange-100 text-orange-800`}>Missing BOQ</span>;
                if (status === 'CRITICAL_UNLINKED_EXECUTION') return <span className={`${baseClass} bg-red-100 text-red-800`}>Unlinked Execution</span>;
                return status;
            }
        },
        {
            field: 'percentComplete', headerName: '% Complete', flex: 1,
            cellRenderer: (p: any) => p.value > 0 ? `${p.value}%` : '-'
        }
    ], []);

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    const StatCard = ({ title, value, colorClass }: { title: string, value: number, colorClass: string }) => (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-xs font-medium text-gray-500 uppercase">{title}</div>
            <div className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</div>
        </div>
    );

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="grid grid-cols-4 gap-4">
                <StatCard title="Total Activities" value={stats.total} colorClass="text-gray-900" />
                <StatCard title="Missing BOQ" value={stats.missing} colorClass="text-orange-600" />
                <StatCard title="Critical Unlinked" value={stats.critical} colorClass="text-red-600" />
                <StatCard title="Ready to Execute" value={stats.ready} colorClass="text-green-600" />
            </div>

            <div className="ag-theme-alpine flex-1 w-full" style={{ minHeight: 400 }}>
                <AgGridReact
                    rowData={rowData}
                    columnDefs={colDefs}
                    defaultColDef={{ resizable: true, sortable: true }}
                    animateRows={true}
                />
            </div>
        </div>
    );
};
