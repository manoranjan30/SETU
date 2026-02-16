
import React from 'react';
import Modal from '../common/Modal';

import type { WorkOrder } from '../../types/workdoc';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    workOrder: WorkOrder | null;
}

const WorkOrderDetailModal: React.FC<Props> = ({ isOpen, onClose, workOrder }) => {
    if (!workOrder) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Work Order: ${workOrder.woNumber}`}>
            <div className="space-y-6 max-h-[80vh] flex flex-col">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                        <p className="text-[10px] uppercase font-black text-slate-400">Vendor</p>
                        <p className="font-bold text-slate-800">{workOrder.vendor?.name}</p>
                        <p className="text-xs text-slate-500">Code: {workOrder.vendor?.vendorCode}</p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-black text-slate-400">Order Header</p>
                        <p className="font-bold text-slate-800">Date: {new Date(workOrder.woDate).toLocaleDateString()}</p>
                        <p className="text-xs text-slate-500 font-bold text-green-600">Total: ₹{Number(workOrder.totalAmount).toLocaleString()}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 sticky top-0 font-black text-slate-600 uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="px-4 py-3">Code</th>
                                <th className="px-4 py-3">Description</th>
                                <th className="px-4 py-3 text-right">Qty</th>
                                <th className="px-4 py-3">UOM</th>
                                <th className="px-4 py-3 text-right">Rate</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {workOrder.items?.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-3 font-mono font-bold text-slate-600">{item.materialCode}</td>
                                    <td className="px-4 py-3 text-slate-800">{item.shortText}</td>
                                    <td className="px-4 py-3 text-right font-bold">{Number(item.quantity).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-slate-500">{item.uom}</td>
                                    <td className="px-4 py-3 text-right">₹{Number(item.rate).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right font-black text-slate-800">₹{Number(item.amount).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default WorkOrderDetailModal;
