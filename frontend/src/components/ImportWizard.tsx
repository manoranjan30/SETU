import React, { useState, useCallback, useEffect } from 'react';
import Papa from 'papaparse';
import { useDropzone } from 'react-dropzone';
import { Upload, X, ArrowRight, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import { boqService, type ImportMapping } from '../services/boq.service';
import api from '../api/axios';
import { toast } from 'react-hot-toast';

interface Props {
    projectId: number;
    mode: 'BOQ_ITEM' | 'MEASUREMENT' | 'RESOURCE_MASTER';
    boqItemId?: number; // Required if mode is MEASUREMENT
    boqSubItemId?: number; // Optional: Link to Sub Item (Layer 2)
    onClose: () => void;
    onSuccess: () => void;
    epsNodes?: EpsNode[]; // Pass flatten list or fetch
}

// ... unchanged interface definitions ...
interface EpsNode {
    id: number;
    name: string;
    parentId?: number;
    type?: string;
}

interface CSVRow {
    [key: string]: string;
}

const BOQ_FIELDS = [
    { key: 'parentBoqCode', label: 'Parent BOQ Code', required: false },
    { key: 'boqCode', label: 'Item Code', required: true },
    { key: 'description', label: 'Description/Title', required: true },
    { key: 'longDescription', label: 'Detailed Description', required: false },
    { key: 'uom', label: 'UOM', required: false },
    { key: 'qty', label: 'Quantity', required: false },
    { key: 'rate', label: 'Rate', required: false },
    { key: 'epsName', label: 'Location / EPS Name', required: false },
    { key: 'epsId', label: 'Location ID (Optional)', required: false },
];

const MEASUREMENT_FIELDS = [
    { key: 'epsName', label: 'Location / EPS Name', required: true },
    { key: 'elementName', label: 'Element Name', required: true },
    { key: 'elementCategory', label: 'Element Category', required: false },
    { key: 'elementType', label: 'Element Type', required: false },
    { key: 'grid', label: 'Grid', required: false },
    { key: 'linkingElement', label: 'Linking Element (3D)', required: false },
    { key: 'length', label: 'Length', required: false },
    { key: 'breadth', label: 'Breadth', required: false },
    { key: 'depth', label: 'Depth', required: false },
    { key: 'height', label: 'Height', required: false },
    { key: 'bottomLevel', label: 'Bottom Level', required: false },
    { key: 'topLevel', label: 'Top Level', required: false },
    { key: 'perimeter', label: 'Perimeter', required: false },
    { key: 'baseArea', label: 'Base Area', required: false },
    { key: 'uom', label: 'UOM', required: false },
    { key: 'qty', label: 'Quantity', required: true },
    { key: 'epsId', label: 'Location ID (Optional)', required: false },
    { key: 'baseCoordinates', label: 'Base Coordinates (JSON)', required: false },
    { key: 'plineAllLengths', label: 'Pline All Lengths', required: false },
];

const RESOURCE_FIELDS = [
    { key: 'resourceCode', label: 'Resource Code (Optional)', required: false },
    { key: 'resourceName', label: 'Resource Name*', required: true },
    { key: 'uom', label: 'UOM*', required: true },
    { key: 'resourceType', label: 'Type (MATERIAL/LABOR/PLANT/OTHER)*', required: true },
    { key: 'standardRate', label: 'Standard Rate (Price)', required: false },
    { key: 'category', label: 'Category', required: false },
    { key: 'specification', label: 'Specification', required: false },
];

export const ImportWizard: React.FC<Props> = ({ projectId, mode, boqItemId, boqSubItemId, onClose, onSuccess, epsNodes }) => {
    // --- State ---
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<CSVRow[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<ImportMapping>({});
    const [validationReport, setValidationReport] = useState<{
        valid: number;
        fuzzy: number;
        errors: { row: number; path: string; msg: string }[];
        total: number;
    } | null>(null);

    // Hierarchy Mapping State
    const [hierarchyMapping, setHierarchyMapping] = useState<{
        level1?: string; // Block
        level2?: string; // Tower
        level3?: string; // Floor
        level4?: string; // Unit
        level5?: string; // Room
    }>({});
    const [defaultEpsId, setDefaultEpsId] = useState<number | undefined>(undefined);
    const [uploading, setUploading] = useState(false);

    // Step 3 State
    const [valueMap, setValueMap] = useState<ImportMapping>({}); // Key=CSV Value, Val=EPS ID (stringified)
    const [uniqueValues, setUniqueValues] = useState<string[]>([]);

    const [localNodes, setLocalNodes] = useState<EpsNode[]>(epsNodes || []);

    useEffect(() => {
        if (epsNodes && epsNodes.length > 0) {
            console.log("ImportWizard: Received nodes from props:", epsNodes.length);
            setLocalNodes(epsNodes);
        } else if (projectId) {
            console.log("ImportWizard: Props empty. Fetching locally for Project:", projectId);
            boqService.getEpsList().then(nodes => { // No args
                console.log("ImportWizard: Local fetch success:", nodes.length);
                setLocalNodes(nodes);
            }).catch(e => console.error("ImportWizard: Local fetch failed", e));
        }
    }, [epsNodes, projectId]);

    const targetFields = mode === 'BOQ_ITEM' ? BOQ_FIELDS : (mode === 'RESOURCE_MASTER' ? RESOURCE_FIELDS : MEASUREMENT_FIELDS);

    // --- Step 1: File Drop ---
    const onDrop = useCallback((acceptedFiles: File[]) => {
        const selectedFile = acceptedFiles[0];
        if (selectedFile) {
            setFile(selectedFile);
            parseFile(selectedFile);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'text/csv': ['.csv', '.xlsx', '.xls'] },
        multiple: false
    });

    const parseFile = (file: File) => {
        Papa.parse(file, {
            preview: 10,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                setHeaders(results.meta.fields || []);
                setPreviewData(results.data as CSVRow[]);
                setStep(2);

                // Auto-map logic
                const autoMap: ImportMapping = {};
                const fields = results.meta.fields || [];
                targetFields.forEach(field => {
                    const match = fields.find(h =>
                        h.toLowerCase().includes(field.key.toLowerCase()) ||
                        h.toLowerCase().includes(field.label.toLowerCase())
                    );
                    if (match) autoMap[field.key as keyof ImportMapping] = match;
                });
                setMapping(autoMap);
            }
        });
    };

    // --- Step 2: Mapping Logic ---
    const handleMapChange = (fieldKey: string, header: string) => {
        setMapping(prev => ({ ...prev, [fieldKey]: header }));
    };

    const isMappingValid = () => {
        const standardRequired = targetFields
            .filter(f => f.required && f.key !== 'epsName')
            .every(f => mapping[f.key as keyof ImportMapping]);

        const hasLocation = mode === 'RESOURCE_MASTER' || (mapping['epsName'] || hierarchyMapping.level1 || defaultEpsId);

        // DEBUG: Check what we actually have
        // alert(`Nodes: ${localNodes?.length}, First: ${JSON.stringify(localNodes?.[0])}, PID: ${projectId}`);


        return standardRequired && !!hasLocation;
    };

    // Transition Step 2 -> Step 3
    const onStep2Next = () => {
        // Priority: Hierarchy > Single Column
        const hasHierarchy = Object.values(hierarchyMapping).some(v => v);

        if (hasHierarchy) {
            validateRows();
            return;
        }

        const epsCol = mapping['epsName'];
        if (mode === 'RESOURCE_MASTER' || !epsCol) {
            // No location mapping at all?
            // If defaultEpsId is set, that's fine.
            setStep(3);
            return;
        }

        if (file) {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const values = new Set<string>();
                    (results.data as any[]).forEach(row => {
                        const val = row[epsCol];
                        if (val) values.add(String(val).trim());
                    });
                    setUniqueValues(Array.from(values).sort());
                    setStep(3);
                }
            });
        }
    };

    // --- Validation Logic ---
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

    const validateRows = async () => {
        if (!file || !epsNodes) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data as any[];
                const report = { valid: 0, fuzzy: 0, errors: [] as any[], total: rows.length };

                // Build Tree Lookup for fast traversal?
                // Actually `epsNodes` is flat, but we need children lookup.
                // Let's build an adjacency list: parentId -> children[]
                const childrenMap = new Map<number, EpsNode[]>();
                const rootNodes: EpsNode[] = [];
                localNodes.forEach(n => {
                    if (!n.parentId) rootNodes.push(n);
                    else {
                        if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, []);
                        childrenMap.get(n.parentId)?.push(n);
                    }
                });

                rows.forEach((row, index) => {
                    const rowNum = index + 2; // +1 for 0-index, +1 for header

                    // 1. Construct Path Values
                    const pathValues = [
                        hierarchyMapping.level1 ? row[hierarchyMapping.level1] : null,
                        hierarchyMapping.level2 ? row[hierarchyMapping.level2] : null,
                        hierarchyMapping.level3 ? row[hierarchyMapping.level3] : null,
                        hierarchyMapping.level4 ? row[hierarchyMapping.level4] : null,
                        hierarchyMapping.level5 ? row[hierarchyMapping.level5] : null,
                    ].filter(v => v); // Remove null/empty

                    if (pathValues.length === 0) {
                        // Fallback to "Default Location" behavior if no path
                        // No error, just count as "default"
                        report.valid++;
                        return;
                    }

                    // 1. Find Project Node
                    // Strategy: We need to find the node that matches our 'projectId'.
                    // Why? Because usually the import is happening "Inside" a project.
                    // If epsNodes includes the Project Node itself (Type=PROJECT), we start there.
                    // If epsNodes includes only children of the project, we might need to look differently.

                    // Assuming obtaining Project Root from the list if possible
                    let projectNode = localNodes.find(n => n.id === projectId);
                    if (!projectNode) {
                        const projects = localNodes.filter(n => (n as any).type && (n as any).type.toUpperCase() === 'PROJECT');
                        if (projects.length === 1) projectNode = projects[0];
                        if (projects.length > 1) projectNode = projects[0]; // Best guess
                    }

                    let currentCandidates = projectNode
                        ? (childrenMap.get(projectNode.id) || [])
                        : rootNodes;

                    console.log("Validation: Root Candidates:", currentCandidates.length, "ProjectNode:", projectNode?.name);

                    let resolvedId = null;
                    let isFuzzy = false;
                    let pathError = null;

                    for (let i = 0; i < pathValues.length; i++) {
                        const val = pathValues[i]?.toString().trim();
                        if (!val) break; // Stop at empty value (e.g. Floor level row)

                        // Find Match
                        const normVal = normalize(val);
                        // Exact match first
                        let match = currentCandidates.find(n => normalize(n.name) === normVal);

                        // If no exact match, try fuzzy (very simple for now)
                        if (!match) {
                            // Try contains? or numeric?
                            // matching "Floor 1" to "1"?
                            match = currentCandidates.find(n => normalize(n.name).includes(normVal) || normVal.includes(normalize(n.name)));
                            if (match) isFuzzy = true;
                        }

                        if (match) {
                            resolvedId = match.id;
                            // Prepare next level
                            currentCandidates = childrenMap.get(match.id) || [];
                        } else {
                            pathError = `Current Node: ${resolvedId || 'Root'}. Child '${val}' not found.`;
                            break;
                        }
                    }

                    if (pathError) {
                        report.errors.push({ row: rowNum, path: pathValues.join(' > '), msg: pathError });
                    } else {
                        if (isFuzzy) report.fuzzy++;
                        else report.valid++;
                    }
                });

                setValidationReport(report);
                setStep(3);
            }
        });
    };



    // --- Step 3: Execution ---
    const handleImport = async () => {
        if (!file) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('projectId', String(projectId));
            formData.append('file', file);

            if (mode === 'BOQ_ITEM') {
                // await boqService.importBoq(projectId, file, mapping, defaultEpsId);
                // Updated logic for BOQ_ITEM to use hierarchy mapping
                if (mapping.epsName) { // If a single EPS column is mapped
                    formData.append('mapping', JSON.stringify(mapping));
                } else { // If hierarchy levels are mapped
                    formData.append('mapping', JSON.stringify({ ...mapping }));
                    formData.append('hierarchyMapping', JSON.stringify(hierarchyMapping));
                }
                if (defaultEpsId) formData.append('defaultEpsId', String(defaultEpsId));
                await boqService.importBoq(formData); // Assuming service now takes FormData
            } else if (mode === 'MEASUREMENT') {
                if (!boqItemId) throw new Error("BOQ Item ID required");
                formData.append('boqItemId', String(boqItemId));
                if (boqSubItemId) formData.append('boqSubItemId', String(boqSubItemId)); // NEW: Send SubItem ID

                // Convert valueMap strings to numbers for API if needed,
                // but service accepts Record<string, number> usually.
                // Our UI select values are stringified numbers.
                if (mapping.epsName) { // If a single EPS column is mapped
                    formData.append('mapping', JSON.stringify(mapping));
                } else {
                    // Pass hierarchy mapping if standard EPS column not mapped
                    formData.append('mapping', JSON.stringify({ ...mapping }));
                    formData.append('hierarchyMapping', JSON.stringify(hierarchyMapping));
                }

                // Pass valueMap only if strictly using the old logic (Optional, likely deprecating)
                // formData.append('valueMap', JSON.stringify(valueMap));
                const numericValueMap: Record<string, number> = {};
                Object.entries(valueMap).forEach(([k, v]) => {
                    if (v && v !== 'SKIP') numericValueMap[k] = Number(v);
                    // Explicitly handle SKIP? Maybe send as negative or separate list?
                    // For now, let's just send mapped ones.
                });
                if (defaultEpsId) formData.append('defaultEpsId', String(defaultEpsId));
                // Assuming importMeasurements also takes FormData now
                await boqService.importMeasurements(formData);
            } else if (mode === 'RESOURCE_MASTER') {
                formData.append('mapping', JSON.stringify(mapping));
                await api.post('/resources/import', formData);
            }
            toast.success('Import started successfully!');
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Import failed. Please check the file.');
        } finally {
            setUploading(false);
        }
    };

    // --- Renders ---

    const renderStep1 = () => (
        <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-400'}`}>
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                    <Upload size={32} />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Upload CSV File</h3>
                    <p className="text-slate-500 mt-1">Drag & drop or click to select</p>
                    <p className="text-xs text-slate-400 mt-2">Supports large files (Streamed)</p>
                </div>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Standard Columns */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                        <CheckCircle size={18} className="text-emerald-500" />
                        Column Mapping
                    </h3>
                    <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                        {targetFields.filter(f => f.key !== 'epsName' && f.key !== 'epsId').map(field => (
                            <div key={field.key} className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className={`text-sm font-medium ${field.required ? 'text-slate-700' : 'text-slate-500'}`}>
                                        {field.label} {field.required && '*'}
                                    </span>
                                    <span className="text-xs text-slate-400">{field.key}</span>
                                </div>
                                <select
                                    className={`w-48 text-sm border rounded px-2 py-1 ${!mapping[field.key as keyof ImportMapping] && field.required ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                                    value={mapping[field.key as keyof ImportMapping] || ''}
                                    onChange={(e) => handleMapChange(field.key, e.target.value)}
                                >
                                    <option value="">-- Select Column --</option>
                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Hierarchy & Fallback (Only for BOQ/Measurement) */}
                {mode !== 'RESOURCE_MASTER' && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                                <AlertTriangle size={18} className="text-blue-500" />
                                EPS Hierarchy Levels
                            </h3>
                            <p className="text-xs text-gray-500 mb-4 bg-blue-50 p-2 rounded">
                                Map columns to define the Location Path. The system will auto-match rows to Block &gt; Tower &gt; Floor etc.
                            </p>
                            <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                {[
                                    { level: 'level1', label: 'Level 1 (e.g. Block)' },
                                    { level: 'level2', label: 'Level 2 (e.g. Tower)' },
                                    { level: 'level3', label: 'Level 3 (e.g. Floor)' },
                                    { level: 'level4', label: 'Level 4 (e.g. Unit)' },
                                    { level: 'level5', label: 'Level 5 (e.g. Room)' },
                                ].map((L) => (
                                    <div key={L.level} className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">{L.label}</span>
                                        <select
                                            className="w-48 border rounded px-2 py-1 text-sm"
                                            value={hierarchyMapping[L.level as keyof typeof hierarchyMapping] || ''}
                                            onChange={e => setHierarchyMapping({ ...hierarchyMapping, [L.level]: e.target.value })}
                                        >
                                            <option value="">-- (Skip Level) --</option>
                                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                <AlertTriangle size={18} className="text-amber-500" />
                                Fallback Values
                            </h3>
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                                <p className="text-sm text-amber-800 mb-3">
                                    If Location/EPS is missing in a row, use this default:
                                </p>
                                <label className="text-xs font-bold text-amber-900 uppercase">Default Location</label>
                                <select
                                    className="w-full mt-1 border-amber-300 rounded px-2 py-1.5 focus:ring-amber-500"
                                    value={defaultEpsId || ''}
                                    onChange={(e) => setDefaultEpsId(Number(e.target.value))}
                                >
                                    <option value="">(None) Skip row if missing</option>
                                    <option disabled>──────────</option>
                                    {localNodes?.map(node => (
                                        <option key={node.id} value={node.id}>{node.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-slate-700">Data Preview (First 5 Rows)</h3>
                    <div className="overflow-auto max-h-48 border rounded bg-white text-xs">
                        <table className="w-full">
                            <thead className="bg-slate-100 sticky top-0">
                                <tr>
                                    {headers.map(h => <th key={h} className="p-2 text-left font-medium text-slate-600">{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {previewData.slice(0, 5).map((row, i) => (
                                    <tr key={i} className="border-t">
                                        {headers.map(h => <td key={h} className="p-2 whitespace-nowrap">{row[h]}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStep3 = () => {
        if (mode === 'RESOURCE_MASTER') {
            return (
                <div className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <CheckCircle className="text-emerald-500" />
                        Ready to Import
                    </h3>
                    <div className="bg-emerald-50 border border-emerald-200 p-8 rounded-xl text-center">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle size={32} />
                        </div>
                        <h4 className="text-xl font-bold text-emerald-900">Resources Ready for Import</h4>
                        <p className="text-emerald-700 mt-2">
                            All required resource fields have been mapped successfully.
                        </p>
                        <div className="mt-6 p-4 bg-white/50 rounded-lg text-sm text-emerald-800 inline-block">
                            Mapping confirmed for: <strong>{Object.keys(mapping).length}</strong> vital fields
                        </div>
                        <p className="text-xs text-emerald-600 mt-6 italic">
                            Click the "Finish & Import" button below to start the process.
                        </p>
                    </div>
                </div>
            );
        }

        // Mode A: Validation Report (Hierarchy)
        if (validationReport) {
            return (
                <div className="space-y-6">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        {validationReport.errors.length === 0 ? <CheckCircle className="text-green-600" /> : <AlertTriangle className="text-amber-500" />}
                        Pre-Import Validation Report
                    </h3>

                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-gray-50 p-4 rounded text-center">
                            <div className="text-2xl font-bold text-gray-700">{validationReport.total}</div>
                            <div className="text-xs text-gray-500 uppercase">Total Rows</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded text-center text-green-700">
                            <div className="text-2xl font-bold">{validationReport.valid}</div>
                            <div className="text-xs uppercase">Perfect Matches</div>
                        </div>
                        <div className="bg-yellow-50 p-4 rounded text-center text-yellow-700">
                            <div className="text-2xl font-bold">{validationReport.fuzzy}</div>
                            <div className="text-xs uppercase">Fuzzy / Auto-Corrected</div>
                        </div>
                        <div className={`p-4 rounded text-center ${validationReport.errors.length > 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-400'}`}>
                            <div className="text-2xl font-bold">{validationReport.errors.length}</div>
                            <div className="text-xs uppercase">Path Errors</div>
                        </div>
                    </div>

                    {validationReport.errors.length > 0 && (
                        <div className="border border-red-200 rounded-lg overflow-hidden">
                            <div className="bg-red-50 px-4 py-2 border-b border-red-200 flex justify-between items-center">
                                <span className="font-semibold text-red-800 text-sm">Error Log (Top 50)</span>
                                <span className="text-xs text-red-600">Please fix these rows in CSV or create missing Nodes.</span>
                            </div>
                            <div className="max-h-60 overflow-y-auto bg-white">
                                <table className="w-full text-left text-xs">
                                    <thead className="text-gray-500 bg-red-50/50 sticky top-0">
                                        <tr>
                                            <th className="p-2 w-16">Row #</th>
                                            <th className="p-2">Path Attempted</th>
                                            <th className="p-2 text-red-600">Error Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {validationReport.errors.slice(0, 50).map((err, i) => (
                                            <tr key={i} className="border-b border-red-50 hover:bg-red-50/30">
                                                <td className="p-2 font-mono text-gray-500">{err.row}</td>
                                                <td className="p-2 font-mono text-gray-700">{err.path}</td>
                                                <td className="p-2 text-red-600">{err.msg}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {validationReport.errors.length === 0 && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded text-center text-green-800">
                            <div className="font-bold">All clear!</div>
                            <p className="text-sm">Structure matched successfully. Ready to import.</p>
                        </div>
                    )}
                </div>
            );
        }

        // Mode B: Legacy Value Mapping
        return (
            <div className="space-y-6">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <CheckCircle size={18} className="text-blue-500" />
                    Map EPS Values
                </h3>
                <p className="text-sm text-slate-500">
                    Found {uniqueValues.length} unique locations in column <b>"{mapping['epsName']}"</b>.
                    Map each value to a system Location.
                </p>

                <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100 text-slate-600 font-medium">
                            <tr>
                                <th className="p-3 text-left">Value in File</th>
                                <th className="p-3 text-left">Map to System Node</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {uniqueValues.map((val, idx) => (
                                <tr key={idx} className="bg-white">
                                    <td className="p-3 font-medium text-slate-700">{val}</td>
                                    <td className="p-3">
                                        <select
                                            className="w-full border-slate-300 rounded px-2 py-1.5"
                                            value={valueMap[val] || ''}
                                            onChange={(e) => setValueMap(prev => ({ ...prev, [val]: e.target.value }))}
                                        >
                                            <option value="">-- Start Typing or Select --</option>
                                            <option value="SKIP">(Skip Rows)</option>
                                            {localNodes?.map(node => (
                                                <option key={node.id} value={node.id}>{node.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b flex items-center justify-between bg-slate-50 rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <FileText className="text-blue-600" />
                            Import {mode === 'BOQ_ITEM' ? 'BOQ Items' : (mode === 'RESOURCE_MASTER' ? 'Global Resources' : 'Measurements')}
                        </h2>
                        <p className="text-sm text-slate-500">
                            {mode === 'BOQ_ITEM' ? 'Bulk import commercial items' : (mode === 'RESOURCE_MASTER' ? 'Bulk import resource master data' : 'Bulk import technical take-offs')}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <div className="flex-1 p-6 overflow-y-auto">
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                </div>

                <div className="p-6 border-t bg-slate-50 rounded-b-xl flex justify-between items-center">
                    {step === 1 && (
                        <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:text-slate-900">Cancel</button>
                    )}
                    {step === 2 && (
                        <>
                            <button
                                onClick={() => { setFile(null); setStep(1); }}
                                className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
                            >
                                Back to Upload
                            </button>
                            <div className="flex items-center gap-4">
                                <div className="text-xs text-slate-400 text-right">
                                    {isMappingValid() ? 'All required fields mapped' : 'Missing required fields'}
                                </div>
                                <button
                                    onClick={onStep2Next}
                                    disabled={!isMappingValid()}
                                    className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all
                                        ${!isMappingValid() ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow'}
                                    `}
                                >
                                    {mode === 'RESOURCE_MASTER' ? 'Next: Review Import' : 'Next: Map Values'} <ArrowRight size={16} />
                                </button>
                            </div>
                        </>
                    )}
                    {step === 3 && (
                        <>
                            <button
                                onClick={() => setStep(2)}
                                className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={uploading}
                                className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 shadow-md flex items-center gap-2"
                            >
                                {uploading ? 'Importing...' : 'Finish & Import'}
                            </button>
                        </>
                    )}
                </div>
                {/* Debug Footer */}
                <div className="p-4 bg-gray-100 text-xs font-mono border-t max-h-32 overflow-auto mb-4 mx-4 rounded-md">
                    <strong>DEBUG INFO:</strong><br />
                    ProjectID: {projectId}<br />
                    Nodes Count: {localNodes?.length || 0}<br />
                    Nodes Data: {JSON.stringify(localNodes?.slice(0, 3) || [])}
                </div>
            </div>
        </div>
    );
};
