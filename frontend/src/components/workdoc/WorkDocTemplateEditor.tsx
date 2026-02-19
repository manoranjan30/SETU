
import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import api from '../../api/axios';
import { toast } from 'react-hot-toast';
import { Save, Loader2, Play, Info, FileText, Wand2, Layout } from 'lucide-react';
import { useParams } from 'react-router-dom';
import VisualTemplateDesigner from './VisualTemplateDesigner';
import CoordinateTemplateDesigner from './CoordinateTemplateDesigner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    template: any | null;
}

const WorkDocTemplateEditor: React.FC<Props> = ({ isOpen, onClose, onSuccess, template }) => {
    const { projectId } = useParams();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [config, setConfig] = useState<any>({
        vendorRegex: '',
        woNumberRegex: '',
        dateRegex: '',
        tableConfig: {
            startMarker: '',
            rowRegex: '',
            columnMapping: {
                itemNo: 1,
                code: 2,
                description: 3,
                qty: 4,
                uom: 5,
                rate: 6,
                amount: 7,
                longText: 8
            }
        }
    });

    const [testFile, setTestFile] = useState<File | null>(null);
    const [testResult, setTestResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [showRaw, setShowRaw] = useState(false);
    const [isVisualDesignerOpen, setIsVisualDesignerOpen] = useState(false);
    const [isCoordinateDesignerOpen, setIsCoordinateDesignerOpen] = useState(false);

    useEffect(() => {
        if (template) {
            setName(template.name);
            setDescription(template.description || '');
            setConfig(template.config || config);
        } else {
            setName('');
            setDescription('');
            setConfig({
                vendorRegex: 'Vendor\\s*[:#]?\\s*(\\d+)',
                woNumberRegex: 'Order\\s*No\\.?\\s*[:]?\\s*(\\d{10})',
                dateRegex: 'Date\\s*[:]?\\s*(\\d{2}[./-]\\d{2}[./-]\\d{4})',
                tableConfig: {
                    startMarker: 'ITEM DETAILS',
                    rowRegex: '^\\s*(\\d+\\.\\d+|\\d+)\\s+([\\d/ ]+)\\s+(.+?)\\s+([\\d,.]+)\\s+([a-zA-Z]{2,4})\\s+([\\d,.]+)\\s+([\\d,.]+)',
                    columnMapping: {
                        itemNo: 1,
                        code: 2,
                        description: 3,
                        qty: 4,
                        uom: 5,
                        rate: 6,
                        amount: 7,
                        longText: 0
                    }
                }
            });
        }
        setTestResult(null);
    }, [template, isOpen]);

    const handleSave = async () => {
        if (!name) return toast.error('Template name is required');

        setLoading(true);
        try {
            if (template) {
                await api.post(`/workdoc/templates/${template.id}/update`, {
                    name,
                    description,
                    config
                });
                toast.success('Template updated');
            } else {
                await api.post('/workdoc/templates', {
                    name,
                    description,
                    config
                });
                toast.success('Template created');
            }
            onSuccess();
            onClose();
        } catch (error) {
            toast.error('Failed to save template');
        } finally {
            setLoading(false);
        }
    };

    const handleTest = async () => {
        if (!testFile) return toast.error('Please select a PDF file to test');

        const formData = new FormData();
        formData.append('file', testFile);

        setTesting(true);
        try {
            const response = await api.post(`/workdoc/${projectId}/analyze`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                params: {
                    test: 'true',
                    config: JSON.stringify(config)
                }
            });
            setTestResult(response.data);
            toast.success('Analysis test complete');
        } catch (error) {
            toast.error('Test failed. Check your regex patterns.');
        } finally {
            setTesting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={template ? `Edit Template: ${template.name}` : 'Create New Parsing Template'} size="large">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-h-[85vh] overflow-auto pr-2">

                {/* Rules Section */}
                <div className="space-y-6">
                    <div className="space-y-4">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Basic Information</h4>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-700">Template Name</label>
                            <input
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-blue-500 font-bold"
                                placeholder="e.g. SAP Standard (Provident)"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-700">Description</label>
                            <textarea
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-blue-500 text-sm"
                                placeholder="What kind of PDFs does this template support?"
                                rows={2}
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                            Extraction Regex Rules <Info className="w-3 h-3 cursor-help text-blue-400" />
                        </h4>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-700">Vendor Code Regex</label>
                                <input
                                    className="w-full p-3 bg-slate-900 text-green-400 font-mono text-xs border border-slate-800 rounded-xl focus:outline-blue-500"
                                    value={config.vendorRegex}
                                    onChange={e => setConfig({ ...config, vendorRegex: e.target.value })}
                                />
                                <p className="text-[10px] text-slate-400">Example: Vendor\s*[:#]?\s*(\d+)</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-700">Order Number Regex</label>
                                <input
                                    className="w-full p-3 bg-slate-900 text-green-400 font-mono text-xs border border-slate-800 rounded-xl focus:outline-blue-500"
                                    value={config.woNumberRegex}
                                    onChange={e => setConfig({ ...config, woNumberRegex: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Table Configuration</h4>

                        <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-700">Row Regex (Capturing Groups)</label>
                                <input
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-blue-500 font-mono text-xs"
                                    value={config.tableConfig?.rowRegex || ''}
                                    onChange={e => setConfig({ ...config, tableConfig: { ...config.tableConfig, rowRegex: e.target.value } })}
                                />
                                <p className="text-[10px] text-slate-400">Must use (parentheses) for each column you want to capture.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {config.tableConfig?.columnMapping && Object.entries(config.tableConfig.columnMapping).map(([field, groupIndex]) => (
                                    <div key={field} className="flex flex-col gap-1">
                                        <label className="text-[10px] uppercase font-black text-slate-500">{field.replace(/([A-Z])/g, ' $1')}</label>
                                        <input
                                            type="number"
                                            className="p-2 bg-white border border-slate-200 rounded-lg text-xs"
                                            value={groupIndex as number}
                                            onChange={e => setConfig({
                                                ...config,
                                                tableConfig: {
                                                    ...config.tableConfig,
                                                    columnMapping: { ...config.tableConfig.columnMapping, [field]: Number(e.target.value) }
                                                }
                                            })}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="pt-6">
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all active:scale-95 disabled:bg-slate-300"
                        >
                            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                            {template ? 'Update Template' : 'Create Template'}
                        </button>
                    </div>
                </div>

                {/* Tester Section */}
                <div className="bg-slate-900 rounded-3xl p-6 flex flex-col h-full border border-slate-800 shadow-2xl overflow-hidden">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-6">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Play className="w-4 h-4 text-green-500 fill-current" /> Live Analysis Tester
                        </h4>
                        <div className="flex bg-slate-800 p-1 rounded-lg">
                            <button
                                onClick={() => setShowRaw(false)}
                                className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${!showRaw ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                EXTRACTED
                            </button>
                            <button
                                onClick={() => setShowRaw(true)}
                                className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${showRaw ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                RAW TEXT
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 space-y-6 flex flex-col">
                        <div
                            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${testFile ? 'border-green-500/50 bg-green-500/5' : 'border-slate-800 hover:border-blue-500/50 hover:bg-blue-500/5'}`}
                            onClick={() => document.getElementById('test-pdf')?.click()}
                        >
                            <input id="test-pdf" type="file" className="hidden" accept=".pdf" onChange={e => setTestFile(e.target.files?.[0] || null)} />
                            <FileText className={`w-8 h-8 mx-auto mb-2 ${testFile ? 'text-green-500' : 'text-slate-700'}`} />
                            <p className="text-xs font-bold text-slate-400">{testFile ? testFile.name : 'Upload sample PDF to test rules'}</p>
                        </div>

                        {testFile && (
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setIsVisualDesignerOpen(true)}
                                    className="py-3 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 active:scale-95 transition-all text-xs flex items-center justify-center gap-2"
                                >
                                    <Wand2 className="w-3 h-3" /> Regex Designer
                                </button>
                                <button
                                    onClick={() => setIsCoordinateDesignerOpen(true)}
                                    className="py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all text-xs flex items-center justify-center gap-2"
                                >
                                    <Layout className="w-3 h-3" /> Visual Box Designer
                                </button>
                            </div>
                        )}

                        <button
                            onClick={handleTest}
                            disabled={testing || !testFile}
                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-700 active:scale-95 disabled:opacity-50"
                        >
                            {testing ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : 'Run Test Analysis'}
                        </button>

                        <div className="flex-1 bg-black/50 rounded-2xl border border-slate-800 p-4 font-mono text-[10px] overflow-auto text-green-500/80 custom-scrollbar">
                            {testResult ? (
                                showRaw ? (
                                    <div className="whitespace-pre-wrap">{testResult.rawText}</div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="p-2 border border-slate-800 rounded">
                                                <p className="text-slate-500 uppercase font-black text-[9px]">Vendor</p>
                                                <p className="text-white">{testResult.vendor?.name || 'N/A'} ({testResult.vendor?.code})</p>
                                            </div>
                                            <div className="p-2 border border-slate-800 rounded">
                                                <p className="text-slate-500 uppercase font-black text-[9px]">WO #</p>
                                                <p className="text-white">{testResult.header?.woNumber || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-blue-400 font-black mb-2">Rows Extracted: {testResult.items?.length || 0}</p>
                                            <div className="space-y-2">
                                                {testResult.items?.slice(0, 5).map((item: any, i: number) => (
                                                    <div key={i} className="p-2 bg-slate-800/50 rounded border-l-2 border-green-500">
                                                        <p className="text-white font-bold">{item.code}</p>
                                                        <p className="text-slate-400 truncate">{item.description}</p>
                                                        <p className="text-green-400">Qty: {item.qty} | Rate: {item.rate}</p>
                                                    </div>
                                                ))}
                                                {(testResult.items?.length || 0) > 5 && <p className="text-slate-500 italic">... and {(testResult.items?.length || 0) - 5} more</p>}
                                            </div>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <p className="text-slate-600">No test results yet. Upload a PDF and click 'Run Test Analysis'.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isVisualDesignerOpen && (
                <VisualTemplateDesigner
                    isOpen={isVisualDesignerOpen}
                    onClose={() => setIsVisualDesignerOpen(false)}
                    initialConfig={config}
                    sampleFile={testFile}
                    onSave={(newConfig) => {
                        setConfig(newConfig);
                        setIsVisualDesignerOpen(false);
                        toast.success('Rules updated from Regex Designer!');
                    }}
                />
            )}

            {isCoordinateDesignerOpen && (
                <CoordinateTemplateDesigner
                    isOpen={isCoordinateDesignerOpen}
                    onClose={() => setIsCoordinateDesignerOpen(false)}
                    sampleFile={testFile}
                    onSave={(templateJson) => {
                        setConfig({ ...config, coordinateTemplate: templateJson });
                        setIsCoordinateDesignerOpen(false);
                        toast.success('Coordinate Template Saved!');
                    }}
                />
            )}
        </Modal>
    );
};

export default WorkDocTemplateEditor;
