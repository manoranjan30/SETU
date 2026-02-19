
import React, { useState, useRef, type MouseEvent } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Save, X, Trash2, LayoutTemplate, Table as TableIcon, Type, MousePointer2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Modal from '../common/Modal';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Set worker path (reuse existing setup)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Area {
    id: string;
    name: string;
    type: 'fixed_fields' | 'table';
    x: number;
    y: number;
    w: number;
    h: number;
    fields: Field[];
    columns: Column[];
}

interface Field {
    id: string;
    key: string;
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

interface Column {
    id: string;
    key: string;
    x: number;
    type: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (templateJson: any) => void;
    sampleFile: File | null;
}

const CoordinateTemplateDesigner: React.FC<Props> = ({ isOpen, onClose, onSave, sampleFile }) => {
    // Unused state removed
    const [scale] = useState(1.0);

    // Tools: 'select', 'draw_header', 'draw_table', 'draw_field', 'draw_column'
    const [tool, setTool] = useState<string>('select');
    const [activeAreaId, setActiveAreaId] = useState<string | null>(null);

    // Data
    const [areas, setAreas] = useState<Area[]>([]);

    // Drawing State
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState<{ x: number, y: number } | null>(null);
    const [currentRect, setCurrentRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

    const pdfWrapperRef = useRef<HTMLDivElement>(null);

    // --- PDF Load ---
    const onDocumentLoadSuccess = () => {
        // success
    };

    // --- Mouse Handlers ---
    const handleMouseDown = (e: MouseEvent) => {
        if (tool === 'select') return;
        if (!pdfWrapperRef.current) return;

        const rect = pdfWrapperRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setIsDrawing(true);
        setStartPos({ x, y });
        setCurrentRect({ x, y, w: 0, h: 0 });
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDrawing || !startPos || !pdfWrapperRef.current) return;

        const rect = pdfWrapperRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setCurrentRect({
            x: Math.min(startPos.x, x),
            y: Math.min(startPos.y, y),
            w: Math.abs(x - startPos.x),
            h: Math.abs(y - startPos.y)
        });
    };

    const handleMouseUp = () => {
        if (!isDrawing || !currentRect || !startPos) return;
        setIsDrawing(false);

        // Convert to PDF Coords (1:1 with scale for now, assuming scale=1)
        // If scale changes, we need to divide by scale.
        const pdfRect = {
            x: currentRect.x / scale,
            y: currentRect.y / scale,
            w: currentRect.w / scale,
            h: currentRect.h / scale
        };

        // Validate size
        if (pdfRect.w < 5 || pdfRect.h < 5) {
            setStartPos(null);
            setCurrentRect(null);
            return;
        }

        // Action based on tool
        if (tool === 'draw_area') {
            const name = prompt("Enter Area Name (e.g. Header, Footer, Table1):", "Header");
            if (name) {
                const type = name.toLowerCase().includes('table') ? 'table' : 'fixed_fields';
                const newArea: Area = {
                    id: crypto.randomUUID(),
                    name,
                    type,
                    x: pdfRect.x,
                    y: pdfRect.y,
                    w: pdfRect.w,
                    h: pdfRect.h,
                    fields: [],
                    columns: []
                };
                setAreas([...areas, newArea]);
                setActiveAreaId(newArea.id);
            }
        }
        else if (tool === 'draw_field' && activeAreaId) {
            const area = areas.find(a => a.id === activeAreaId);
            if (area && area.type === 'fixed_fields') {
                const key = prompt("Enter Field Key (e.g. vendor_name):", "field_" + (area.fields.length + 1));
                if (key) {
                    const newField: Field = {
                        id: crypto.randomUUID(),
                        key,
                        label: key,
                        x: pdfRect.x,
                        y: pdfRect.y,
                        w: pdfRect.w,
                        h: pdfRect.h
                    };
                    const updatedAreas = areas.map(a => a.id === activeAreaId ? { ...a, fields: [...a.fields, newField] } : a);
                    setAreas(updatedAreas);
                }
            } else {
                toast.error("Select a 'Fixed Fields' area first!");
            }
        }

        setStartPos(null);
        setCurrentRect(null);
        setTool('select');
    };

    const handleAddColumn = (e: MouseEvent) => {
        if (tool !== 'draw_column' || !activeAreaId || !pdfWrapperRef.current) return;

        const rect = pdfWrapperRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;

        const area = areas.find(a => a.id === activeAreaId);
        if (area && area.type === 'table') {
            const key = prompt("Column Key (e.g. description):", "col_" + (area.columns.length + 1));
            if (key) {
                const newCol: Column = {
                    id: crypto.randomUUID(),
                    key,
                    x: x,
                    type: 'string'
                };
                const updatedAreas = areas.map(a => a.id === activeAreaId ? { ...a, columns: [...a.columns, newCol] } : a);
                setAreas(updatedAreas);
            }
        } else {
            toast.error("Select a 'Table' area first!");
        }
    };

    // --- JSON Generation ---
    const generateJSON = () => {
        return {
            templateName: "Visual Template",
            areas: areas.map(a => ({
                name: a.name,
                type: a.type,
                bounds: { x: a.x, y: a.y, w: a.w, h: a.h },
                fields: a.fields.map(f => ({
                    key: f.key,
                    label: f.label,
                    x: f.x,
                    y: f.y,
                    w: f.w,
                    h: f.h
                })),
                columns: a.columns.map(c => ({
                    key: c.key,
                    x: c.x,
                    type: c.type
                }))
            }))
        };
    };

    const handleSave = () => {
        const json = generateJSON();
        onSave(json);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Advanced Coordinate Designer" size="xl">
            <div className="flex h-[85vh] gap-4">
                {/* 1. Toolbar */}
                <div className="w-16 flex flex-col items-center gap-4 py-4 bg-slate-900 rounded-xl shadow-xl border border-slate-700">
                    <button
                        onClick={() => setTool('select')}
                        className={`p-3 rounded-xl transition-all ${tool === 'select' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        title="Select Mode"
                    >
                        <MousePointer2 className="w-5 h-5" />
                    </button>

                    <div className="w-8 h-px bg-slate-700" />

                    <button
                        onClick={() => setTool('draw_area')}
                        className={`p-3 rounded-xl transition-all ${tool === 'draw_area' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        title="Draw Area (Header/Table/Footer)"
                    >
                        <LayoutTemplate className="w-5 h-5" />
                    </button>

                    <button
                        onClick={() => {
                            if (!activeAreaId) return toast.error("Select an Area first!");
                            setTool('draw_field');
                        }}
                        className={`p-3 rounded-xl transition-all ${tool === 'draw_field' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        title="Draw Field (in Area)"
                    >
                        <Type className="w-5 h-5" />
                    </button>

                    <button
                        onClick={() => {
                            if (!activeAreaId) return toast.error("Select a Table Area first!");
                            setTool('draw_column');
                        }}
                        className={`p-3 rounded-xl transition-all ${tool === 'draw_column' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        title="Add Table Column"
                    >
                        <TableIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* 2. PDF View */}
                <div className="flex-1 bg-slate-200/50 rounded-xl overflow-auto relative flex justify-center p-8 border border-slate-300 shadow-inner">
                    <div className="relative shadow-2xl" ref={pdfWrapperRef} style={{ display: 'inline-block' }}>
                        {sampleFile ? (
                            <Document file={sampleFile} onLoadSuccess={onDocumentLoadSuccess}>
                                <div
                                    className="relative"
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onClick={tool === 'draw_column' ? handleAddColumn : undefined}
                                    style={{ cursor: tool === 'select' ? 'default' : 'crosshair', display: 'inline-block' }}
                                >
                                    <Page
                                        pageNumber={1}
                                        scale={scale}
                                        renderTextLayer={false}
                                        renderAnnotationLayer={false}
                                    />

                                    {/* Overlay Layer */}
                                    <div className="absolute inset-0 pointer-events-none">
                                        {/* Drawn Areas */}
                                        {areas.map(area => {
                                            const isActive = activeAreaId === area.id;

                                            // Render Columns for Tables
                                            const renderColumns = () => {
                                                if (area.type !== 'table') return null;
                                                return area.columns.map(col => (
                                                    <div
                                                        key={col.id}
                                                        className="absolute top-0 bottom-0 border-l-2 border-purple-500 border-dashed opacity-70"
                                                        style={{ left: col.x * scale }}
                                                    >
                                                        <span className="bg-purple-600 text-white text-[9px] px-1 rounded absolute -top-4 -left-3 pointer-events-auto cursor-pointer">{col.key}</span>
                                                    </div>
                                                ));
                                            }

                                            // Render Fields
                                            const renderFields = () => {
                                                return area.fields.map(field => (
                                                    <div
                                                        key={field.id}
                                                        className="absolute border border-indigo-500 bg-indigo-500/20 hover:bg-indigo-500/30"
                                                        style={{
                                                            left: field.x * scale,
                                                            top: field.y * scale,
                                                            width: field.w * scale,
                                                            height: field.h * scale
                                                        }}
                                                    >
                                                        <span className="text-[10px] bg-indigo-600 text-white px-1 absolute -top-4 left-0">{field.key}</span>
                                                    </div>
                                                ));
                                            };

                                            return (
                                                <React.Fragment key={area.id}>
                                                    <div
                                                        className={`absolute border-2 transition-all pointer-events-auto cursor-pointer ${isActive ? 'border-green-500 bg-green-500/10 z-10' : 'border-slate-400 bg-slate-400/5 hover:border-slate-600'}`}
                                                        style={{
                                                            left: area.x * scale,
                                                            top: area.y * scale,
                                                            width: area.w * scale,
                                                            height: area.h * scale
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveAreaId(area.id);
                                                        }}
                                                    >
                                                        <span className={`text-xs font-bold px-2 py-1 rounded absolute -top-7 left-0 shadow-sm ${isActive ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                                            {area.name} ({area.type})
                                                        </span>
                                                    </div>
                                                    {renderFields()}
                                                    {renderColumns()}
                                                </React.Fragment>
                                            );
                                        })}

                                        {/* Drawing Rect */}
                                        {currentRect && (
                                            <div
                                                className="absolute border-2 border-blue-500 bg-blue-500/20"
                                                style={{ left: currentRect.x, top: currentRect.y, width: currentRect.w, height: currentRect.h }}
                                            />
                                        )}
                                    </div>
                                </div>
                            </Document>
                        ) : (
                            <div className="flex items-center justify-center p-20">Please upload a PDF</div>
                        )}
                    </div>
                </div>

                {/* 3. Properties Panel */}
                <div className="w-72 bg-white border-l border-slate-200 p-4 shadow-xl flex flex-col">
                    <h3 className="font-bold text-slate-800 border-b pb-2 mb-4">Template Elements</h3>

                    <div className="flex-1 overflow-auto space-y-4">
                        {areas.length === 0 && <p className="text-sm text-slate-400 italic text-center text-sm mt-10">Draw an area (Header/Table) to start.</p>}

                        {areas.map(area => (
                            <div key={area.id} className={`p-3 rounded-lg border text-sm ${activeAreaId === area.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                                <div className="flex justify-between items-center mb-2" onClick={() => setActiveAreaId(activeAreaId === area.id ? null : area.id)}>
                                    <span className="font-bold cursor-pointer">{area.name}</span>
                                    <button onClick={(e) => { e.stopPropagation(); setAreas(areas.filter(a => a.id !== area.id)); }}><Trash2 className="w-3 h-3 text-red-400" /></button>
                                </div>
                                <div className="text-xs text-slate-500 mb-2">
                                    Type: <span className="uppercase font-mono">{area.type}</span>
                                </div>

                                {area.type === 'fixed_fields' && (
                                    <div className="space-y-1 pl-2 border-l-2 border-slate-300">
                                        <p className="text-[10px] font-bold text-slate-400">FIELDS</p>
                                        {area.fields.map(f => (
                                            <div key={f.id} className="flex justify-between items-center bg-white p-1 rounded border border-slate-200">
                                                <span className="font-mono text-[10px]">{f.key}</span>
                                                <button onClick={() => {
                                                    const updatedArea = { ...area, fields: area.fields.filter(x => x.id !== f.id) };
                                                    setAreas(areas.map(a => a.id === area.id ? updatedArea : a));
                                                }}><X className="w-3 h-3 text-slate-300 hover:text-red-500" /></button>
                                            </div>
                                        ))}
                                        {area.fields.length === 0 && <span className="text-[10px] italic text-slate-400">Use 'T' tool to add fields</span>}
                                    </div>
                                )}

                                {area.type === 'table' && (
                                    <div className="space-y-1 pl-2 border-l-2 border-purple-300">
                                        <p className="text-[10px] font-bold text-slate-400">COLUMNS</p>
                                        {area.columns.map(c => (
                                            <div key={c.id} className="flex justify-between items-center bg-white p-1 rounded border border-slate-200">
                                                <span className="font-mono text-[10px]">{c.key}</span>
                                                <button onClick={() => {
                                                    const updatedArea = { ...area, columns: area.columns.filter(x => x.id !== c.id) };
                                                    setAreas(areas.map(a => a.id === area.id ? updatedArea : a));
                                                }}><X className="w-3 h-3 text-slate-300 hover:text-red-500" /></button>
                                            </div>
                                        ))}
                                        {area.columns.length === 0 && <span className="text-[10px] italic text-slate-400">Use 'Col' tool to add columns</span>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleSave}
                        className="mt-4 w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" /> Save Template
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default CoordinateTemplateDesigner;
