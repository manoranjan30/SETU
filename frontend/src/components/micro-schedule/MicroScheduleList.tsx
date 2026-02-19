import React, { useEffect, useState } from 'react';
import {
    MoreVertical,
    AlertTriangle,
    Search,
    Filter,
    Plus,
    Edit2,
    Trash2
} from 'lucide-react';
import microScheduleService, { type MicroSchedule, MicroScheduleStatus } from '../../services/micro-schedule.service';
import DeleteConfirmationDialog from './DeleteConfirmationDialog';

interface MicroScheduleListProps {
    projectId: number;
    onCreate: () => void;
    onEdit: (schedule: MicroSchedule) => void;
    onView: (schedule: MicroSchedule) => void;
}

const formatDate = (dateString: string): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const formatFullDate = (dateString: string): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const MicroScheduleList: React.FC<MicroScheduleListProps> = ({
    projectId,
    onCreate,
    onEdit,
    onView
}) => {
    const [schedules, setSchedules] = useState<MicroSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [scheduleToDelete, setScheduleToDelete] = useState<MicroSchedule | null>(null);

    useEffect(() => {
        loadSchedules();
    }, [projectId]);

    useEffect(() => {
        const handleClickOutside = () => {
            if (openMenuId !== null) {
                setOpenMenuId(null);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [openMenuId]);

    const loadSchedules = async () => {
        try {
            setLoading(true);
            const data = await microScheduleService.getMicroSchedulesByProject(projectId);
            setSchedules(data);
        } catch (error) {
            console.error('Error loading micro schedules:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (schedule: MicroSchedule, e: React.MouseEvent) => {
        e.stopPropagation();
        setScheduleToDelete(schedule);
        setDeleteDialogOpen(true);
        setOpenMenuId(null);
    };

    const handleDeleteConfirm = async () => {
        if (!scheduleToDelete) return;

        try {
            await microScheduleService.deleteMicroSchedule(scheduleToDelete.id);
            setDeleteDialogOpen(false);
            setScheduleToDelete(null);
            loadSchedules(); // Reload the list
        } catch (error) {
            console.error('Error deleting micro schedule:', error);
            alert('Failed to delete micro schedule. Check console for details.');
        }
    };

    const handleDeleteCancel = () => {
        setDeleteDialogOpen(false);
        setScheduleToDelete(null);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case MicroScheduleStatus.DRAFT: return 'bg-gray-100 text-gray-800';
            case MicroScheduleStatus.SUBMITTED: return 'bg-blue-100 text-blue-800';
            case MicroScheduleStatus.APPROVED: return 'bg-green-100 text-green-800';
            case MicroScheduleStatus.ACTIVE: return 'bg-purple-100 text-purple-800';
            case MicroScheduleStatus.COMPLETED: return 'bg-teal-100 text-teal-800';
            case MicroScheduleStatus.SUSPENDED: return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const filteredSchedules = schedules.filter(schedule => {
        const matchesSearch = schedule.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || schedule.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search schedules..."
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        <select
                            className="pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="ALL">All Status</option>
                            {Object.values(MicroScheduleStatus).map(status => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <button
                    onClick={onCreate}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    Create Schedule
                </button>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">Schedule Name</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">Status</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">Dates</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b text-center">Progress</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b text-right">Totals</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b text-center">Alerts</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                                    <div className="flex justify-center items-center gap-2">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                        Loading schedules...
                                    </div>
                                </td>
                            </tr>
                        ) : filteredSchedules.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                                    No schedules found
                                </td>
                            </tr>
                        ) : (
                            filteredSchedules.map((schedule) => (
                                <tr
                                    key={schedule.id}
                                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                                    onClick={() => onView(schedule)}
                                >
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{schedule.name}</div>
                                        <div className="text-xs text-gray-500 mt-1 truncate max-w-xs">{schedule.description}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(schedule.status)}`}>
                                            {schedule.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col text-sm text-gray-600">
                                            <div className="flex items-center gap-1">
                                                <span className="w-12 text-xs text-gray-400">Planned:</span>
                                                <span>{formatDate(schedule.plannedStart)} - {formatDate(schedule.plannedFinish)}</span>
                                            </div>
                                            {schedule.forecastFinish && (
                                                <div className={`flex items-center gap-1 mt-1 ${schedule.overshootFlag ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                                    <span className="w-12 text-xs text-gray-400">Forecast:</span>
                                                    <span>{formatFullDate(schedule.forecastFinish)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="relative w-12 h-12">
                                                <svg className="w-full h-full transform -rotate-90">
                                                    <circle
                                                        cx="24"
                                                        cy="24"
                                                        r="18"
                                                        stroke="currentColor"
                                                        strokeWidth="4"
                                                        fill="transparent"
                                                        className="text-gray-200"
                                                    />
                                                    <circle
                                                        cx="24"
                                                        cy="24"
                                                        r="18"
                                                        stroke="currentColor"
                                                        strokeWidth="4"
                                                        fill="transparent"
                                                        strokeDasharray={113}
                                                        strokeDashoffset={113 - (113 * ((schedule.totalActualQty / (schedule.totalAllocatedQty || 1)) || 0))}
                                                        className="text-blue-600"
                                                    />
                                                </svg>
                                                <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-700">
                                                    {schedule.totalAllocatedQty > 0
                                                        ? Math.round((schedule.totalActualQty / schedule.totalAllocatedQty) * 100)
                                                        : 0}%
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="text-sm font-medium text-gray-900">{schedule.totalActualQty.toLocaleString()} / {schedule.totalAllocatedQty.toLocaleString()}</div>
                                        <div className="text-xs text-gray-500">Total Quantity</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {schedule.overshootFlag && (
                                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded-md text-xs font-medium border border-red-100" title={`Forecast exceeds planned finish by ${schedule.overshootDays} days`}>
                                                <AlertTriangle size={14} />
                                                {schedule.overshootDays}d Delay
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="relative">
                                            <button
                                                className="text-gray-400 hover:text-gray-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuId(openMenuId === schedule.id ? null : schedule.id);
                                                }}
                                            >
                                                <MoreVertical size={18} />
                                            </button>

                                            {/* Dropdown Menu */}
                                            {openMenuId === schedule.id && (
                                                <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                                                    <button
                                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuId(null);
                                                            onEdit(schedule);
                                                        }}
                                                    >
                                                        <Edit2 size={14} />
                                                        Edit Schedule
                                                    </button>
                                                    <button
                                                        className="w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50 flex items-center gap-2 border-t"
                                                        onClick={(e) => handleDeleteClick(schedule, e)}
                                                    >
                                                        <Trash2 size={14} />
                                                        Delete Schedule
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmationDialog
                isOpen={deleteDialogOpen}
                scheduleName={scheduleToDelete?.name || ''}
                activityCount={scheduleToDelete?.activities?.length || 0}
                hasProgress={(scheduleToDelete?.totalActualQty || 0) > 0}
                onConfirm={handleDeleteConfirm}
                onCancel={handleDeleteCancel}
            />
        </div>
    );
};

export default MicroScheduleList;
