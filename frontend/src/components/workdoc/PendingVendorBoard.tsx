import React, { useState, useEffect, useCallback } from 'react';
import { WorkDocService, type PendingBoardItem } from '../../services/work-doc.service';
import { Loader2, Link as LinkIcon, Search, Wand2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Props {
    projectId: number;
}

const PendingVendorBoard: React.FC<Props> = ({ projectId }) => {
    const [items, setItems] = useState<PendingBoardItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');

    const loadItems = useCallback(async () => {
        setLoading(true);
        try {
            const data = await WorkDocService.getPendingVendorBoard(projectId);
            setItems(data);
        } catch {
            toast.error('Failed to load pending items');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    const handleSelect = (id: number) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAll = () => {
        if (selectedItems.size === items.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(items.map(i => i.id)));
        }
    };

    const handleAutoMap = async () => {
        if (selectedItems.size === 0) return;

        const workOrderIds = Array.from(new Set(items.filter(i => selectedItems.has(i.id)).map(i => i.workOrderId)));

        setLoading(true);
        try {
            await Promise.all(workOrderIds.map(id => WorkDocService.autoMapWorkOrder(id)));
            toast.success('Auto-mapping completed');
            loadItems();
            setSelectedItems(new Set());
        } catch {
            toast.error('Some items failed to map');
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = items.filter(item =>
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.workOrderRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Pending Vendor Items</h2>
                    <p className="text-sm text-slate-500">Map vendor work items to BOQ items</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search description, vendor..."
                            className="pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-blue-500"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handleAutoMap}
                        disabled={selectedItems.size === 0 || loading}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                        Auto-Map Selected ({selectedItems.size})
                    </button>
                </div>
            </div>

            <div className="overflow-auto flex-1 border rounded-lg">
                <table className="w-full text-sm text-left relative">
                    <thead className="bg-slate-50 text-slate-600 font-medium border-b sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 w-8">
                                <input
                                    type="checkbox"
                                    checked={items.length > 0 && selectedItems.size === items.length}
                                    onChange={handleSelectAll}
                                    className="rounded border-slate-300"
                                />
                            </th>
                            <th className="px-4 py-3">Vendor / WO</th>
                            <th className="px-4 py-3">Item Description</th>
                            <th className="px-4 py-3 text-right">Qty</th>
                            <th className="px-4 py-3 text-right">Amount</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && items.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                    Loading items...
                                </td>
                            </tr>
                        ) : filteredItems.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                                    No pending items found.
                                </td>
                            </tr>
                        ) : (
                            filteredItems.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedItems.has(item.id)}
                                            onChange={() => handleSelect(item.id)}
                                            className="rounded border-slate-300"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-slate-800">{item.vendorName}</div>
                                        <div className="text-xs text-slate-500">{item.workOrderRef}</div>
                                    </td>
                                    <td className="px-4 py-3 max-w-xs">
                                        <div className="truncate font-medium text-slate-700" title={item.description}>{item.description}</div>
                                        <div className="text-xs text-slate-400 font-mono mt-0.5">{item.materialCode}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                                        {item.quantity}
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                                        ₹{item.amount.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.mappingStatus === 'PENDING' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {item.mappingStatus}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button className="text-blue-600 hover:text-blue-800 text-xs font-bold inline-flex items-center gap-1 px-2 py-1 hover:bg-blue-50 rounded transition-colors">
                                            <LinkIcon className="w-3 h-3" /> Map
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

export default PendingVendorBoard;
