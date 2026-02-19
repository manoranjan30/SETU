import { useState, useEffect } from 'react';
import api from '../../../api/axios';
import type { QualityUnitTemplate as ITemplate } from '../../../types/quality'; // Adjust path if needed
import { qualityService } from '../../../services/quality.service';
import { ChevronRight, ChevronDown, Plus, Copy, Layers, FileText, ArrowRight } from 'lucide-react';

interface EpsNode {
    id: number;
    name: string;
    type: string;
    children?: EpsNode[];
}

interface Props {
    projectId: number;
}

export default function QualityStructureManager({ projectId }: Props) {
    const [tree, setTree] = useState<EpsNode | null>(null);
    const [templates, setTemplates] = useState<ITemplate[]>([]);
    const [selectedNode, setSelectedNode] = useState<EpsNode | null>(null);
    const [loading, setLoading] = useState(false);

    // Modal States
    const [showTemplateModal, setShowTemplateModal] = useState(false);

    // New Template State
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateRooms, setNewTemplateRooms] = useState('');

    useEffect(() => {
        if (projectId) {
            fetchProjectTree();
            fetchTemplates();
        }
    }, [projectId]);

    const fetchProjectTree = async () => {
        setLoading(true);
        try {
            const res = await api.get('/eps');
            const findProject = (nodes: EpsNode[]): EpsNode | null => {
                for (const node of nodes) {
                    if (node.id === projectId) return node;
                    if (node.children && node.children.length > 0) {
                        const found = findProject(node.children);
                        if (found) return found;
                    }
                }
                return null;
            };
            const projectNode = findProject(res.data);
            setTree(projectNode);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchTemplates = async () => {
        try {
            const data = await qualityService.getTemplates(projectId);
            setTemplates(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateTemplate = async () => {
        try {
            const rooms = newTemplateRooms.split(',').map(r => r.trim()).filter(r => r);
            await qualityService.createTemplate(projectId, { name: newTemplateName, rooms });
            setShowTemplateModal(false);
            setNewTemplateName('');
            setNewTemplateRooms('');
            fetchTemplates();
        } catch (err) {
            alert('Failed to create template');
        }
    };

    const handleApplyTemplate = async (templateId: number) => {
        if (!selectedNode || selectedNode.type !== 'FLOOR') return;
        const count = prompt("How many units to create (e.g. 1)?", "1");
        if (!count) return;

        const prefix = prompt("Unit Prefix (e.g. '10')?");
        const start = prompt("Start Number (e.g. 1)?");

        if (prefix && start) {
            try {
                await qualityService.bulkAddUnits({
                    floorIds: [selectedNode.id],
                    templateId,
                    config: {
                        prefix,
                        startNumber: Number(start),
                        count: Number(count)
                    }
                });
                fetchProjectTree();
                alert('Units created!');
            } catch (err) {
                alert('Failed to apply template');
            }
        }
    };

    return (
        <div className="flex h-[calc(100vh-240px)] bg-white border rounded-xl shadow-sm overflow-hidden">
            {/* Left Panel: Tree */}
            <div className="w-1/3 border-r flex flex-col bg-gray-50/50">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wider">Project Structure</h2>
                    <button onClick={fetchProjectTree} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Refresh</button>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                    {loading ? <p className="text-gray-400 text-sm text-center py-4">Loading structure...</p> :
                        tree ? <TreeNode node={tree} onSelect={setSelectedNode} selectedId={selectedNode?.id} /> :
                            <p className="text-gray-400 text-sm text-center py-4">Project not found.</p>}
                </div>
            </div>

            {/* Right Panel: Details & Actions */}
            <div className="flex-1 flex flex-col overflow-y-auto">
                {selectedNode ? (
                    <div className="p-8">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                                        {selectedNode.type}
                                    </span>
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                    {selectedNode.type === 'PROJECT' && <Layers className="w-6 h-6 text-blue-600" />}
                                    {selectedNode.name}
                                </h2>
                            </div>
                        </div>

                        {/* Actions Area */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {/* Template Management */}
                            <div className="border border-gray-200 p-5 rounded-xl bg-white shadow-sm">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                                    <FileText className="w-4 h-4 text-orange-500" /> Unit Templates
                                </h3>
                                <div className="space-y-3">
                                    {templates.length === 0 && <div className="text-sm text-gray-400 italic text-center py-4 bg-gray-50 rounded-lg">No templates defined.</div>}
                                    {templates.map(t => (
                                        <div key={t.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm group hover:border-blue-200 transition-colors">
                                            <div>
                                                <div className="font-medium text-gray-900">{t.name}</div>
                                                <div className="text-xs text-gray-500">{t.structure.rooms.length} rooms defined</div>
                                            </div>
                                            {selectedNode.type === 'FLOOR' && (
                                                <button
                                                    onClick={() => handleApplyTemplate(t.id)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1 shadow-sm"
                                                >
                                                    Apply <ArrowRight className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => setShowTemplateModal(true)}
                                        className="w-full mt-2 py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" /> Create New Template
                                    </button>
                                </div>
                            </div>

                            {/* Copy / Bulk Actions */}
                            <div className="border border-gray-200 p-5 rounded-xl bg-white shadow-sm">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                                    <Copy className="w-4 h-4 text-indigo-500" /> Operations
                                </h3>
                                <div className="space-y-3">
                                    {selectedNode.type === 'FLOOR' ? (
                                        <button
                                            onClick={() => alert('Feature: Copy Floor Modal (Not Implemented)')}
                                            className="w-full bg-indigo-50 text-indigo-700 border border-indigo-100 py-3 rounded-lg text-sm hover:bg-indigo-100 font-medium transition-colors text-left px-4 flex justify-between items-center"
                                        >
                                            Copy Floor Structure
                                            <ArrowRight className="w-4 h-4 opacity-50" />
                                        </button>
                                    ) : (
                                        <div className="text-sm text-gray-400 text-center py-8 bg-gray-50 rounded-lg">
                                            Select a Floor node to perform copy operations.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Content Preview */}
                        <div>
                            <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Contents</h3>
                            {selectedNode.children?.length === 0 ? (
                                <p className="text-gray-400 italic text-sm">No items found.</p>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {selectedNode.children?.map(c => (
                                        <div key={c.id} className="p-3 border border-gray-100 rounded-lg bg-white hover:shadow-md transition-shadow text-sm group">
                                            <div className="font-medium text-gray-900 mb-1">{c.name}</div>
                                            <div className="text-xs text-gray-500 bg-gray-100 inline-block px-1.5 py-0.5 rounded">{c.type}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Layers className="w-16 h-16 text-gray-200 mb-4" />
                        <p>Select a node from the tree to manage structure.</p>
                    </div>
                )}
            </div>

            {/* Template Modal */}
            {showTemplateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold mb-6 text-gray-900">Create Unit Template</h3>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Template Name</label>
                            <input
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="e.g. 3BHK Type A"
                                value={newTemplateName}
                                onChange={e => setNewTemplateName(e.target.value)}
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rooms (Comma Separated)</label>
                            <textarea
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 h-32 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                placeholder="Living, Kitchen, Master Bedroom, Balcony..."
                                value={newTemplateRooms}
                                onChange={e => setNewTemplateRooms(e.target.value)}
                            />
                            <p className="text-xs text-gray-400 mt-1">These rooms will be created for every unit.</p>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowTemplateModal(false)} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium">Cancel</button>
                            <button onClick={handleCreateTemplate} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium shadow-lg shadow-blue-200">Create Template</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function TreeNode({ node, onSelect, selectedId }: { node: EpsNode, onSelect: (n: EpsNode) => void, selectedId?: number }) {
    const [expanded, setExpanded] = useState(false);
    const hasChildren = node.children && node.children.length > 0;

    useEffect(() => {
        if (node.type === 'PROJECT' || node.type === 'BLOCK' || node.type === 'TOWER') {
            setExpanded(true);
        }
    }, [node.type]);

    return (
        <div className="ml-3 select-none">
            <div
                className={`flex items-center cursor-pointer p-1.5 rounded-lg transition-all ${selectedId === node.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-600'}`}
                onClick={() => onSelect(node)}
            >
                <button
                    onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                    className={`mr-1 p-0.5 rounded hover:bg-black/5 ${hasChildren ? 'text-gray-400' : 'invisible'}`}
                >
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <span className="truncate text-sm">{node.name}</span>
            </div>
            {expanded && hasChildren && (
                <div className="ml-2 border-l border-gray-200 pl-1">
                    {node.children!.map(c => <TreeNode key={c.id} node={c} onSelect={onSelect} selectedId={selectedId} />)}
                </div>
            )}
        </div>
    );
}
