
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/axios';
import { FileText, Import as ImportIcon, Loader2, Trash2, Eye, Calendar, PlusCircle, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import WorkOrderUploadModal from './WorkOrderUploadModal';
import WorkOrderDetailModal from './WorkOrderDetailModal';
import WorkOrderManualEntryModal from './WorkOrderManualEntryModal';

import type { WorkOrder } from '../../types/workdoc';

const WorkOrderList: React.FC = () => {
    const { projectId } = useParams();
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
    const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const fetchWorkOrders = async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const response = await api.get(`/workdoc/${projectId}/work-orders`);
            setWorkOrders(response.data);
        } catch (error) {
            console.error('Failed to fetch work orders', error);
            toast.error('Failed to load work orders');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (woId: number, status: string) => {
        try {
            await api.post(`/workdoc/work-orders/${woId}/status`, { status });
            toast.success(`Work Order marked as ${status}`);
            fetchWorkOrders();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const handleDelete = async (woId: number) => {
        if (!window.confirm('Are you sure you want to delete this Work Order? All mapped items will also be removed.')) return;

        try {
            await api.post(`/workdoc/work-orders/${woId}/delete`);
            toast.success('Work Order deleted');
            fetchWorkOrders();
        } catch (error) {
            toast.error('Failed to delete work order');
        }
    };

    const handleViewDetails = async (woId: number) => {
        try {
            const response = await api.get(`/workdoc/work-orders/${woId}`);
            setSelectedWO(response.data);
            setIsDetailModalOpen(true);
        } catch (error) {
            toast.error('Failed to load details');
        }
    };

    useEffect(() => {
        fetchWorkOrders();
    }, [projectId]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Loader2 className="animate-spin text-blue-600 h-8 w-8" />
                <p className="text-slate-500 font-bold">Scanning work orders...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Work Orders</h2>
                    <p className="text-slate-500 text-sm font-medium">Manage and review SAP imported orders</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsManualEntryOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition-all shadow-xl shadow-green-100 active:scale-95"
                    >
                        <PlusCircle size={20} />
                        Manual Entry
                    </button>
                    <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 active:scale-95"
                    >
                        <ImportIcon size={20} />
                        Import SAP Work Order
                    </button>
                </div>
            </div>

            {workOrders.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center space-y-4">
                    <div className="bg-white p-4 rounded-2xl shadow-sm w-fit mx-auto">
                        <FileText className="text-slate-300 h-12 w-12" />
                    </div>
                    <div>
                        <p className="text-slate-800 font-black text-xl">No work orders yet</p>
                        <p className="text-slate-500 max-w-xs mx-auto text-sm">Upload your SAP PDF work orders to start tracking execution against BOQ.</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {workOrders.map((wo) => (
                        <div key={wo.id} className="group bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-2xl hover:border-blue-100 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <FileText size={24} />
                                </div>
                                <div className="flex gap-2">
                                    {wo.status === 'DRAFT' && (
                                        <button
                                            onClick={() => handleUpdateStatus(wo.id, 'ACTIVE')}
                                            className="p-2 text-orange-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"
                                            title="Activate Work Order"
                                        >
                                            <CheckCircle size={20} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleViewDetails(wo.id)}
                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                        title="View Details"
                                    >
                                        <Eye size={20} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(wo.id)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                        title="Delete"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>

                            </div>

                            <div className="space-y-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Order Number</p>
                                    <h3 className="text-lg font-black text-slate-900 truncate">{wo.woNumber}</h3>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-slate-400" />
                                        <span className="text-xs font-bold text-slate-600 text-nowrap">
                                            {new Date(wo.woDate).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 justify-end">
                                        <div className={`px-2 py-1 rounded-lg text-[10px] font-black tracking-widest ${wo.status === 'DRAFT' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'
                                            }`}>
                                            {wo.status}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-50 flex justify-between items-end">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-200 uppercase">
                                            {wo.vendor?.name?.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase leading-none">Vendor</p>
                                            <p className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{wo.vendor?.name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase leading-none">Total Amount</p>
                                        <p className="text-lg font-black text-slate-900">₹{Number(wo.totalAmount).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <WorkOrderUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onSuccess={fetchWorkOrders}
            />

            <WorkOrderDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                workOrder={selectedWO}
                onRefresh={fetchWorkOrders}
            />

            <WorkOrderManualEntryModal
                isOpen={isManualEntryOpen}
                onClose={() => setIsManualEntryOpen(false)}
                onSuccess={fetchWorkOrders}
            />
        </div>
    );
};

export default WorkOrderList;
