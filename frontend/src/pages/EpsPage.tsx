import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import {
    Plus, ChevronRight, ChevronDown, Edit2, Trash2, Folder, Building, Layers, Component, Grid, Box, Layout, Upload, Download, Settings,
    Users,
    ShieldAlert,
    CheckCircle,
    FileText
} from 'lucide-react';
import EpsModal from '../components/eps/EpsModal';
import ProjectPropertiesModal from '../components/eps/ProjectPropertiesModal';
import ProjectTeamModal from '../components/eps/ProjectTeamModal';
import clsx from 'clsx'; // Make sure to install clsx if not present, or use template literals
import { useAuth } from '../context/AuthContext';

// Types
interface EpsNode {
    id: number;
    name: string;
    type: 'COMPANY' | 'PROJECT' | 'BLOCK' | 'TOWER' | 'FLOOR' | 'UNIT' | 'ROOM';
    parentId: number | null;
    children?: EpsNode[];
}

const EpsPage = () => {
    const { user } = useAuth();
    const [nodes, setNodes] = useState<EpsNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [selectedParent, setSelectedParent] = useState<EpsNode | null>(null);
    const [nodeToEdit, setNodeToEdit] = useState<EpsNode | null>(null);
    const [isPropsModalOpen, setIsPropsModalOpen] = useState(false);
    const [selectedProjectForProps, setSelectedProjectForProps] = useState<EpsNode | null>(null);
    const [selectedNodeForTeam, setSelectedNodeForTeam] = useState<{ id: number; name: string } | null>(null);
    const navigate = useNavigate();
    const isAdmin = user?.roles?.includes('Admin') ?? false;

    // Tree State
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});

    useEffect(() => {
        fetchNodes();
    }, []);

    const fetchNodes = async () => {
        setLoading(true);
        setError('');

        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                const res = await api.get('/eps');
                const tree = buildTree(res.data);
                setNodes(tree);
                if (tree.length > 0) {
                    const companyIds = tree.map(node => node.id);
                    const initialExpanded = companyIds.reduce((acc, id) => ({ ...acc, [id]: true }), {});
                    setExpanded(prev => ({ ...prev, ...initialExpanded }));
                }
                setLoading(false);
                return; // Success
            } catch (err) {
                attempts++;
                console.warn(`EPS Fetch Attempt ${attempts} failed`);
                if (attempts === maxAttempts) {
                    setError('Failed to load EPS structure. Please reload.');
                    setLoading(false);
                } else {
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                }
            }
        }
    };



    const buildTree = (flatList: EpsNode[]): EpsNode[] => {
        const map = new Map<number, EpsNode>();
        const roots: EpsNode[] = [];

        // Initialize map
        flatList.forEach(node => {
            map.set(node.id, { ...node, children: [] });
        });

        // Build hierarchy
        flatList.forEach(node => {
            const mappedNode = map.get(node.id)!;
            if (node.parentId) {
                const parent = map.get(node.parentId);
                if (parent) {
                    parent.children?.push(mappedNode);
                }
            } else {
                roots.push(mappedNode);
            }
        });
        // Natural Sort Helper
        const naturalSort = (nodes: EpsNode[]) => {
            nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            nodes.forEach(n => {
                if (n.children && n.children.length > 0) {
                    naturalSort(n.children);
                }
            });
        };

        naturalSort(roots);
        return roots;
    };

    const toggleExpand = (id: number) => {
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleDelete = async (node: EpsNode) => {
        if (!confirm(`Are you sure you want to delete ${node.name}? This cannot be undone.`)) return;
        try {
            await api.delete(`/eps/${node.id}`);
            fetchNodes();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to delete');
        }
    };

    const openCreate = (parent: EpsNode | null) => {
        setModalMode('create');
        setSelectedParent(parent);
        setNodeToEdit(null);
        setIsModalOpen(true);
    };

    const openEdit = (node: EpsNode) => {
        setModalMode('edit');
        setNodeToEdit(node);
        setSelectedParent(null); // Not used in edit
        setIsModalOpen(true);
    };

    const openProperties = (node: EpsNode) => {
        setSelectedProjectForProps(node);
        setIsPropsModalOpen(true);
    };

    const openTeam = (node: EpsNode) => {
        setSelectedNodeForTeam({ id: node.id, name: node.name });
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);

        setLoading(true);
        try {
            await api.post('/eps/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert('Import successful');
            fetchNodes();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Import failed');
        } finally {
            setLoading(false);
            e.target.value = ''; // Reset input
        }
    };

    const handleDownloadTemplate = () => {
        const csvContent = "Company,Project,Block,Tower,Floor,Unit,Room\nMyCompany,Project A,Block 1,Tower A,Level 1,Unit 101,Kitchen";
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'eps_template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    // Recursive Tree Renderer
    const renderTree = (nodes: EpsNode[]) => {
        return nodes.map(node => (
            <div key={node.id} className="ml-4 border-l border-gray-200 pl-2 py-1">
                <div className="flex items-center group">
                    {/* Expand/Collapse */}
                    <button
                        onClick={() => toggleExpand(node.id)}
                        className="mr-1 p-0.5 hover:bg-gray-200 rounded text-gray-500"
                        style={{ visibility: (node.children && node.children.length > 0) ? 'visible' : 'hidden' }}
                    >
                        {expanded[node.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    {/* Icon based on Type */}
                    <span className={clsx("mr-2", {
                        'text-blue-800': node.type === 'COMPANY',
                        'text-blue-600': node.type === 'PROJECT',
                        'text-purple-600': node.type === 'BLOCK',
                        'text-orange-600': node.type === 'TOWER',
                        'text-green-600': node.type === 'FLOOR',
                        'text-indigo-600': node.type === 'UNIT',
                        'text-pink-600': node.type === 'ROOM',
                    })}>
                        {node.type === 'COMPANY' && <Building className="w-4 h-4" />}
                        {node.type === 'PROJECT' && <Folder className="w-4 h-4" />}
                        {node.type === 'BLOCK' && <Grid className="w-4 h-4" />}
                        {node.type === 'TOWER' && <Component className="w-4 h-4" />}
                        {node.type === 'FLOOR' && <Layers className="w-4 h-4" />}
                        {node.type === 'UNIT' && <Box className="w-4 h-4" />}
                        {node.type === 'ROOM' && <Layout className="w-4 h-4" />}
                    </span>

                    {/* Node Name */}
                    <span className="font-medium text-gray-700 text-sm">{node.name}</span>
                    <span className="ml-2 text-xs text-gray-400 uppercase tracking-wider">[{node.type}]</span>

                    {/* Actions */}
                    <div className="ml-auto flex gap-2 opacity-100">
                        {node.type === 'PROJECT' && (
                            <>
                                {isAdmin && (
                                    <button
                                        onClick={() => openTeam(node)}
                                        className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded flex items-center gap-1 transition-colors"
                                        title="Manage Team"
                                    >
                                        <Users className="w-3 h-3" />
                                        Team
                                    </button>
                                )}
                                <button
                                    onClick={() => navigate(`/dashboard/projects/${node.id}/wbs`)}
                                    className="px-2 py-0.5 text-xs bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 rounded flex items-center gap-1 transition-colors"
                                    title="Open Work Breakdown Structure"
                                >
                                    WBS
                                </button>

                                <button
                                    onClick={() => navigate(`/dashboard/projects/${node.id}/boq`)}
                                    className="px-2 py-0.5 text-xs bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200 rounded flex items-center gap-1 transition-colors"
                                    title="Bill of Quantities"
                                >
                                    <Layers className="w-3 h-3" />
                                    BOQ
                                </button>
                                <button
                                    onClick={() => navigate(`/dashboard/projects/${node.id}/planning`)}
                                    className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded flex items-center gap-1 transition-colors"
                                    title="Planning & Lookahead"
                                >
                                    <Grid className="w-3 h-3" />
                                    Plan
                                </button>

                                <button
                                    onClick={() => navigate(`/dashboard/projects/${node.id}/progress`)}
                                    className="px-2 py-0.5 text-xs bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border border-cyan-200 rounded flex items-center gap-1 transition-colors"
                                    title="Daily Site Progress"
                                >
                                    <Box className="w-3 h-3" />
                                    Progress
                                </button>
                                <button
                                    onClick={() => navigate(`/dashboard/projects/${node.id}/ehs`)}
                                    className="px-2 py-0.5 text-xs bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded flex items-center gap-1 transition-colors"
                                    title="Environment, Health & Safety"
                                >
                                    <ShieldAlert className="w-3 h-3" />
                                    EHS
                                </button>
                                <button
                                    onClick={() => navigate(`/dashboard/projects/${node.id}/quality`)}
                                    className="px-2 py-0.5 text-xs bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 rounded flex items-center gap-1 transition-colors"
                                    title="Quality Control & QA"
                                >
                                    <CheckCircle className="w-3 h-3" />
                                    Quality
                                </button>
                                <button
                                    onClick={() => navigate(`/dashboard/projects/${node.id}/design`)}
                                    className="px-2 py-0.5 text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded flex items-center gap-1 transition-colors"
                                    title="Design & Drawings"
                                >
                                    <FileText className="w-3 h-3" />
                                    Design
                                </button>
                            </>
                        )}

                        {isAdmin && (
                            <div className="flex gap-1 opacity-50 hover:opacity-100 transition-opacity">
                                {node.type === 'PROJECT' && (
                                    <button onClick={() => openProperties(node)} className="p-1 text-orange-600 hover:bg-orange-100 rounded" title="Project Properties">
                                        <Settings className="w-3 h-3" />
                                    </button>
                                )}
                                {node.type !== 'ROOM' && (
                                    <button onClick={() => openCreate(node)} className="p-1 text-green-600 hover:bg-green-100 rounded" title="Add Child">
                                        <Plus className="w-3 h-3" />
                                    </button>
                                )}
                                <button onClick={() => openEdit(node)} className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Edit">
                                    <Edit2 className="w-3 h-3" />
                                </button>
                                <button onClick={() => handleDelete(node)} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Delete">
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>


                {/* Children */}
                {expanded[node.id] && node.children && node.children.length > 0 && (
                    <div className="ml-2">
                        {renderTree(node.children)}
                    </div>
                )}
            </div>
        ));
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Enterprise Project Structure (EPS)</h1>
                <div className="flex gap-2">
                    {isAdmin && (
                        <>
                            <button
                                onClick={handleDownloadTemplate}
                                className="bg-white text-gray-700 border border-gray-300 px-3 py-2 rounded shadow hover:bg-gray-50 flex items-center text-sm"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Template
                            </button>
                            <label className="bg-green-600 text-white px-3 py-2 rounded shadow hover:bg-green-700 flex items-center cursor-pointer text-sm">
                                <Upload className="w-4 h-4 mr-2" />
                                Import CSV
                                <input type="file" className="hidden" accept=".csv" onChange={handleImport} />
                            </label>
                            {nodes.length === 0 && !loading && (
                                <button
                                    onClick={() => openCreate(null)}
                                    className="bg-blue-600 text-white px-3 py-2 rounded shadow hover:bg-blue-700 flex items-center text-sm"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Initialize
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 min-h-[500px]">
                {loading ? (
                    <div className="text-center text-gray-500 py-10">Loading EPS...</div>
                ) : error ? (
                    <div className="text-center text-red-500 py-10">{error}</div>
                ) : nodes.length === 0 ? (
                    <div className="text-center text-gray-400 py-10">
                        {isAdmin ? (
                            <>No EPS Defined. Click 'Initialize EPS' to start.</>
                        ) : (
                            <>
                                <p className="text-lg text-gray-600 font-semibold">No Projects Assigned</p>
                                <p className="text-sm">You have not been assigned to any projects yet.</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        {renderTree(nodes)}
                    </div>
                )}
            </div>

            <EpsModal
                isOpen={isModalOpen}
                mode={modalMode}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchNodes}
                parentNode={selectedParent}
                nodeToEdit={nodeToEdit}
            />
            {selectedProjectForProps && (
                <ProjectPropertiesModal
                    isOpen={isPropsModalOpen}
                    onClose={() => setIsPropsModalOpen(false)}
                    nodeId={selectedProjectForProps.id}
                    nodeName={selectedProjectForProps.name}
                />
            )}
            {selectedNodeForTeam && (
                <ProjectTeamModal
                    isOpen={!!selectedNodeForTeam}
                    onClose={() => setSelectedNodeForTeam(null)}
                    projectId={selectedNodeForTeam.id}
                    projectName={selectedNodeForTeam.name}
                />
            )}
        </div>
    );
};

export default EpsPage;
