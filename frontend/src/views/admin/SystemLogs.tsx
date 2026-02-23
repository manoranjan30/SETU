import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import {
    History,
    Search,
    Filter,
    Calendar,
    Info,
    Database
} from 'lucide-react';

// Removed date-fns import to avoid dependency error

interface AuditLog {
    id: number;
    timestamp: string;
    module: string;
    action: string;
    recordId: number;
    projectId?: number;
    ipAddress?: string;
    details: any;
    user: {
        id: number;
        username: string;
    };
}

const SystemLogs: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterModule, setFilterModule] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [limit, setLimit] = useState(100);

    useEffect(() => {
        fetchLogs();
    }, [filterModule, limit]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params: any = { limit };
            if (filterModule) params.module = filterModule;

            const res = await api.get('/audit', { params });
            setLogs(res.data);
        } catch (error) {
            console.error('Failed to fetch audit logs', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log =>
        log.user?.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.details && JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getModuleColor = (module: string) => {
        switch (module.toUpperCase()) {
            case 'WBS': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'SCHEDULE': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'TEAM': return 'bg-green-100 text-green-700 border-green-200';
            case 'QUALITY': return 'bg-orange-100 text-orange-700 border-orange-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
                        <History className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
                        <p className="text-gray-500 text-sm">Monitor system activities and user actions</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border shadow-sm">
                    <button
                        onClick={() => setLimit(100)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${limit === 100 ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        Last 100
                    </button>
                    <button
                        onClick={() => setLimit(500)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${limit === 500 ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        Last 500
                    </button>
                    <div className="h-6 w-px bg-gray-200 mx-1" />
                    <button
                        onClick={fetchLogs}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Refresh Logs"
                    >
                        <Database className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by user, action or details..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                    />
                </div>

                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                        value={filterModule}
                        onChange={(e) => setFilterModule(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm appearance-none cursor-pointer"
                    >
                        <option value="">All Modules</option>
                        <option value="WBS">WBS Structure</option>
                        <option value="SCHEDULE">Planning & Schedule</option>
                        <option value="TEAM">Project Team</option>
                        <option value="QUALITY">Quality Control</option>
                        <option value="AUTH">Authentication</option>
                    </select>
                </div>

                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 p-3 rounded-xl">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <p className="text-xs text-blue-700 leading-tight">
                        Showing <span className="font-bold">{filteredLogs.length}</span> entries. Audit logs are immutable and stored for compliance.
                    </p>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-200">
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Timestamp</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Module</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-6 py-8">
                                            <div className="h-4 bg-gray-100 rounded w-full"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-12 py-16 text-center text-gray-400">
                                        <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>No audit logs found matching your criteria</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-gray-50/80 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                {new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(log.timestamp))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px] border border-blue-100">
                                                    {log.user?.username?.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="text-sm font-medium text-gray-800">{log.user?.username}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${getModuleColor(log.module)}`}>
                                                {log.module}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-bold text-gray-700 font-mono tracking-tight uppercase">
                                                {log.action.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="max-w-md">
                                                <DetailsRenderer details={log.details} />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const DetailsRenderer = ({ details }: { details: any }) => {
    if (!details) return <span className="text-gray-300 text-xs italic">No details</span>;

    // Custom renderers for specific actions
    const renderValue = (val: any) => {
        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
        return String(val);
    };

    return (
        <div className="text-xs text-gray-600 bg-gray-50/50 p-2 rounded-lg border border-gray-100 group-hover:bg-white group-hover:border-blue-100 transition-all">
            <div className="line-clamp-2">
                {Object.entries(details).map(([key, val], idx) => (
                    <span key={key} className="inline-block mr-3">
                        <span className="text-gray-400 font-medium uppercase text-[9px] mr-1">{key}:</span>
                        <span className="font-medium text-gray-800">{renderValue(val)}</span>
                        {idx < Object.entries(details).length - 1 && <span className="text-gray-300 mx-1">|</span>}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default SystemLogs;
