import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../common/Modal';
import api from '../../api/axios';
import { toast } from 'react-hot-toast';
import {
    Loader2, CheckCircle, UserPlus, Search, Building2,
    Plus, Trash2, ArrowLeft, ArrowRight, FileText, Calculator,
    Save, ClipboardList
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import AddVendorModal from './AddVendorModal';
import BoqSelectModal from './BoqSelectModal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface Vendor {
    id: number;
    vendorCode: string;
    name: string;
    gstin?: string;
}

interface HeaderInfo {
    woNumber: string;
    date: string;
    orderAmendNo: string;
    orderAmendDate: string;
    orderValidityStart: string;
    orderValidityEnd: string;
    orderType: string;
    projectCode: string;
    projectDescription: string;
    invoiceTo: string;
    scopeOfWork: string;
}

interface LineItem {
    id: string;
    serialNumber: string;
    code: string;
    description: string;
    longText: string;
    uom: string;
    qty: number;
    rate: number;
    amount: number;
    boqItemId?: number;
    boqSubItemId?: number;
    measurementElementId?: number;
}

const ORDER_TYPES = [
    'Project Services WO',
    'Material Supply WO',
    'Supply & Erection WO',
    'Annual Maintenance WO',
    'Hire Charges WO',
    'Other',
];

const UOM_OPTIONS = [
    'Nos', 'Sqm', 'Rmt', 'Cum', 'MT', 'KG', 'Ltr', 'Set', 'Lot',
    'LS', 'Bag', 'Trip', 'Day', 'Month', 'Hr', 'Pair', 'Each',
];

const emptyHeader: HeaderInfo = {
    woNumber: '',
    date: new Date().toISOString().split('T')[0],
    orderAmendNo: '',
    orderAmendDate: '',
    orderValidityStart: '',
    orderValidityEnd: '',
    orderType: '',
    projectCode: '',
    projectDescription: '',
    invoiceTo: '',
    scopeOfWork: '',
};

const createEmptyItem = (): LineItem => ({
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    serialNumber: '',
    code: '',
    description: '',
    longText: '',
    uom: 'Nos',
    qty: 0,
    rate: 0,
    amount: 0,
});

const WorkOrderManualEntryModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
    const { projectId } = useParams();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'vendor' | 'header' | 'items'>('vendor');

    // Vendor state
    const [vendorMode, setVendorMode] = useState<'existing' | 'new'>('existing');
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [vendorSearch, setVendorSearch] = useState('');
    const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
    const [showAddVendor, setShowAddVendor] = useState(false);

    // Header state
    const [header, setHeader] = useState<HeaderInfo>({ ...emptyHeader });

    // Items state
    const [items, setItems] = useState<LineItem[]>([createEmptyItem()]);
    
    // BOQ Import State
    const [showBoqSelect, setShowBoqSelect] = useState(false);

    useEffect(() => {
        if (isOpen) {
            api.get('/workdoc/vendors').then(res => setVendors(res.data)).catch(() => { });
        }
    }, [isOpen]);

    const filteredVendors = vendors.filter(v =>
        v.vendorCode.toLowerCase().includes(vendorSearch.toLowerCase()) ||
        v.name.toLowerCase().includes(vendorSearch.toLowerCase())
    );

    const updateHeader = (field: keyof HeaderInfo, value: string) => {
        setHeader(prev => ({ ...prev, [field]: value }));
    };

    const updateItem = useCallback((index: number, field: keyof LineItem, value: any) => {
        setItems(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            if (field === 'qty' || field === 'rate') {
                const qty = field === 'qty' ? Number(value) : next[index].qty;
                const rate = field === 'rate' ? Number(value) : next[index].rate;
                next[index].amount = Math.round(qty * rate * 100) / 100;
            }
            return next;
        });
    }, []);

    const addItem = () => setItems(prev => [...prev, createEmptyItem()]);

    const removeItem = (index: number) => {
        if (items.length <= 1) return;
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleImportFromBoq = (selectedBoqItems: any[]) => {
        if (selectedBoqItems.length === 0) return;

        const newItems: LineItem[] = selectedBoqItems.map(b => {
            let fullDescription = b.description || b.elementName || '';
            if (b.level === 2 && b.parentInfo && b.grandParentInfo) {
                fullDescription = `${b.grandParentInfo.boqCode} > ${b.parentInfo.description} > ${b.elementName}`;
            } else if (b.level === 1 && b.parentInfo) {
                fullDescription = `${b.parentInfo.boqCode} > ${b.description}`;
            }

            return {
                id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                serialNumber: '',
                code: b.boqCode || b.elementCode || '',
                description: fullDescription,
                longText: b.description || '',
                uom: b.uom || 'Nos',
                qty: b.availableQty || 0,
                rate: b.boqRate || 0,
                amount: (b.availableQty || 0) * (b.boqRate || 0),
                boqItemId: b.boqItemId,
                boqSubItemId: b.boqSubItemId,
                measurementElementId: b.measurementElementId
            };
        });

        setItems(prev => {
            // Remove the empty default item if not used
            if (prev.length === 1 && !prev[0].description && !prev[0].code) {
                return newItems;
            }
            return [...prev, ...newItems];
        });
    };

    const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);

    const handleVendorCreated = (vendor: any) => {
        setVendors(prev => [...prev, vendor]);
        setSelectedVendor(vendor);
        setShowAddVendor(false);
        toast.success('Vendor created!');
        setStep('header');
    };

    const validateHeader = (): boolean => {
        if (!header.woNumber.trim()) {
            toast.error('Work Order Number is required');
            return false;
        }
        if (!header.date) {
            toast.error('Work Order Date is required');
            return false;
        }
        return true;
    };

    const validateItems = (): boolean => {
        const validItems = items.filter(i => i.description.trim() || i.code.trim());
        if (validItems.length === 0) {
            toast.error('At least one line item with a description is required');
            return false;
        }
        for (let i = 0; i < validItems.length; i++) {
            if (!validItems[i].description.trim()) {
                toast.error(`Item ${i + 1}: Description is required`);
                return false;
            }
        }
        return true;
    };

    const handleSave = async () => {
        if (!validateItems() || !projectId || !selectedVendor) return;

        setLoading(true);
        try {
            const validItems = items.filter(i => i.description.trim() || i.code.trim());

            // Auto-generate serial numbers
            const numberedItems = validItems.map((item, idx) => ({
                ...item,
                serialNumber: String((idx + 1) * 10),
            }));

            const saveData = {
                vendor: {
                    code: selectedVendor.vendorCode,
                    name: selectedVendor.name,
                },
                header: {
                    woNumber: header.woNumber,
                    date: header.date,
                    orderAmendNo: header.orderAmendNo || undefined,
                    orderAmendDate: header.orderAmendDate || undefined,
                    orderValidityStart: header.orderValidityStart || undefined,
                    orderValidityEnd: header.orderValidityEnd || undefined,
                    orderType: header.orderType || undefined,
                    projectCode: header.projectCode || undefined,
                    projectDescription: header.projectDescription || undefined,
                    invoiceTo: header.invoiceTo || undefined,
                    scopeOfWork: header.scopeOfWork || undefined,
                },
                items: numberedItems.map(item => ({
                    serialNumber: item.serialNumber,
                    parentSerialNumber: null,
                    level: 0,
                    isParent: false,
                    code: item.code || `ITEM-${item.serialNumber}`,
                    description: item.description,
                    longText: item.longText,
                    qty: Number(item.qty),
                    uom: item.uom,
                    rate: Number(item.rate),
                    amount: Number(item.amount),
                    calculatedAmount: Number(item.amount),
                    boqItemId: item.boqItemId,
                    boqSubItemId: item.boqSubItemId,
                    measurementElementId: item.measurementElementId
                })),
                pdfPath: null,
                originalFileName: null,
            };

            await api.post(`/workdoc/${projectId}/confirm`, saveData);
            toast.success('Work Order created successfully!');
            reset();
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to create Work Order');
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setStep('vendor');
        setSelectedVendor(null);
        setVendorSearch('');
        setVendorMode('existing');
        setHeader({ ...emptyHeader });
        setItems([createEmptyItem()]);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    // =================== STEP 1: VENDOR SELECTION ===================
    if (step === 'vendor') {
        return (
            <Modal isOpen={isOpen} onClose={handleClose} title="Create Work Order — Step 1: Select Vendor">
                <div className="space-y-6 py-4">
                    <div className="flex gap-4">
                        <button
                            onClick={() => setVendorMode('existing')}
                            className={`flex-1 p-4 rounded-xl border-2 transition-all ${vendorMode === 'existing'
                                ? 'border-blue-500 bg-blue-50 shadow-lg'
                                : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <Building2 className={`w-8 h-8 mx-auto mb-2 ${vendorMode === 'existing' ? 'text-blue-600' : 'text-gray-400'}`} />
                            <p className={`font-bold ${vendorMode === 'existing' ? 'text-blue-700' : 'text-gray-600'}`}>Existing Vendor</p>
                            <p className="text-xs text-gray-500">Select from registered vendors</p>
                        </button>
                        <button
                            onClick={() => setVendorMode('new')}
                            className={`flex-1 p-4 rounded-xl border-2 transition-all ${vendorMode === 'new'
                                ? 'border-green-500 bg-green-50 shadow-lg'
                                : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <UserPlus className={`w-8 h-8 mx-auto mb-2 ${vendorMode === 'new' ? 'text-green-600' : 'text-gray-400'}`} />
                            <p className={`font-bold ${vendorMode === 'new' ? 'text-green-700' : 'text-gray-600'}`}>New Vendor</p>
                            <p className="text-xs text-gray-500">Create a new vendor first</p>
                        </button>
                    </div>

                    {vendorMode === 'existing' && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="relative mb-3">
                                <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search vendor by name or code..."
                                    className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    value={vendorSearch}
                                    onChange={e => setVendorSearch(e.target.value)}
                                />
                            </div>
                            <div className="h-48 overflow-y-auto space-y-2 pr-2">
                                {filteredVendors.length === 0 ? (
                                    <p className="text-center text-gray-400 py-8">No vendors found</p>
                                ) : (
                                    filteredVendors.map(v => (
                                        <div
                                            key={v.id}
                                            onClick={() => setSelectedVendor(v)}
                                            className={`p-3 rounded-lg cursor-pointer border transition-all ${selectedVendor?.id === v.id
                                                ? 'bg-blue-100 border-blue-500 ring-1 ring-blue-500'
                                                : 'bg-white border-gray-200 hover:border-blue-300'
                                                }`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="font-bold text-gray-800">{v.name}</p>
                                                    <p className="text-xs text-gray-500">Code: {v.vendorCode} {v.gstin && `• GSTIN: ${v.gstin}`}</p>
                                                </div>
                                                {selectedVendor?.id === v.id && (
                                                    <CheckCircle className="text-blue-600 w-5 h-5" />
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {vendorMode === 'new' && (
                        <div className="text-center p-8 bg-green-50 rounded-xl border border-green-200">
                            <UserPlus className="w-12 h-12 mx-auto text-green-600 mb-4" />
                            <p className="font-bold text-green-800 mb-2">Create New Vendor</p>
                            <p className="text-sm text-green-600 mb-4">Register the vendor before creating their Work Order.</p>
                            <button
                                onClick={() => setShowAddVendor(true)}
                                className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-lg"
                            >
                                + Create New Vendor
                            </button>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button onClick={handleClose} className="px-4 py-2 text-gray-500 hover:text-gray-800 font-medium">
                            Cancel
                        </button>
                        <button
                            onClick={() => setStep('header')}
                            disabled={vendorMode === 'existing' && !selectedVendor}
                            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-lg flex items-center gap-2"
                        >
                            Continue <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <AddVendorModal
                    isOpen={showAddVendor}
                    onClose={() => setShowAddVendor(false)}
                    initialData={{ vendorCode: '', name: '', address: '', gstin: '' }}
                    onSuccess={handleVendorCreated}
                />
            </Modal>
        );
    }

    // =================== STEP 2: HEADER INFORMATION ===================
    if (step === 'header') {
        return (
            <Modal isOpen={isOpen} onClose={handleClose} title="Create Work Order — Step 2: Order Details">
                <div className="space-y-6 py-4 max-h-[80vh] overflow-auto">
                    {/* Vendor badge */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-3 items-center">
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm">
                            {selectedVendor?.name?.charAt(0)}
                        </div>
                        <div>
                            <p className="font-bold text-blue-900 text-sm">{selectedVendor?.name}</p>
                            <p className="text-xs text-blue-600">Code: {selectedVendor?.vendorCode}</p>
                        </div>
                    </div>

                    {/* Required Fields */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <FileText className="w-4 h-4" /> Order Information
                        </h4>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">
                                    Work Order Number <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g., WO-2026-001"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={header.woNumber}
                                    onChange={e => updateHeader('woNumber', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">
                                    Work Order Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={header.date}
                                    onChange={e => updateHeader('date', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Order Type</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                                    value={header.orderType}
                                    onChange={e => updateHeader('orderType', e.target.value)}
                                >
                                    <option value="">-- Select Type --</option>
                                    {ORDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Amendment No.</label>
                                <input
                                    type="text"
                                    placeholder="Optional"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    value={header.orderAmendNo}
                                    onChange={e => updateHeader('orderAmendNo', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Validity Period */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <Calculator className="w-4 h-4" /> Validity Period
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Amendment Date</label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    value={header.orderAmendDate}
                                    onChange={e => updateHeader('orderAmendDate', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Validity Start</label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    value={header.orderValidityStart}
                                    onChange={e => updateHeader('orderValidityStart', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Validity End</label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    value={header.orderValidityEnd}
                                    onChange={e => updateHeader('orderValidityEnd', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Project Info */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <ClipboardList className="w-4 h-4" /> Project & Scope
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Project Code</label>
                                <input
                                    type="text"
                                    placeholder="e.g., 2C39"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    value={header.projectCode}
                                    onChange={e => updateHeader('projectCode', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Project Description</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Construction of Tower A"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    value={header.projectDescription}
                                    onChange={e => updateHeader('projectDescription', e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Invoice To</label>
                            <input
                                type="text"
                                placeholder="Invoice recipient address"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                value={header.invoiceTo}
                                onChange={e => updateHeader('invoiceTo', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Scope of Work</label>
                            <textarea
                                rows={3}
                                placeholder="Describe the scope of work covered under this order..."
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                                value={header.scopeOfWork}
                                onChange={e => updateHeader('scopeOfWork', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-between gap-3 pt-4 border-t border-gray-200">
                        <button
                            onClick={() => setStep('vendor')}
                            className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-gray-800 font-medium"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back
                        </button>
                        <button
                            onClick={() => { if (validateHeader()) setStep('items'); }}
                            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg flex items-center gap-2"
                        >
                            Continue to Items <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </Modal>
        );
    }

    // =================== STEP 3: LINE ITEMS + REVIEW ===================
    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Create Work Order — Step 3: Line Items">
            <div className="space-y-5 max-h-[85vh] flex flex-col">
                {/* Summary bar */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center shrink-0">
                    <div className="flex gap-6">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase">Order</span>
                            <p className="font-bold text-slate-800 text-sm">{header.woNumber}</p>
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase">Vendor</span>
                            <p className="font-bold text-slate-800 text-sm">{selectedVendor?.name}</p>
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase">Date</span>
                            <p className="font-bold text-slate-800 text-sm">{header.date}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] font-black text-slate-400 uppercase">Total Amount</span>
                        <p className="font-black text-green-600 text-lg">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>

                {/* Items Table */}
                <div className="flex-1 overflow-auto border rounded-xl">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100 sticky top-0 z-10">
                            <tr className="text-xs font-bold text-slate-600 uppercase">
                                <th className="px-2 py-3 text-center w-10">#</th>
                                <th className="px-2 py-3 text-left w-28">Material Code</th>
                                <th className="px-2 py-3 text-left">Description <span className="text-red-400">*</span></th>
                                <th className="px-2 py-3 text-left w-20">UoM</th>
                                <th className="px-2 py-3 text-right w-20">Qty</th>
                                <th className="px-2 py-3 text-right w-24">Rate (₹)</th>
                                <th className="px-2 py-3 text-right w-28">Amount (₹)</th>
                                <th className="px-2 py-3 text-center w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-2 py-2 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="text"
                                            placeholder="Code"
                                            className="w-full bg-transparent px-1 py-1 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none text-slate-700"
                                            value={item.code}
                                            onChange={e => updateItem(idx, 'code', e.target.value)}
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="text"
                                            placeholder="Item description..."
                                            className="w-full bg-transparent px-1 py-1 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none"
                                            value={item.description}
                                            onChange={e => updateItem(idx, 'description', e.target.value)}
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <select
                                            className="w-full bg-transparent px-1 py-1 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none text-sm"
                                            value={item.uom}
                                            onChange={e => updateItem(idx, 'uom', e.target.value)}
                                        >
                                            {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="number"
                                            step="0.001"
                                            min="0"
                                            className="w-full text-right bg-transparent px-1 py-1 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none"
                                            value={item.qty || ''}
                                            onChange={e => updateItem(idx, 'qty', Number(e.target.value))}
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="w-full text-right bg-transparent px-1 py-1 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none"
                                            value={item.rate || ''}
                                            onChange={e => updateItem(idx, 'rate', Number(e.target.value))}
                                        />
                                    </td>
                                    <td className="px-2 py-2 text-right font-bold text-slate-800">
                                        ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                        <button
                                            onClick={() => removeItem(idx)}
                                            disabled={items.length <= 1}
                                            className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all disabled:opacity-30 disabled:hover:text-slate-300 disabled:hover:bg-transparent opacity-0 group-hover:opacity-100"
                                            title="Remove"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Add Item / Import */}
                <div className="flex gap-4 shrink-0 mt-4">
                    <button
                        onClick={addItem}
                        className="flex-1 py-2 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2 font-bold text-sm"
                    >
                        <Plus className="w-4 h-4" /> Add Line Item
                    </button>
                    <button
                        onClick={() => setShowBoqSelect(true)}
                        className="flex-1 py-2 border-2 border-dashed border-orange-300 rounded-xl text-orange-500 hover:border-orange-500 hover:text-orange-600 hover:bg-orange-50/50 transition-all flex items-center justify-center gap-2 font-bold text-sm"
                    >
                        <ClipboardList className="w-4 h-4" /> Import from BOQ
                    </button>
                </div>

                {/* Footer */}
                <div className="flex justify-between gap-3 pt-4 border-t border-gray-200 shrink-0">
                    <button
                        onClick={() => setStep('header')}
                        className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-gray-800 font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Details
                    </button>
                    <div className="flex gap-3">
                        <button onClick={handleClose} className="px-4 py-2 text-red-500 hover:text-red-700 font-medium">
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="px-8 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-lg flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                            {loading ? 'Saving...' : 'Save Work Order'}
                        </button>
                    </div>
                </div>
            </div>

            <BoqSelectModal 
                isOpen={showBoqSelect}
                onClose={() => setShowBoqSelect(false)}
                projectId={projectId || 0}
                onSelectItems={handleImportFromBoq}
            />
        </Modal>
    );
};

export default WorkOrderManualEntryModal;
