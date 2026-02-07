
import React, { useEffect, useState } from 'react';
import { Upload, FileText, Search } from 'lucide-react';
import api from '../../api/axios';
import { useParams } from 'react-router-dom';
import WorkOrderUploadModal from './WorkOrderUploadModal';

interface WorkOrder {
    id: number;
    workOrderNumber: string;
    vendorName: string;
    date: string;
    status: string;
    grandTotal: number;
}

const WorkOrderList: React.FC = () => {
    const { projectId } = useParams();
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    useEffect(() => {
        if (projectId) fetchWorkOrders();
    }, [projectId]);

    const fetchWorkOrders = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/workdoc/${projectId}/work-orders`);
            setWorkOrders(response.data);
        } catch (error) {
            console.error("Failed to fetch work orders", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h3 className="text-2xl font-black text-slate-800">Project Work Orders</h3>
                    <p className="text-slate-500 text-sm mt-1">Imported from SAP PDF documents</p>
                </div>

                <div className="flex gap-3">
                    <button
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100"
                        onClick={() => setIsUploadModalOpen(true)}
                    >
                        <Upload size={18} /> Import Work Order (PDF)
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Total Orders</p>
                    <p className="text-2xl font-black text-slate-800">{workOrders.length}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Draft Status</p>
                    <p className="text-2xl font-black text-amber-600">{workOrders.filter(w => w.status === 'DRAFT').length}</p>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            placeholder="Search by WO# or Vendor..."
                            className="pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg w-64 focus:ring-2 focus:ring-indigo-100 outline-none"
                        />
                    </div>
                </div>

                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">WO Number</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Vendor</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Amount</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Loading Work Orders...</td></tr>
                        )}
                        {!loading && workOrders.length === 0 && (
                            <tr><td colSpan={6} className="px-6 py-12 text-center">
                                <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                <p className="text-slate-400 font-medium">No Work Orders found. Start by importing a PDF.</p>
                            </td></tr>
                        )}
                        {workOrders.map((wo) => (
                            <tr key={wo.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-white transition-colors">
                                            <FileText size={14} className="text-slate-500" />
                                        </div>
                                        <span className="font-bold text-slate-700">{wo.workOrderNumber}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-800">{wo.vendorName}</span>
                                        <span className="text-[10px] text-slate-400">CONTRACTOR</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-medium text-slate-500 text-sm">
                                    {new Date(wo.date).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right font-black text-slate-800">
                                    ₹{wo.grandTotal?.toLocaleString()}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${wo.status === 'DRAFT' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-green-50 text-green-600 border border-green-100'
                                        }`}>
                                        {wo.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-xs font-bold text-indigo-600 hover:underline">View Items</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <WorkOrderUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onSuccess={fetchWorkOrders}
            />
        </div>
    );
};

export default WorkOrderList;
