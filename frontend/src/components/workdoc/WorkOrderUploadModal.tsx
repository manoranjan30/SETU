import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import api from '../../api/axios';
import { toast } from 'react-hot-toast';
import {
    FileUp, Loader2, CheckCircle, UserPlus, Search, Building2, FileText,
    FileSpreadsheet, ChevronRight, ChevronDown, Indent, Outdent, ArrowLeft, ArrowRight
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import AddVendorModal from './AddVendorModal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}



interface VendorInfo {
    code: string;
    name: string;
    address: string;
    gstin?: string;
    pan?: string;
    state?: string;
    mobileNumber?: string;
    telNo?: string;
    faxNo?: string;
    email?: string;
    uamNo?: string;
    kindAttention?: string;
}

interface HeaderInfo {
    woNumber: string;
    date: string;
    orderAmendNo?: string;
    orderAmendDate?: string;
    orderValidityStart?: string;
    orderValidityEnd?: string;
    orderType?: string;
    projectCode?: string;
    projectDescription?: string;
    invoiceTo?: string;
    scopeOfWork?: string;
}

interface ParsedItem {
    id?: string; // specific for UI
    serialNumber?: string;
    parentSerialNumber?: string | null;
    level?: number;
    isParent?: boolean;
    calculatedAmount?: number;
    code: string;
    description: string;
    qty: number;
    uom: string;
    rate: number;
    amount: number;
    longText: string;
    isExpanded?: boolean;
}

interface ParsedData {
    projectId: number;
    vendor: VendorInfo;
    header: HeaderInfo;
    items: ParsedItem[];
    pdfPath: string;
    originalFileName: string;
}

interface Vendor {
    id: number;
    vendorCode: string;
    name: string;
    gstin?: string;
}

const WorkOrderUploadModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
    const { projectId } = useParams();
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'vendor' | 'pdf_upload' | 'excel_upload' | 'excel_map' | 'review'>('vendor');

    // Parsed Data State
    const [parsedData, setParsedData] = useState<ParsedData | null>(null);
    const [templates, setTemplates] = useState<{ id: number; name: string }[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>();

    // Excel Specific State
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [excelPreview, setExcelPreview] = useState<any>(null);
    const [headerRow, setHeaderRow] = useState(1);
    const [columnMapping, setColumnMapping] = useState<any>({});
    const [excelItems, setExcelItems] = useState<ParsedItem[]>([]);
    const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());

    // Vendor selection state
    const [vendorMode, setVendorMode] = useState<'existing' | 'new'>('existing');
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [vendorSearch, setVendorSearch] = useState('');
    const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
    const [showAddVendor, setShowAddVendor] = useState(false);

    const COLUMN_OPTIONS = [
        { key: 'serialNumber', label: 'Serial No.', required: true },
        { key: 'sapItemNumber', label: 'SAP Item No.', required: false },
        { key: 'shortDescription', label: 'Short Description', required: true },
        { key: 'detailDescription', label: 'Detail Description', required: false },
        { key: 'uom', label: 'Unit of Measurement', required: true },
        { key: 'quantity', label: 'Quantity', required: false },
        { key: 'rate', label: 'Rate', required: false },
        { key: 'amount', label: 'Amount', required: true },
    ];

    useEffect(() => {
        if (isOpen) {
            // Load templates
            api.get('/workdoc/templates').then(res => {
                setTemplates(res.data);
                if (res.data.length > 0) setSelectedTemplateId(res.data[0].id);
            });
            // Load vendors
            api.get('/workdoc/vendors').then(res => {
                setVendors(res.data);
            });
        }
    }, [isOpen]);

    // Filter vendors by search
    const filteredVendors = vendors.filter(v =>
        v.vendorCode.toLowerCase().includes(vendorSearch.toLowerCase()) ||
        v.name.toLowerCase().includes(vendorSearch.toLowerCase())
    );

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

            // Pre-populate vendor info if we already selected one
            const data = response.data as ParsedData;
            if (selectedVendor) {
                data.vendor = {
                    ...data.vendor,
                    code: selectedVendor.vendorCode,
                    name: selectedVendor.name,
                };
            }

            setParsedData({ ...data, items: [] }); // Clear items as we'll get them from Excel
            setStep('excel_upload'); // Move to Excel upload
            toast.success('PDF Header analyzed. Now upload Excel for items.');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to analyze PDF');
        } finally {
            setLoading(false);
        }
    };

    const handleExcelFileSelect = async (selectedFile: File) => {
        setExcelFile(selectedFile);
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            const response = await api.post(`/workdoc/${projectId}/preview-excel`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setExcelPreview(response.data);
            setStep('excel_map');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to preview Excel file');
        } finally {
            setLoading(false);
        }
    };

    const handleExcelImport = async () => {
        if (!excelFile || !projectId) return;

        // Validate required mappings
        const missingRequired = COLUMN_OPTIONS
            .filter(opt => opt.required && columnMapping[opt.key] === undefined)
            .map(opt => opt.label);

        if (missingRequired.length > 0) {
            toast.error(`Please map required columns: ${missingRequired.join(', ')}`);
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', excelFile);
            formData.append('columnMapping', JSON.stringify(columnMapping));
            formData.append('headerRow', String(headerRow));

            const response = await api.post(`/workdoc/${projectId}/import-excel`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Transform items to match ParsedItem interface
            const items = response.data.items.map((item: any, idx: number) => ({
                id: `item-${idx}`,
                serialNumber: item.serialNumber,
                parentSerialNumber: item.parentSerialNumber,
                level: item.level,
                isParent: item.isParent,
                calculatedAmount: item.calculatedAmount,
                code: item.materialCode,
                description: item.shortText,
                longText: item.longText,
                qty: item.quantity,
                uom: item.uom,
                rate: item.rate,
                amount: item.amount,
                isExpanded: true,
            }));

            setExcelItems(items);
            setStep('review');
            toast.success(`Imported ${response.data.totalItems} items from Excel`);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to import Excel file');
        } finally {
            setLoading(false);
        }
    };

    // Toggle parent collapse
    const toggleCollapse = (serialNumber: string) => {
        setCollapsedParents(prev => {
            const next = new Set(prev);
            if (next.has(serialNumber)) {
                next.delete(serialNumber);
            } else {
                next.add(serialNumber);
            }
            return next;
        });
    };

    // Indent item (make it a child)
    const indentItem = (index: number) => {
        const newItems = [...excelItems];
        const item = newItems[index];

        // Find previous parent-level item
        let parentSerial: string | null = null;
        for (let i = index - 1; i >= 0; i--) {
            const prevItem = newItems[i];
            if (prevItem && (prevItem.level === 0 || (prevItem.level || 0) < (item?.level || 0))) {
                parentSerial = prevItem.serialNumber || null;
                break;
            }
        }

        if (parentSerial) {
            item.level = 1;
            item.parentSerialNumber = parentSerial;
            item.isParent = false;

            // Recalculate serial number
            const siblings = newItems.filter(i => i.parentSerialNumber === parentSerial);
            const newChildNum = siblings.length;
            item.serialNumber = `${parentSerial}.${newChildNum}`;

            setExcelItems(newItems);
            recalculateAmounts(newItems);
        }
    };

    // Outdent item (make it a parent)
    const outdentItem = (index: number) => {
        const newItems = [...excelItems];
        const item = newItems[index];

        if ((item.level || 0) > 0) {
            item.level = 0;
            item.parentSerialNumber = null;
            item.isParent = item.qty === 0; // Assuming parent items have 0 quantity

            // Assign new parent serial number (simple increment for now)
            const parentItems = newItems.filter(i => i.level === 0);
            const maxSerial = Math.max(...parentItems.map(i => parseInt(i.serialNumber || '0') || 0));
            item.serialNumber = String(maxSerial + 10); // Increment by 10 for spacing

            setExcelItems(newItems);
            recalculateAmounts(newItems);
        }
    };

    // Recalculate parent amounts
    const recalculateAmounts = (itemList: ParsedItem[]) => {
        const newItems = [...itemList];

        // Calculate child amounts first
        for (const item of newItems) {
            if (!item.isParent) {
                item.calculatedAmount = (item.qty || 0) * (item.rate || 0) || (item.amount || 0);
            }
        }

        // Calculate parent amounts
        // Iterate from bottom up to ensure children are calculated
        for (let i = newItems.length - 1; i >= 0; i--) {
            const item = newItems[i];
            if (item.isParent) {
                const children = newItems.filter(c => c.parentSerialNumber === item.serialNumber);
                item.calculatedAmount = children.reduce((sum, c) => sum + (c.calculatedAmount || 0), 0);
            }
        }

        setExcelItems(newItems);
    };

    // Update item field
    const updateExcelItem = (index: number, field: string, value: any) => {
        const newItems = [...excelItems];
        newItems[index] = { ...newItems[index], [field]: value };

        // Recalculate if quantity or rate changed
        if (field === 'qty' || field === 'rate') {
            recalculateAmounts(newItems);
        } else {
            setExcelItems(newItems);
        }
    };

    const handleConfirmSave = async () => {
        if (!parsedData || !projectId) return;

        setLoading(true);
        try {
            // We use header from PDF (parsedData) and items from Excel (excelItems)
            const itemsToSave = excelItems.map(item => ({
                code: item.code,
                description: item.description,
                longText: item.longText,
                qty: item.qty,
                uom: item.uom,
                rate: item.rate,
                amount: item.calculatedAmount || item.amount, // Use calculated if available
                serialNumber: item.serialNumber,
                parentSerialNumber: item.parentSerialNumber,
                level: item.level,
                isParent: item.isParent,
            }));

            // Prepare data for API
            const saveData = {
                ...parsedData,
                items: itemsToSave,
            };

            await api.post(`/workdoc/${projectId}/confirm`, saveData);
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
        setExcelFile(null);
        setStep('vendor');
        setParsedData(null);
        setExcelItems([]);
        setExcelPreview(null);
        setSelectedVendor(null);
        setVendorSearch('');
        setVendorMode('existing');
    };


    const updateHeader = (field: keyof HeaderInfo, value: string) => {
        if (!parsedData) return;
        setParsedData({
            ...parsedData,
            header: { ...parsedData.header, [field]: value }
        });
    };


    const handleVendorCreated = (vendor: any) => {
        setVendors(prev => [...prev, vendor]);
        setSelectedVendor(vendor);
        setShowAddVendor(false);
        toast.success('Vendor created! Now upload Work Order PDF.');
        setStep('pdf_upload');
    };


    const handleClose = () => {
        reset();
        onClose();
    };

    // =================== STEP 1: VENDOR SELECTION ===================
    if (step === 'vendor') {
        return (
            <Modal isOpen={isOpen} onClose={handleClose} title="Step 1: Select or Create Vendor">
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
                            <p className="text-sm text-green-600 mb-4">You'll need to register the vendor before importing their Work Order.</p>
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
                            onClick={() => setStep('pdf_upload')}
                            disabled={vendorMode === 'existing' && !selectedVendor}
                            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-lg"
                        >
                            Continue to PDF Upload →
                        </button>
                    </div>
                </div>

                <AddVendorModal
                    isOpen={showAddVendor}
                    onClose={() => setShowAddVendor(false)}
                    initialData={{ vendorCode: '', name: '', address: '', gstin: '' }}
                    onSuccess={handleVendorCreated} // Will auto-advance to pdf_upload
                />
            </Modal>
        );
    }

    // =================== STEP 2: PDF UPLOAD (HEADER) ===================
    if (step === 'pdf_upload') {
        return (
            <Modal isOpen={isOpen} onClose={handleClose} title="Step 2: Upload Work Order PDF (Header Info)">
                <div className="space-y-6 py-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 items-start">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                            <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h4 className="font-bold text-blue-900">Uploading for: {selectedVendor?.name}</h4>
                            <p className="text-xs text-blue-700 mt-1">
                                We will extract Work Order Number, Date, and Project details from this PDF.
                            </p>
                        </div>
                    </div>

                    <div
                        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${file ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                            }`}
                        onClick={() => document.getElementById('wo-file')?.click()}
                    >
                        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${file ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
                            }`}>
                            <FileUp className="w-8 h-8" />
                        </div>

                        <input
                            id="wo-file"
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={e => e.target.files && setFile(e.target.files[0])}
                        />

                        {file ? (
                            <div>
                                <p className="font-bold text-blue-700 text-lg">{file.name}</p>
                                <p className="text-xs text-blue-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                        ) : (
                            <div>
                                <p className="text-gray-900 font-bold">Click to Upload Work Order PDF</p>
                                <p className="text-xs text-gray-500 mt-1">Supported format: PDF only</p>
                            </div>
                        )}
                    </div>

                    {/* Template Selection */}
                    {templates.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Select Parser Template</label>
                            <select
                                className="w-full p-2 border rounded-lg bg-white"
                                value={selectedTemplateId}
                                onChange={e => setSelectedTemplateId(Number(e.target.value))}
                            >
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex justify-between gap-3 pt-4 border-t border-gray-200">
                        <button onClick={() => setStep('vendor')} className="px-4 py-2 text-gray-500 hover:text-gray-800 font-medium">
                            ← Back
                        </button>
                        <button
                            onClick={handleAnalyze}
                            disabled={!file || loading}
                            className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-lg flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : null}
                            {loading ? 'Analyzing Header...' : 'Analyze PDF & Next →'}
                        </button>
                    </div>
                </div>
            </Modal>
        );
    }

    // =================== STEP 3: EXCEL UPLOAD (ITEMS) ===================
    if (step === 'excel_upload') {
        return (
            <Modal isOpen={isOpen} onClose={handleClose} title="Step 3: Upload Excel (Detail Items)">
                <div className="space-y-6 py-4">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3 items-start">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h4 className="font-bold text-green-900">Header Info Extracted!</h4>
                            <p className="text-xs text-green-700 mt-1">
                                Now please upload the Excel/CSV file containing the detailed Work Order Items (Quantities, Rates, Amounts) to complete the import.
                            </p>
                        </div>
                    </div>

                    <div
                        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${excelFile ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
                            }`}
                        onClick={() => document.getElementById('excel-file')?.click()}
                    >
                        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${excelFile ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'
                            }`}>
                            <FileSpreadsheet className="w-8 h-8" />
                        </div>

                        <input
                            id="excel-file"
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) handleExcelFileSelect(f);
                            }}
                        />

                        {excelFile ? (
                            <div>
                                <p className="font-bold text-green-700 text-lg">{excelFile.name}</p>
                                <p className="text-xs text-green-500">File loaded successfully</p>
                            </div>
                        ) : (
                            <div>
                                <p className="text-gray-900 font-bold">Select Excel or CSV file</p>
                                <p className="text-xs text-gray-500 mt-1">Supported formats: .xlsx, .xls, .csv</p>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between gap-3 pt-4 border-t border-gray-200">
                        <button onClick={() => setStep('pdf_upload')} className="px-4 py-2 text-gray-500 hover:text-gray-800 font-medium">
                            ← Back
                        </button>
                        <div className="text-sm text-gray-500 italic flex items-center">
                            Upload file to continue...
                        </div>
                    </div>
                </div>
            </Modal>
        );
    }

    // =================== STEP 4: EXCEL MAPPING ===================
    if (step === 'excel_map' && excelPreview) {
        const headers = excelPreview.previewRows[headerRow - 1] || [];

        return (
            <Modal isOpen={isOpen} onClose={handleClose} title="Step 4: Map Excel Columns">
                <div className="space-y-6 max-h-[80vh] overflow-auto">
                    {/* Header Row Selection */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <label className="text-xs font-bold text-slate-500 uppercase">Header Row</label>
                        <select
                            className="mt-1 w-full p-3 border rounded-lg"
                            value={headerRow}
                            onChange={e => setHeaderRow(Number(e.target.value))}
                        >
                            {[1, 2, 3, 4, 5].map(n => (
                                <option key={n} value={n}>Row {n}</option>
                            ))}
                        </select>
                    </div>

                    {/* Column Mapping */}
                    <div className="space-y-3">
                        <h4 className="font-bold text-slate-700">Map Excel Columns to Fields</h4>
                        <div className="grid grid-cols-2 gap-4">
                            {COLUMN_OPTIONS.map(opt => (
                                <div key={opt.key} className="bg-white border rounded-lg p-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                        {opt.label}
                                        {opt.required && <span className="text-red-500">*</span>}
                                    </label>
                                    <select
                                        className="mt-1 w-full p-2 border rounded text-sm"
                                        value={columnMapping[opt.key] ?? ''}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setColumnMapping({
                                                ...columnMapping,
                                                [opt.key]: val === '' ? undefined : Number(val)
                                            });
                                        }}
                                    >
                                        <option value="">-- Select Column --</option>
                                        {headers.map((h: any, idx: number) => (
                                            <option key={idx} value={idx}>
                                                Column {idx + 1}: {h || `(Empty)`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Preview Table */}
                    <div>
                        <h4 className="font-bold text-slate-700 mb-2">Data Preview</h4>
                        <div className="border rounded-xl overflow-auto max-h-48">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-100">
                                    <tr>
                                        {headers.map((h: any, idx: number) => (
                                            <th key={idx} className="px-2 py-2 text-left font-bold text-slate-600">
                                                {h || `Col ${idx + 1}`}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {excelPreview.previewRows.slice(headerRow, headerRow + 5).map((row: any, idx: number) => (
                                        <tr key={idx} className="border-t">
                                            {row.map((cell: any, cidx: number) => (
                                                <td key={cidx} className="px-2 py-1 text-slate-600 truncate max-w-[150px]">
                                                    {cell}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between pt-4 border-t">
                        <button onClick={() => setStep('excel_upload')} className="flex items-center gap-2 text-slate-600 hover:text-slate-800">
                            <ArrowLeft className="w-4 h-4" /> Back
                        </button>
                        <button
                            onClick={handleExcelImport}
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:bg-slate-300"
                        >
                            {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                            Import Items & Review
                        </button>
                    </div>
                </div>
            </Modal>
        );
    }


    // =================== STEP 5: REVIEW & SAVE (MERGED) ===================
    if (step === 'review' && parsedData) {
        return (
            <Modal isOpen={isOpen} onClose={handleClose} title="Step 5: Final Review & Confirm">
                <div className="space-y-6 max-h-[85vh] flex flex-col">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-4 items-start">
                        <CheckCircle className="text-blue-600 shrink-0 mt-1" />
                        <div>
                            <h4 className="font-bold text-blue-900">Import Ready!</h4>
                            <p className="text-blue-700 text-sm">
                                Merged Header (from PDF) and {excelItems.length} Items (from Excel). Please verify before saving.
                            </p>
                        </div>
                    </div>

                    {/* Work Order Details (Header) */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shrink-0">
                        <h3 className="text-xs font-black text-slate-500 uppercase mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4" /> Work Order Header
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                                <label className="text-[10px] text-slate-400 uppercase">Order No.</label>
                                <input className="w-full bg-white border rounded px-2 py-1 font-bold text-blue-600"
                                    value={parsedData.header.woNumber || ''}
                                    onChange={e => updateHeader('woNumber', e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 uppercase">Order Date</label>
                                <input type="date" className="w-full bg-white border rounded px-2 py-1"
                                    value={parsedData.header.date?.split('T')[0] || ''}
                                    onChange={e => updateHeader('date', e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 uppercase">Vendor</label>
                                <div className="font-medium text-slate-700">{parsedData.vendor.name}</div>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 uppercase">Total Amount</label>
                                <div className="font-bold text-green-600">
                                    ₹{excelItems.filter(i => i.level === 0).reduce((s, i) => s + (i.calculatedAmount || i.amount || 0), 0).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Items Table (Hierarchical) */}
                    <div className="flex-1 overflow-auto border rounded-xl">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-100 sticky top-0 z-10">
                                <tr className="text-xs font-bold text-slate-600 uppercase">
                                    <th className="px-3 py-3 text-left w-8"></th>
                                    <th className="px-3 py-3 text-left">Serial</th>
                                    <th className="px-3 py-3 text-left">Code</th>
                                    <th className="px-3 py-3 text-left">Description</th>
                                    <th className="px-3 py-3 text-right">Qty</th>
                                    <th className="px-3 py-3 text-right">Rate</th>
                                    <th className="px-3 py-3 text-right">Amount</th>
                                    <th className="px-3 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {excelItems
                                    .filter(item => item.level === 0 || !collapsedParents.has(item.parentSerialNumber || ''))
                                    .map((item) => {
                                        // Need to find original index for updates
                                        const originalIdx = excelItems.findIndex(i => i.id === item.id);
                                        const hasChildren = excelItems.some(i => i.parentSerialNumber === item.serialNumber);
                                        const isCollapsed = collapsedParents.has(item.serialNumber || '');

                                        return (
                                            <tr
                                                key={item.id}
                                                className={`hover:bg-blue-50/50 transition-colors ${item.isParent ? 'bg-slate-50 font-semibold' : ''}`}
                                            >
                                                {/* Expand/Collapse */}
                                                <td className="px-3 py-2">
                                                    {hasChildren && (
                                                        <button
                                                            onClick={() => toggleCollapse(item.serialNumber || '')}
                                                            className="p-1 hover:bg-slate-200 rounded"
                                                        >
                                                            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                        </button>
                                                    )}
                                                </td>

                                                {/* Serial */}
                                                <td className="px-3 py-2">
                                                    <span
                                                        className={`font-mono ${item.isParent ? 'text-blue-600 font-bold' : 'text-slate-600'}`}
                                                        style={{ paddingLeft: (item.level || 0) * 20 }}
                                                    >
                                                        {item.serialNumber}
                                                    </span>
                                                </td>

                                                {/* Code */}
                                                <td className="px-3 py-2">
                                                    <input
                                                        className="w-full bg-transparent text-slate-700 focus:outline-blue-400"
                                                        value={item.code}
                                                        onChange={e => updateExcelItem(originalIdx, 'code', e.target.value)}
                                                    />
                                                </td>

                                                {/* Description */}
                                                <td className="px-3 py-2">
                                                    <input
                                                        className="w-full bg-transparent focus:outline-blue-400"
                                                        value={item.description}
                                                        onChange={e => updateExcelItem(originalIdx, 'description', e.target.value)}
                                                    />
                                                </td>

                                                {/* Qty */}
                                                <td className="px-3 py-2 text-right">
                                                    {!item.isParent ? (
                                                        <input
                                                            type="number"
                                                            className="w-20 text-right bg-transparent focus:outline-blue-400"
                                                            value={item.qty}
                                                            onChange={e => updateExcelItem(originalIdx, 'qty', Number(e.target.value))}
                                                        />
                                                    ) : <span className="text-slate-400">-</span>}
                                                </td>

                                                {/* Rate */}
                                                <td className="px-3 py-2 text-right">
                                                    {!item.isParent ? (
                                                        <input
                                                            type="number"
                                                            className="w-24 text-right bg-transparent focus:outline-blue-400"
                                                            value={item.rate}
                                                            onChange={e => updateExcelItem(originalIdx, 'rate', Number(e.target.value))}
                                                        />
                                                    ) : <span className="text-slate-400">-</span>}
                                                </td>

                                                {/* Amount */}
                                                <td className="px-3 py-2 text-right font-bold">
                                                    <span className={item.isParent ? 'text-blue-600' : 'text-slate-800'}>
                                                        ₹{(item.calculatedAmount || item.amount || 0).toLocaleString()}
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => indentItem(originalIdx)}
                                                            disabled={(item.level || 0) > 0}
                                                            className="p-1 text-slate-500 hover:bg-slate-200 rounded disabled:opacity-30"
                                                            title="Make Child"
                                                        >
                                                            <Indent className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => outdentItem(originalIdx)}
                                                            disabled={item.level === 0}
                                                            className="p-1 text-slate-500 hover:bg-slate-200 rounded disabled:opacity-30"
                                                            title="Make Parent"
                                                        >
                                                            <Outdent className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between gap-3 pt-4 border-t border-gray-200">
                        <button onClick={() => setStep('excel_map')} className="px-4 py-2 text-gray-500 hover:text-gray-800 font-medium">
                            ← Back to Mapping
                        </button>
                        <div className="flex gap-2">
                            <button onClick={handleClose} className="px-4 py-2 text-red-500 hover:text-red-700 font-medium">
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmSave}
                                disabled={loading}
                                className="px-8 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-lg flex items-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                                Confirm & Save Work Order
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        );
    }

    return null;
};

export default WorkOrderUploadModal;
