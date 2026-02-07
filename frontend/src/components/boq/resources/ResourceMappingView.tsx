import React, { useState, useEffect, useMemo } from 'react';
import { Search, Loader, Check, Wand2, ChevronRight, ChevronDown, Layers, MapPin, Box, CheckSquare, Square, Trash2 } from 'lucide-react';
import api from '../../../api/axios';
import { type BoqItem, type BoqSubItem } from '../../../services/boq.service';
import { boqService } from '../../../services/boq.service';

interface ResourceMappingViewProps {
    projectId: number;
    templates: any[]; // List of available templates
}

interface Suggestion {
    id: number; // measurementID
    suggestedTemplateId: number;
    templateName: string;
    confidence: number;
}

const ResourceMappingView: React.FC<ResourceMappingViewProps> = ({ projectId, templates }) => {
    const [items, setItems] = useState<BoqItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<Record<number, Suggestion>>({});
    const [filter, setFilter] = useState<'ALL' | 'UNMAPPED' | 'MAPPED'>('UNMAPPED');
    const [searchTerm, setSearchTerm] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [expandedMain, setExpandedMain] = useState<number[]>([]);
    const [expandedSub, setExpandedSub] = useState<number[]>([]);
    const [selectedMeasIds, setSelectedMeasIds] = useState<number[]>([]);
    const [bulkTemplateId, setBulkTemplateId] = useState<number | ''>('');

    // Fetch BOQ Items
    const fetchItems = async () => {
        setLoading(true);
        try {
            const data = await boqService.getBoqItems(projectId);
            setItems(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) fetchItems();
    }, [projectId]);

    const toggleMain = (id: number) => {
        setExpandedMain(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSub = (id: number) => {
        setExpandedSub(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    // Bulk selection logic
    const handleSelectMeas = (id: number) => {
        setSelectedMeasIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleSelectSub = (subItem: BoqSubItem) => {
        const measIds = subItem.measurements?.map(m => m.id) || [];
        const allSelected = measIds.every(id => selectedMeasIds.includes(id));
        if (allSelected) {
            setSelectedMeasIds(prev => prev.filter(id => !measIds.includes(id)));
        } else {
            setSelectedMeasIds(prev => [...new Set([...prev, ...measIds])]);
        }
    };

    const handleSelectAll = (isFiltered: boolean) => {
        const targetItems = isFiltered ? filteredItems : items;
        const allMeasIds: number[] = [];
        targetItems.forEach(item => {
            item.subItems?.forEach(sub => {
                sub.measurements?.forEach(meas => {
                    allMeasIds.push(meas.id);
                });
            });
        });

        if (selectedMeasIds.length === allMeasIds.length) {
            setSelectedMeasIds([]);
        } else {
            setSelectedMeasIds(allMeasIds);
        }
    };

    // Handle Auto-Suggest (Updated for Measurements)
    const handleAutoSuggest = async () => {
        setAnalyzing(true);
        try {
            const allMeasurements: { id: number, description: string }[] = [];
            items.forEach(item => {
                item.subItems?.forEach(sub => {
                    sub.measurements?.forEach(meas => {
                        if (!meas.analysisTemplateId) {
                            allMeasurements.push({
                                id: meas.id,
                                description: `${sub.description} - ${meas.elementName} - ${meas.grid || ''}`
                            });
                        }
                    });
                });
            });

            if (allMeasurements.length === 0) {
                alert("No unmapped measurements to analyze.");
                return;
            }

            const res = await api.post('/resources/suggest-mapping', {
                items: allMeasurements.map(m => ({ boqItemId: m.id, description: m.description }))
            });

            const newSuggestions: Record<number, Suggestion> = {};
            res.data.forEach((s: any) => {
                newSuggestions[s.boqItemId] = {
                    id: s.boqItemId,
                    suggestedTemplateId: s.suggestedTemplateId,
                    templateName: s.templateName,
                    confidence: s.confidence
                };
            });
            setSuggestions(newSuggestions);
        } catch (error) {
            console.error(error);
            alert("Failed to generate suggestions");
        } finally {
            setAnalyzing(false);
        }
    };

    // Handle Assign to Single Measurement
    const handleAssign = async (measId: number, templateId: number | null) => {
        try {
            await boqService.updateMeasurement(measId, { analysisTemplateId: templateId });

            // Optimistic Update
            setItems(prev => prev.map(item => ({
                ...item,
                subItems: item.subItems?.map(sub => ({
                    ...sub,
                    measurements: sub.measurements?.map(meas =>
                        meas.id === measId ? { ...meas, analysisTemplateId: templateId || undefined } : meas
                    )
                }))
            })));

            if (suggestions[measId]) {
                const { [measId]: _, ...rest } = suggestions;
                setSuggestions(rest);
            }
        } catch (error) {
            alert("Failed to update mapping");
        }
    };

    // Bulk Assign
    const handleBulkAssign = async () => {
        if (!bulkTemplateId || selectedMeasIds.length === 0) return;

        setLoading(true);
        try {
            await boqService.bulkUpdateMeasurements(selectedMeasIds, { analysisTemplateId: bulkTemplateId });

            // Full state update for consistency
            await fetchItems();
            setSelectedMeasIds([]);
            setBulkTemplateId('');
            alert(`Succesfully mapped ${selectedMeasIds.length} measurements.`);
        } catch (error) {
            alert("Bulk update failed");
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const term = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                item.boqCode.toLowerCase().includes(term) ||
                item.description.toLowerCase().includes(term) ||
                item.subItems?.some(s => s.description.toLowerCase().includes(term)) ||
                item.subItems?.some(s => s.measurements?.some(m => m.elementName.toLowerCase().includes(term)));

            if (!matchesSearch) return false;

            const allMeas = item.subItems?.flatMap(s => s.measurements || []) || [];
            const mappedCount = allMeas.filter(m => !!m.analysisTemplateId).length;

            if (filter === 'UNMAPPED' && mappedCount === allMeas.length && allMeas.length > 0) return false;
            if (filter === 'MAPPED' && mappedCount === 0 && allMeas.length > 0) return false;

            return true;
        });
    }, [items, searchTerm, filter]);

    return (
        <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-900">
            {/* Toolbar */}
            <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap gap-4 justify-between items-center shadow-sm sticky top-0 z-30">
                <div className="flex items-center gap-6">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-all" />
                        <input
                            type="text"
                            placeholder="Search BOQ, breakdowns or specific measurements..."
                            className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 w-96 outline-none transition-all hover:bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        {['ALL', 'UNMAPPED', 'MAPPED'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f as any)}
                                className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${filter === f ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {selectedMeasIds.length > 0 && (
                        <div className="flex items-center gap-2 bg-indigo-50 p-1 pl-3 pr-1 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-right-4">
                            <span className="text-xs font-black text-indigo-700">{selectedMeasIds.length} Selected</span>
                            <div className="w-px h-4 bg-indigo-200 mx-1" />
                            <select
                                className="bg-white text-xs font-bold px-3 py-1.5 rounded-lg border-none focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={bulkTemplateId}
                                onChange={(e) => setBulkTemplateId(e.target.value ? Number(e.target.value) : '')}
                            >
                                <option value="">Select Template...</option>
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.templateCode} {t.description ? `- ${t.description}` : ''}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={handleBulkAssign}
                                disabled={!bulkTemplateId}
                                className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-black hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2"
                            >
                                <Check className="w-3 h-3" /> Apply Bulk
                            </button>
                            <button onClick={() => setSelectedMeasIds([])} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    <button
                        onClick={handleAutoSuggest}
                        disabled={analyzing}
                        className={`flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-black text-xs rounded-xl hover:bg-slate-800 shadow-lg hover:shadow-xl transition-all active:scale-95 ${analyzing ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        {analyzing ? <Loader className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                        {analyzing ? 'MAPPING...' : 'AUTO-SUGGEST'}
                    </button>
                </div>
            </div>

            {/* List Header (Sticky) */}
            <div className="mx-6 mt-4 p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center gap-4 sticky top-24 z-20">
                <button
                    onClick={() => handleSelectAll(true)}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
                >
                    {selectedMeasIds.length > 0 ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                    Select Filtered ({selectedMeasIds.length} select)
                </button>
                <div className="w-px h-4 bg-slate-200" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Project Workspace</span>
            </div>

            {/* Content Context */}
            <div className="flex-1 overflow-auto p-6 pt-2">
                {loading && items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                        <div className="p-4 bg-white rounded-full shadow-lg border border-slate-100">
                            <Loader className="w-8 h-8 animate-spin text-indigo-600" />
                        </div>
                        <p className="font-black text-xs uppercase tracking-widest">Hydrating data nodes...</p>
                    </div>
                ) : (
                    <div className="space-y-3 max-w-7xl mx-auto pb-20">
                        {filteredItems.map(item => {
                            const allMeas = item.subItems?.flatMap(s => s.measurements || []) || [];
                            const mappedCount = allMeas.filter(m => !!m.analysisTemplateId).length;
                            const isMainExpanded = expandedMain.includes(item.id);

                            return (
                                <div key={item.id} className={`group bg-white rounded-2xl border transition-all duration-300 ${isMainExpanded ? 'border-indigo-200 shadow-xl ring-4 ring-indigo-50/50' : 'border-slate-200 shadow-sm hover:border-slate-300'}`}>
                                    {/* Main Item Row */}
                                    <div className="p-4 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div onClick={() => toggleMain(item.id)} className={`p-2 rounded-xl cursor-pointer transition-all ${isMainExpanded ? 'bg-indigo-600 text-white rotate-90 shadow-lg' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100'}`}>
                                                <ChevronRight className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-black tracking-tighter text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">{item.boqCode}</span>
                                                    <h3 className="text-base font-black text-slate-800 tracking-tight">{item.description}</h3>
                                                </div>
                                                <div className="flex items-center gap-4 mt-1.5">
                                                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><Box className="w-3 h-3" /> {item.uom}</span>
                                                    <span className="text-xs font-bold text-slate-500">Qty: <span className="text-slate-900">{item.qty}</span></span>
                                                    <div className="flex items-center gap-2 ml-2">
                                                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-indigo-500 transition-all duration-700" style={{ width: allMeas.length > 0 ? `${(mappedCount / allMeas.length) * 100}%` : '0%' }} />
                                                        </div>
                                                        <span className="text-[10px] font-black text-slate-400">{mappedCount}/{allMeas.length}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sub-Items Layer */}
                                    {isMainExpanded && (
                                        <div className="border-t border-slate-100 bg-slate-50/30 p-4 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                            {item.subItems?.map(sub => {
                                                const isSubExpanded = expandedSub.includes(sub.id);
                                                const subMeas = sub.measurements || [];
                                                const subMapped = subMeas.filter(m => !!m.analysisTemplateId).length;
                                                const allSubSelected = subMeas.length > 0 && subMeas.every(m => selectedMeasIds.includes(m.id));

                                                return (
                                                    <div key={sub.id} className={`rounded-xl border transition-all ${isSubExpanded ? 'bg-white border-indigo-100 shadow-md' : 'bg-white/50 border-slate-200 hover:bg-white'}`}>
                                                        {/* Sub-Item Header */}
                                                        <div className="p-3 flex items-center justify-between gap-3">
                                                            <div className="flex items-center gap-3 flex-1">
                                                                <button
                                                                    onClick={() => handleSelectSub(sub)}
                                                                    className="p-1 hover:bg-slate-100 rounded transition-colors"
                                                                >
                                                                    {allSubSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                                                                </button>
                                                                <div onClick={() => toggleSub(sub.id)} className={`p-1.5 rounded-lg cursor-pointer transition-all ${isSubExpanded ? 'bg-indigo-100 text-indigo-600 shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                                                                    {isSubExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-sm font-black text-slate-700 flex items-center gap-2">
                                                                        <Layers className="w-4 h-4 text-slate-400" />
                                                                        {sub.description}
                                                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{subMeas.length} Rows</span>
                                                                    </h4>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4 pr-2">
                                                                <span className="text-[10px] font-black text-indigo-500">{subMapped}/{subMeas.length} Mapped</span>
                                                            </div>
                                                        </div>

                                                        {/* Measurements Table */}
                                                        {isSubExpanded && (
                                                            <div className="border-t border-slate-100 transition-all">
                                                                <table className="w-full text-left text-[11px]">
                                                                    <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-tighter border-b border-slate-100">
                                                                        <tr>
                                                                            <th className="p-3 w-10 text-center"></th>
                                                                            <th className="p-3 pl-0">Location / Element</th>
                                                                            <th className="p-3 text-center">Grid</th>
                                                                            <th className="p-3 text-right">Quantity</th>
                                                                            <th className="p-3 w-64">Analysis Template</th>
                                                                            <th className="p-3 w-44">Auto-Suggest</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-50">
                                                                        {subMeas.map(meas => {
                                                                            const sug = suggestions[meas.id];
                                                                            const isSelected = selectedMeasIds.includes(meas.id);
                                                                            return (
                                                                                <tr key={meas.id} className={`group/row transition-colors ${isSelected ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'}`}>
                                                                                    <td className="p-3 text-center">
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={isSelected}
                                                                                            onChange={() => handleSelectMeas(meas.id)}
                                                                                            className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 transition-all cursor-pointer"
                                                                                        />
                                                                                    </td>
                                                                                    <td className="p-3 pl-0">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <MapPin className="w-3 h-3 text-slate-300 group-hover/row:text-indigo-400 transition-colors" />
                                                                                            <div>
                                                                                                <div className="font-bold text-slate-700">{meas.elementName}</div>
                                                                                                <div className="text-[9px] text-slate-400 font-medium">EPS ID: {meas.epsNodeId}</div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="p-3 text-center font-mono text-slate-500 font-medium">{meas.grid || '-'}</td>
                                                                                    <td className="p-3 text-right font-black text-slate-600 tabular-nums">{meas.qty}</td>
                                                                                    <td className="p-3">
                                                                                        <div className="relative group/sel">
                                                                                            <select
                                                                                                className={`w-full appearance-none bg-white border rounded-lg px-3 py-1 text-[11px] focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${!meas.analysisTemplateId ? 'border-slate-200 text-slate-400 italic' : 'border-indigo-200 text-slate-900 font-bold bg-indigo-50/20'}`}
                                                                                                value={meas.analysisTemplateId || ''}
                                                                                                onChange={(e) => handleAssign(meas.id, e.target.value ? Number(e.target.value) : null)}
                                                                                            >
                                                                                                <option value="">No Mapping</option>
                                                                                                {templates.map(t => (
                                                                                                    <option key={t.id} value={t.id}>
                                                                                                        {t.templateCode} {t.description ? `- ${t.description}` : ''}
                                                                                                    </option>
                                                                                                ))}
                                                                                            </select>
                                                                                            {meas.analysisTemplateId && <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-indigo-500" />}
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="p-3">
                                                                                        {sug ? (
                                                                                            <div className="flex items-center justify-between p-1 bg-white border border-slate-100 rounded shadow-xs group/sug transition-all hover:border-indigo-200 hover:shadow-sm">
                                                                                                <div className="truncate">
                                                                                                    <div className="text-[8px] font-black text-indigo-600 uppercase flex items-center gap-1">
                                                                                                        <Check className="w-2 h-2" /> Match {sug.confidence}%
                                                                                                    </div>
                                                                                                    <div className="text-[10px] font-bold text-slate-700 truncate" title={sug.templateName}>{sug.templateName}</div>
                                                                                                </div>
                                                                                                {!meas.analysisTemplateId && (
                                                                                                    <button
                                                                                                        onClick={() => handleAssign(meas.id, sug.suggestedTemplateId)}
                                                                                                        className="p-1 px-2 text-[8px] font-black uppercase bg-indigo-600 text-white rounded hover:bg-indigo-700 shadow-xs active:scale-95 transition-all"
                                                                                                    >
                                                                                                        Fix
                                                                                                    </button>
                                                                                                )}
                                                                                            </div>
                                                                                        ) : (
                                                                                            <span className="text-[10px] text-slate-300 italic pl-1">-</span>
                                                                                        )}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                                {subMeas.length === 0 && (
                                                                    <div className="p-8 text-center text-slate-400 italic text-[11px] bg-white rounded-b-xl border-t border-slate-50">
                                                                        No measurement records imported for this breakdown.
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Selection Stats (Floating) */}
            {selectedMeasIds.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 z-50 border border-slate-700 animate-in fade-in slide-in-from-bottom-6 duration-300">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-lg shadow-inner">
                            <CheckSquare className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Selections Active</div>
                            <div className="text-sm font-black tracking-tight">{selectedMeasIds.length} Nodes Highlighted</div>
                        </div>
                    </div>
                    <div className="w-px h-8 bg-slate-700" />
                    <button
                        onClick={() => setSelectedMeasIds([])}
                        className="text-xs font-black text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" /> Clear All
                    </button>
                </div>
            )}

            {/* Footer Summary */}
            <div className="bg-white border-t border-slate-200 p-3 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 flex justify-between items-center z-10">
                <div className="flex items-center gap-5">
                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-200" /> {items.length} Master Nodes</span>
                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-200" /> {items.reduce((acc, i) => acc + (i.subItems?.length || 0), 0)} Logic Sets</span>
                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> {items.reduce((acc, i) => acc + (i.subItems?.flatMap(s => s.measurements || []).length || 0), 0)} Total Data Points</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 flex items-center gap-2">
                        <Loader className="w-3 h-3 text-indigo-400" />
                        Engine Live
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ResourceMappingView;
