import { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { executionService, type ExecutionBreakdown } from '../../services/execution.service';
import api from '../../api/axios';

interface ExecutionBreakdownModalProps {
    activityId: number;
    activityName: string;
    epsNodeId: number;
    onClose: () => void;
    onProgressLogged?: () => void;
}

export const ExecutionBreakdownModal: React.FC<ExecutionBreakdownModalProps> = ({
    activityId,
    activityName,
    epsNodeId,
    onClose,
    onProgressLogged
}) => {
    const [breakdown, setBreakdown] = useState<ExecutionBreakdown | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [progressInputs, setProgressInputs] = useState<Record<string, number>>({});
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [remarks, setRemarks] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchBreakdown();
    }, [activityId, epsNodeId]);

    const fetchBreakdown = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await executionService.getBreakdown(activityId, epsNodeId);
            setBreakdown(data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load breakdown');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (itemKey: string, value: string) => {
        const numVal = parseFloat(value) || 0;
        setProgressInputs(prev => ({
            ...prev,
            [itemKey]: numVal
        }));
    };

    const handleSave = async () => {
        if (Object.keys(progressInputs).length === 0) {
            alert('Please enter progress quantity for at least one item');
            return;
        }

        if (!confirm(`Save progress for ${Object.keys(progressInputs).length} item(s)?`)) {
            return;
        }

        try {
            setSaving(true);

            // Transform progressInputs to API format
            const entries = Object.entries(progressInputs)
                .filter(([_, qty]) => qty > 0) // Only send non-zero quantities
                .map(([key, qty]) => {
                    const [boqIdx, type, id] = key.split('-');
                    const boqItem = breakdown!.boqBreakdown[parseInt(boqIdx)].boqItem;

                    return {
                        boqItemId: boqItem.id,
                        microActivityId: type === 'MICRO' ? parseInt(id) : null,
                        quantity: qty
                    };
                });

            // Call API
            const projectId = breakdown!.activity?.projectId || epsNodeId; // Fallback to epsNodeId

            await api.post('/execution/progress/micro', {
                projectId,
                activityId,
                epsNodeId,
                entries,
                date,
                remarks
            });

            alert('Progress saved successfully!');
            onProgressLogged?.();
            onClose();
        } catch (err: any) {
            console.error('Save error:', err);
            alert(err.response?.data?.message || 'Failed to save progress');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <p className="text-gray-600">Loading breakdown...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-8 max-w-md">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertCircle className="w-6 h-6 text-red-600" />
                        <h3 className="text-lg font-bold text-gray-800">Error</h3>
                    </div>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button
                        onClick={onClose}
                        className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    if (!breakdown || breakdown.boqBreakdown.length === 0) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-8 max-w-md">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertCircle className="w-6 h-6 text-yellow-600" />
                        <h3 className="text-lg font-bold text-gray-800">No Data</h3>
                    </div>
                    <p className="text-gray-600 mb-6">
                        No micro schedule found for this activity. Use the regular progress entry.
                    </p>
                    <button
                        onClick={onClose}
                        className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">{activityName}</h2>
                        <p className="text-sm text-gray-600 mt-1">Progress Entry - Micro Schedule Breakdown</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/80 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {breakdown.boqBreakdown.map((boqBreakdown, idx) => (
                        <div key={idx} className="mb-8 last:mb-0">
                            {/* BOQ Item Header */}
                            <div className="bg-gray-50 p-4 rounded-lg mb-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-gray-800 text-lg">
                                            {boqBreakdown.boqItem.description}
                                        </h3>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Code: {boqBreakdown.boqItem.itemCode} | Unit: {boqBreakdown.boqItem.uom}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-blue-600">
                                            {boqBreakdown.scope.total.toFixed(2)}
                                        </div>
                                        <div className="text-xs text-gray-500">Total Scope</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3 mt-4">
                                    <div className="bg-white p-3 rounded border border-gray-200">
                                        <div className="text-xs text-gray-500 mb-1">Allocated (Micro)</div>
                                        <div className="text-lg font-bold text-gray-800">
                                            {boqBreakdown.scope.allocated.toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 rounded border border-gray-200">
                                        <div className="text-xs text-gray-500 mb-1">Balance (Direct)</div>
                                        <div className="text-lg font-bold text-gray-800">
                                            {boqBreakdown.scope.balance.toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 rounded border border-gray-200">
                                        <div className="text-xs text-gray-500 mb-1">Progress</div>
                                        <div className="text-lg font-bold text-green-600">
                                            {((boqBreakdown.items.reduce((sum, item) => sum + item.executedQty, 0) / boqBreakdown.scope.total) * 100).toFixed(1)}%
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gray-100 border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Task Name</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Scope</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Done</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Balance</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Today</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {boqBreakdown.items.map((item, itemIdx) => {
                                            const itemKey = `${idx}-${item.type}-${item.id || 'balance'}`;
                                            const currentInput = progressInputs[itemKey] || 0;
                                            const remainingBalance = item.balanceQty - currentInput;
                                            const isOverLimit = currentInput > item.balanceQty;

                                            return (
                                                <tr
                                                    key={itemIdx}
                                                    className={`border-b border-gray-100 hover:bg-gray-50 ${item.type === 'BALANCE' ? 'bg-amber-50/30' : ''
                                                        }`}
                                                >
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            {item.type === 'MICRO' ? (
                                                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                                            ) : (
                                                                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                                            )}
                                                            <span className="font-medium text-gray-800">{item.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-medium text-gray-700">
                                                        {item.allocatedQty.toFixed(2)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-gray-600">
                                                        {item.executedQty.toFixed(2)}
                                                    </td>
                                                    <td className={`px-4 py-3 text-right font-bold ${remainingBalance < 0 ? 'text-red-600' : 'text-green-600'
                                                        }`}>
                                                        {remainingBalance.toFixed(2)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={item.balanceQty}
                                                            step="0.01"
                                                            value={progressInputs[itemKey] || ''}
                                                            onChange={(e) => handleInputChange(itemKey, e.target.value)}
                                                            placeholder="0.00"
                                                            className={`w-full px-3 py-2 border rounded text-right transition-colors ${isOverLimit
                                                                ? 'border-red-500 bg-red-50 text-red-700'
                                                                : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                                                }`}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <div className="flex gap-4 mb-4">
                        <div className="flex items-center gap-2 flex-1">
                            <label className="text-sm font-medium text-gray-700">Date:</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="flex-1">
                            <input
                                type="text"
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Remarks (optional)"
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || Object.keys(progressInputs).length === 0}
                            className={`px-6 py-2 rounded-md font-medium text-white transition-all flex items-center gap-2 ${saving || Object.keys(progressInputs).length === 0
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700 shadow-sm hover:shadow-md'
                                }`}
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Save Progress
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
