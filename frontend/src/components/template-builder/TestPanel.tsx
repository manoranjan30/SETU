import { useState } from 'react';
import { Play, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, AlertCircle, FileText, Table, Database, RefreshCw } from 'lucide-react';
import type { TemplateZone, ExtractionTestResult } from '../../types/template.types';

interface TestPanelProps {
    zones: TemplateZone[];
    pdfFile: File | null;
    onClose: () => void;
}

const PDF_TOOL_URL = import.meta.env.VITE_PDF_TOOL_URL || 'http://localhost:8002';

const TestPanel = ({ zones, pdfFile, onClose }: TestPanelProps) => {
    const [testing, setTesting] = useState(false);
    const [results, setResults] = useState<ExtractionTestResult[]>([]);
    const [expandedZones, setExpandedZones] = useState<Record<string, boolean>>({});
    const [error, setError] = useState<string | null>(null);
    const [testPage, setTestPage] = useState<number>(0); // 0 = all pages

    const runTest = async () => {
        if (!pdfFile || zones.length === 0) return;

        setTesting(true);
        setResults([]);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', pdfFile);
            formData.append('template_json', JSON.stringify({
                zones: zones,
                extractionMode: testPage === 0 ? 'all_pages' : 'first_only'
            }));
            formData.append('page_number', testPage.toString());

            const response = await fetch(`${PDF_TOOL_URL}/extract/test-template`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Server error: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.results) {
                const mappedResults: ExtractionTestResult[] = data.results.map((r: any) => ({
                    zoneName: r.zoneName,
                    zoneId: r.zoneId,
                    success: r.success,
                    extractedValue: r.extractedValue,
                    extractedFields: r.extractedFields,
                    matchedRegion: r.matchedRegion,
                    error: r.error,
                    tableData: r.tableData,
                    pageResults: r.pageResults,
                }));
                setResults(mappedResults);

                // Auto-expand first result
                if (mappedResults.length > 0) {
                    setExpandedZones({ [mappedResults[0].zoneId]: true });
                }
            } else {
                throw new Error('Invalid response from extraction service');
            }

        } catch (err) {
            console.error('Test extraction failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to connect to PDF processor');
        } finally {
            setTesting(false);
        }
    };

    const toggleZone = (zoneId: string) => {
        setExpandedZones(prev => ({ ...prev, [zoneId]: !prev[zoneId] }));
    };

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return (
        <div className="h-full flex flex-col bg-white border-l border-gray-200">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <Play size={16} className="text-indigo-500" />
                        Test Extraction
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-sm"
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* Test Options */}
            <div className="p-4 border-b border-gray-100 space-y-3">
                {/* Page Selector */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Test on:</span>
                    <select
                        value={testPage}
                        onChange={(e) => setTestPage(Number(e.target.value))}
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded"
                    >
                        <option value={0}>All Pages</option>
                        <option value={1}>Page 1 only</option>
                        <option value={2}>Page 2</option>
                        <option value={3}>Page 3</option>
                    </select>
                </div>

                {/* Run Button */}
                <button
                    onClick={runTest}
                    disabled={testing || !pdfFile || zones.length === 0}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {testing ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            Extracting...
                        </>
                    ) : (
                        <>
                            <Play size={16} />
                            Run Extraction Test
                        </>
                    )}
                </button>

                {!pdfFile && (
                    <p className="text-xs text-amber-600 text-center">⚠️ Upload a PDF first</p>
                )}
                {pdfFile && zones.length === 0 && (
                    <p className="text-xs text-amber-600 text-center">⚠️ Draw at least one zone</p>
                )}
            </div>

            {/* Error Banner */}
            {error && (
                <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                        <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm text-red-700 font-medium">Connection Error</p>
                            <p className="text-xs text-red-600 mt-1">{error}</p>
                            <p className="text-xs text-gray-500 mt-2">
                                Ensure PDF processor is running: <code className="bg-gray-100 px-1 rounded">{PDF_TOOL_URL}</code>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={runTest}
                        className="mt-3 w-full flex items-center justify-center gap-1 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                        <RefreshCw size={12} />
                        Retry
                    </button>
                </div>
            )}

            {/* Results Summary */}
            {results.length > 0 && (
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 size={16} />
                                {successCount} extracted
                            </span>
                            {failCount > 0 && (
                                <span className="flex items-center gap-1 text-red-600">
                                    <XCircle size={16} />
                                    {failCount} failed
                                </span>
                            )}
                        </div>
                        <span className="text-gray-400 text-xs">
                            {results.length} zones
                        </span>
                    </div>
                </div>
            )}

            {/* Zone Results */}
            <div className="flex-1 overflow-y-auto">
                {results.map(result => {
                    const zone = zones.find(z => z.id === result.zoneId);
                    const isExpanded = expandedZones[result.zoneId];
                    const hasTable = result.tableData && result.tableData.rowCount > 0;

                    return (
                        <div
                            key={result.zoneId}
                            className={`border-b border-gray-100 ${result.success ? 'bg-green-50/50' : 'bg-red-50/50'
                                }`}
                        >
                            {/* Zone Header */}
                            <button
                                onClick={() => toggleZone(result.zoneId)}
                                className="w-full flex items-center gap-3 p-3 hover:bg-white/50"
                            >
                                {result.success ? (
                                    <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                                ) : (
                                    <XCircle size={18} className="text-red-500 shrink-0" />
                                )}
                                <div className="flex-1 text-left">
                                    <p className="text-sm font-medium text-gray-800">{result.zoneName}</p>
                                    <p className="text-xs text-gray-500 flex items-center gap-2">
                                        <span>{zone?.type}</span>
                                        {hasTable && (
                                            <span className="flex items-center gap-1 text-blue-600">
                                                <Table size={10} />
                                                {result.tableData?.rowCount} rows
                                            </span>
                                        )}
                                    </p>
                                </div>
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>

                            {/* Expanded Content */}
                            {isExpanded && (
                                <div className="px-4 pb-4 pl-10 space-y-3">
                                    {result.success ? (
                                        <>
                                            {/* Raw text */}
                                            <div className="p-3 bg-white rounded-lg border border-green-200">
                                                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                                    <FileText size={12} />
                                                    Extracted Text
                                                </p>
                                                <div className="text-sm font-mono text-green-700 whitespace-pre-wrap max-h-40 overflow-y-auto bg-green-50 p-2 rounded">
                                                    {result.extractedValue || '(empty)'}
                                                </div>
                                            </div>

                                            {/* Parsed fields */}
                                            {result.extractedFields && Object.keys(result.extractedFields).length > 0 && (
                                                <div className="p-3 bg-white rounded-lg border border-blue-200">
                                                    <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                                        <Database size={12} />
                                                        Parsed Fields
                                                    </p>
                                                    <div className="space-y-1">
                                                        {Object.entries(result.extractedFields).map(([key, value]) => (
                                                            <div key={key} className="flex text-xs">
                                                                <span className="text-gray-600 font-medium w-28 shrink-0 truncate">{key}:</span>
                                                                <span className="text-blue-700 font-mono truncate">{value || '(null)'}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Table data */}
                                            {hasTable && result.tableData && (
                                                <div className="p-3 bg-white rounded-lg border border-purple-200">
                                                    <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                                        <Table size={12} />
                                                        Table Data ({result.tableData.rowCount} rows)
                                                    </p>
                                                    <div className="overflow-x-auto max-h-48">
                                                        <table className="text-xs w-full">
                                                            <thead className="bg-purple-50">
                                                                <tr>
                                                                    {result.tableData.headers.map((h, i) => (
                                                                        <th key={i} className="px-2 py-1 text-left text-purple-700 font-medium border-b border-purple-200">
                                                                            {h || `Col ${i + 1}`}
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {result.tableData.rows.slice(0, 10).map((row, rowIdx) => (
                                                                    <tr key={rowIdx} className="border-b border-gray-100">
                                                                        {result.tableData!.headers.map((h, colIdx) => (
                                                                            <td key={colIdx} className="px-2 py-1 text-gray-700 font-mono">
                                                                                {row[h] || ''}
                                                                            </td>
                                                                        ))}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                        {result.tableData.rowCount > 10 && (
                                                            <p className="text-xs text-gray-400 mt-2 text-center">
                                                                Showing 10 of {result.tableData.rowCount} rows
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Page results */}
                                            {result.pageResults && result.pageResults.length > 1 && (
                                                <div className="text-xs text-gray-500">
                                                    Extracted from {result.pageResults.length} pages
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="p-3 bg-white rounded-lg border border-red-200">
                                            <p className="text-xs text-gray-500 mb-1">Error:</p>
                                            <p className="text-sm text-red-600">{result.error}</p>
                                            <div className="mt-3 pt-2 border-t border-red-100">
                                                <p className="text-xs text-amber-600 mb-1">💡 Tips:</p>
                                                <ul className="text-xs text-gray-500 ml-4 list-disc space-y-0.5">
                                                    <li>Resize the zone to cover all text</li>
                                                    <li>Check if zone overlaps correct area</li>
                                                    <li>Add fields manually if auto-detect fails</li>
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {results.length === 0 && !testing && !error && (
                    <div className="p-8 text-center text-gray-400">
                        <Play size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Click "Run Extraction Test"</p>
                        <p className="text-xs mt-1">Real data from your PDF will appear here</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500 text-center">
                    ⚡ Using {PDF_TOOL_URL}
                </p>
            </div>
        </div>
    );
};

export default TestPanel;
