
import React, { useState } from 'react';
import Modal from '../common/Modal';
import api from '../../api/axios';
import { toast } from 'react-hot-toast';
import { FileUp, Loader2, CheckCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface ParsedItem {
    code: string;
    description: string;
    qty: number;
    uom: string;
    rate: number;
    amount: number;
    longText: string;
}

interface ParsedData {
    projectId: number;
    vendor: { code: string; name: string; address: string };
    header: { woNumber: string; date: string };
    items: ParsedItem[];
    pdfPath: string;
    originalFileName: string;
}

const WorkOrderUploadModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
    const { projectId } = useParams();
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'upload' | 'review'>('upload');
    const [parsedData, setParsedData] = useState<ParsedData | null>(null);
    const [templates, setTemplates] = useState<{ id: number; name: string }[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>();

    React.useEffect(() => {
        if (isOpen) {
            api.get('/workdoc/templates').then(res => {
                setTemplates(res.data);
                if (res.data.length > 0) setSelectedTemplateId(res.data[0].id);
            });
        }
    }, [isOpen]);

    const handleAnalyze = async () => {
        if (!file || !projectId) return;

        const formData = new FormData();
        formData.append('file', file);

        setLoading(true);
        try {
            const url = `/workdoc/${projectId}/analyze${selectedTemplateId ? `?templateId=${selectedTemplateId}` : ''}`;
            const response = await api.post(url, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setParsedData(response.data);
            setStep('review');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to analyze PDF');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmSave = async () => {
        if (!parsedData || !projectId) return;

        setLoading(true);
        try {
            await api.post(`/workdoc/${projectId}/confirm`, parsedData);
            toast.success('Work Order imported successfully');
            reset();
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to save Work Order');
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setFile(null);
        setStep('upload');
        setParsedData(null);
    };

    const updateItem = (index: number, field: keyof ParsedItem, value: any) => {
        if (!parsedData) return;
        const newItems = [...parsedData.items];
        newItems[index] = { ...newItems[index], [field]: value };

        // Auto-calculate amount if qty or rate changes
        if (field === 'qty' || field === 'rate') {
            newItems[index].amount = Number(newItems[index].qty) * Number(newItems[index].rate);
        }

        setParsedData({ ...parsedData, items: newItems });
    };

    if (step === 'review' && parsedData) {
        return (
            <Modal isOpen={isOpen} onClose={reset} title="Review Extraction Results">
                <div className="space-y-6 max-h-[80vh] flex flex-col">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-4 items-start">
                        <CheckCircle className="text-blue-600 shrink-0 mt-1" />
                        <div>
                            <h4 className="font-bold text-blue-900">PDF successfully analyzed</h4>
                            <p className="text-blue-700 text-sm">Please verify the extracted information below before final import.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div>
                            <p className="text-[10px] uppercase font-black text-slate-400">Vendor Info</p>
                            <p className="font-bold text-slate-800">{parsedData.vendor.name || 'Not Detected'}</p>
                            <p className="text-xs text-slate-500">Code: {parsedData.vendor.code}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-black text-slate-400">Order Header</p>
                            <p className="font-bold text-slate-800">WO: {parsedData.header.woNumber || 'Not Detected'}</p>
                            <p className="text-xs text-slate-500">Date: {parsedData.header.date || 'Not Detected'}</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-100 sticky top-0 font-black text-slate-600 uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="px-4 py-3">Code/Item</th>
                                    <th className="px-4 py-3">Description</th>
                                    <th className="px-4 py-3 text-right">Qty</th>
                                    <th className="px-4 py-3">UOM</th>
                                    <th className="px-4 py-3 text-right">Rate</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {parsedData.items.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <input
                                                className="bg-transparent font-mono font-bold text-blue-600 w-full focus:outline-blue-400"
                                                value={item.code}
                                                onChange={e => updateItem(idx, 'code', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <textarea
                                                rows={1}
                                                className="bg-transparent w-full focus:outline-blue-400 resize-none overflow-hidden"
                                                value={item.description}
                                                onChange={e => updateItem(idx, 'description', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <input
                                                type="number"
                                                className="bg-transparent text-right font-bold w-16 focus:outline-blue-400"
                                                value={item.qty}
                                                onChange={e => updateItem(idx, 'qty', Number(e.target.value))}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                className="bg-transparent w-12 focus:outline-blue-400"
                                                value={item.uom}
                                                onChange={e => updateItem(idx, 'uom', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <input
                                                type="number"
                                                className="bg-transparent text-right font-bold w-20 focus:outline-blue-400"
                                                value={item.rate}
                                                onChange={e => updateItem(idx, 'rate', Number(e.target.value))}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right font-black text-slate-800">
                                            ₹{item.amount.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                        <button onClick={reset} className="text-slate-500 font-bold hover:text-slate-800 px-4 py-2">
                            Reset & Back
                        </button>
                        <div className="flex gap-4 items-center">
                            <p className="text-sm text-slate-500">
                                Total Items: <span className="font-bold text-slate-800">{parsedData.items.length}</span>
                            </p>
                            <button
                                onClick={handleConfirmSave}
                                disabled={loading}
                                className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 shadow-xl shadow-green-100 transition-all active:scale-95 disabled:bg-slate-300"
                            >
                                {loading && <Loader2 className="animate-spin w-5 h-5" />}
                                Confirm & Import to Database
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import SAP Work Order">
            <div className="space-y-6 py-4">
                <div
                    className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${file ? 'border-blue-500 bg-blue-50 shadow-inner' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                        }`}
                    onClick={() => document.getElementById('wo-file')?.click()}
                >
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${file ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                        <FileUp className="w-8 h-8" />
                    </div>

                    <input
                        id="wo-file"
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={e => setFile(e.target.files?.[0] || null)}
                    />
                    <div className="text-center">
                        {file ? (
                            <div className="space-y-1">
                                <p className="font-black text-blue-700 text-lg">{file.name}</p>
                                <p className="text-xs text-blue-400">PDF Document ready for AI analysis</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <p className="text-gray-900 font-bold">Select SAP Work Order PDF</p>
                                <p className="text-xs text-gray-500">The system will analyze and let you review before saving</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Parsing Template</label>
                    <select
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-blue-500 focus:ring-0"
                        value={selectedTemplateId}
                        onChange={e => setSelectedTemplateId(Number(e.target.value))}
                    >
                        <option value="">Default AI (Standard SAP)</option>
                        {templates.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                    <p className="text-[10px] text-slate-400">Select the template matching your PDF layout for better accuracy.</p>
                </div>

                <div className="flex justify-end gap-3 items-center pt-6 border-t border-gray-100">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleAnalyze}
                        disabled={!file || loading}
                        className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all shadow-xl shadow-blue-100 active:scale-95"
                    >
                        {loading ? <Loader2 className="animate-spin w-5 h-5" /> : null}
                        {loading ? 'AI Engine Processing...' : 'Start Extraction'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default WorkOrderUploadModal;
