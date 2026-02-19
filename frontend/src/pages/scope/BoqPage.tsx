import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { boqService } from '../../services/boq.service';
import type { BoqItem, CreateBoqDto, BoqSubItem } from '../../services/boq.service';
import { Download, Upload, Plus, Search, FileSpreadsheet, ArrowLeft, ChevronRight, ChevronDown, Check, X, Trash2, Edit2, Calculator, Ruler } from 'lucide-react';
import { DeleteConfirmationDialog } from '../../components/DeleteConfirmationDialog';
import { ImportWizard } from '../../components/ImportWizard';
import { MeasurementManager } from './MeasurementManager';
import { formatIndianNumber } from '../../utils/format';
import ResourcesView from '../../components/boq/resources/ResourcesView';

const BoqPage = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'BOQ' | 'RESOURCES'>('BOQ');

    // BOQ State
    const [items, setItems] = useState<BoqItem[]>([]);
    const [epsNodes, setEpsNodes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedItems, setExpandedItems] = useState<number[]>([]);

    // Modals & Forms
    const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createSubItemModal, setCreateSubItemModal] = useState<number | null>(null);
    const [selectedMeasurement, setSelectedMeasurement] = useState<{ item: BoqItem, subItem?: BoqSubItem } | null>(null);
    const [newItem, setNewItem] = useState({ boqCode: '', description: '', unitOfMeasure: 'Nos', totalQuantity: 1 });
    const [newSubItem, setNewSubItem] = useState({ description: '', uom: 'Nos', rate: 0 });

    // Editing
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<Partial<BoqItem>>({});
    const [editingSubItemId, setEditingSubItemId] = useState<number | null>(null);
    const [editSubItemForm, setEditSubItemForm] = useState<Partial<BoqSubItem>>({});

    // Deletion
    const [deleteItem, setDeleteItem] = useState<{ id: number, type: 'ITEM' | 'SUBITEM' } | null>(null);

    // Initial Fetch
    const fetchItems = async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const [data, eps] = await Promise.all([
                boqService.getBoqItems(Number(projectId)),
                boqService.getEpsList()
            ]);
            setItems(data);
            setEpsNodes(eps);
        } catch (error) {
            console.error("Failed to fetch BOQ items", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [projectId]);

    // Computed
    const filteredItems = useMemo(() => {
        if (!searchTerm) return items;
        const lower = searchTerm.toLowerCase();
        return items.filter(i =>
            i.boqCode.toLowerCase().includes(lower) ||
            (i.description && i.description.toLowerCase().includes(lower))
        );
    }, [items, searchTerm]);

    const totalBoqValue = useMemo(() => {
        return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    }, [items]);

    // Handlers
    const toggleExpand = (id: number) => {
        setExpandedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleDownloadTemplate = () => {
        boqService.getBoqTemplate();
    };

    const handleCreate = async () => {
        try {
            if (!projectId || !newItem.boqCode || !newItem.description) return;
            await boqService.createBoqItem({
                boqCode: newItem.boqCode,
                boqName: newItem.description,
                unitOfMeasure: newItem.unitOfMeasure,
                totalQuantity: newItem.totalQuantity,
                projectId: Number(projectId),
            } as CreateBoqDto);
            setIsCreateModalOpen(false);
            setNewItem({ boqCode: '', description: '', unitOfMeasure: 'Nos', totalQuantity: 1 });
            fetchItems();
        } catch (error) {
            alert('Failed to create item');
        }
    };

    const handleCreateSubItem = async () => {
        if (!createSubItemModal || !newSubItem.description) return;
        try {
            await boqService.createSubItem({
                boqItemId: createSubItemModal,
                description: newSubItem.description,
                uom: newSubItem.uom,
                rate: newSubItem.rate
            });
            setCreateSubItemModal(null);
            setNewSubItem({ description: '', uom: 'Nos', rate: 0 });
            fetchItems();
        } catch (error) {
            alert('Failed to create sub-item');
        }
    };

    const startEdit = (item: BoqItem) => {
        setEditingId(item.id);
        setEditForm({ ...item });
    };

    const saveEdit = async () => {
        if (!editingId) return;
        try {
            await boqService.update(editingId, editForm);
            setEditingId(null);
            fetchItems();
        } catch (error) {
            alert('Update failed');
        }
    };

    const startSubItemEdit = (subItem: BoqSubItem) => {
        setEditingSubItemId(subItem.id);
        setEditSubItemForm({ ...subItem });
    };

    const saveSubItemEdit = async () => {
        if (!editingSubItemId) return;
        try {
            await boqService.updateSubItem(editingSubItemId, {
                description: editSubItemForm.description,
                uom: editSubItemForm.uom,
                rate: Number(editSubItemForm.rate)
            });
            setEditingSubItemId(null);
            fetchItems();
        } catch (error) {
            alert('Failed to update sub-item');
        }
    };

    const confirmDelete = async () => {
        if (!deleteItem) return;
        try {
            if (deleteItem.type === 'ITEM') {
                await boqService.delete(deleteItem.id);
            } else {
                // Implementation for sub-item delete would go here if service supported it
                // await boqService.deleteSubItem(deleteItem.id);
            }
            setDeleteItem(null);
            fetchItems();
        } catch (error) {
            alert('Delete failed');
        }
    };

    return (
        <div className="p-6 h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 rounded-full text-gray-600">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                            Bill of Quantities (BOQ)
                        </h1>
                        <p className="text-sm text-gray-500">Manage Project Scope and Budget</p>
                    </div>
                </div>

                {/* Tabs & Actions */}
                <div className="flex items-center gap-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-1 flex">
                        <button onClick={() => setActiveTab('BOQ')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'BOQ' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>BOQ Items</button>
                        <button onClick={() => setActiveTab('RESOURCES')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'RESOURCES' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>Define Resources</button>
                    </div>

                    {activeTab === 'BOQ' && (
                        <div className="flex gap-2">
                            <button onClick={handleDownloadTemplate} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-50 shadow-sm">
                                <Download className="w-4 h-4" /> Template
                            </button>
                            <button onClick={() => projectId && boqService.exportBoqCsv(Number(projectId))} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-50 shadow-sm">
                                <FileSpreadsheet className="w-4 h-4 text-green-600" /> Export CSV
                            </button>
                            <button onClick={() => setIsImportWizardOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 shadow-sm">
                                <Upload className="w-4 h-4" /> Import CSV
                            </button>
                            <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm">
                                <Plus className="w-4 h-4" /> Add Item
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Content Switcher */}
            {activeTab === 'RESOURCES' && (
                <div className="flex-1 bg-white rounded-lg shadow overflow-hidden">
                    <ResourcesView />
                </div>
            )}

            {activeTab === 'BOQ' && (
                <div className="flex-1 bg-white rounded-lg shadow flex flex-col overflow-hidden">
                    {/* Toolbar */}
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search items..."
                                className="pl-9 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="text-right">
                            <span className="text-sm text-gray-500">Total Value</span>
                            <div className="text-lg font-bold text-gray-900">₹ {formatIndianNumber(totalBoqValue)}</div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">Description</th>
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Qty</th>
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">UOM</th>
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Rate</th>
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Amount</th>
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {loading ? (
                                    <tr><td colSpan={7} className="p-10 text-center text-gray-500">Loading...</td></tr>
                                ) : filteredItems.map(item => (
                                    <React.Fragment key={item.id}>
                                        <tr className={`hover:bg-gray-50 ${expandedItems.includes(item.id) ? 'bg-blue-50 font-bold' : ''}`}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                <button onClick={() => toggleExpand(item.id)} className="flex items-center gap-2 hover:text-blue-600">
                                                    {expandedItems.includes(item.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    {item.boqCode}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900">
                                                {editingId === item.id ? (
                                                    <input
                                                        className="w-full border rounded p-1"
                                                        value={editForm.description}
                                                        onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                                    />
                                                ) : item.description}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatIndianNumber(item.qty || 0)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{item.uom}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatIndianNumber(item.rate)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">{formatIndianNumber(item.amount)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                                {editingId === item.id ? (
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={saveEdit} className="text-green-600 hover:text-green-800"><Check className="w-4 h-4" /></button>
                                                        <button onClick={() => setEditingId(null)} className="text-gray-600 hover:text-gray-800"><X className="w-4 h-4" /></button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => startEdit(item)} className="text-blue-600 hover:text-blue-800" title="Edit Item"><Edit2 className="w-4 h-4" /></button>
                                                        <button onClick={() => setCreateSubItemModal(item.id)} className="text-indigo-600 hover:text-indigo-800" title="Add Sub Item"><Plus className="w-4 h-4" /></button>
                                                        <button onClick={() => setDeleteItem({ id: item.id, type: 'ITEM' })} className="text-red-600 hover:text-red-800" title="Delete Item"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                        {expandedItems.includes(item.id) && (
                                            <tr>
                                                <td colSpan={7} className="px-12 py-4 bg-gray-50 border-b border-gray-200">
                                                    <div className="space-y-4">
                                                        <div className="flex justify-between items-center px-4">
                                                            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                                                <Ruler className="w-4 h-4 text-blue-500" />
                                                                Breakdown / Measurements
                                                            </h4>
                                                        </div>
                                                        <table className="w-full text-left text-sm">
                                                            <thead className="text-gray-500 text-xs uppercase font-bold border-b border-gray-200">
                                                                <tr>
                                                                    <th className="px-4 py-2">Description</th>
                                                                    <th className="px-4 py-2 text-right">Qty</th>
                                                                    <th className="px-4 py-2 text-center">UOM</th>
                                                                    <th className="px-4 py-2 text-right">Rate</th>
                                                                    <th className="px-4 py-2 text-right">Amount</th>
                                                                    <th className="px-4 py-2 text-center">Actions</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100 bg-white shadow-sm rounded-lg overflow-hidden border border-gray-100">
                                                                {item.subItems && item.subItems.length > 0 ? item.subItems.map(si => (
                                                                    <tr key={si.id} className="hover:bg-blue-50/20">
                                                                        {editingSubItemId === si.id ? (
                                                                            <>
                                                                                <td className="px-4 py-3">
                                                                                    <input
                                                                                        className="w-full border rounded p-1 text-sm"
                                                                                        value={editSubItemForm.description}
                                                                                        onChange={e => setEditSubItemForm({ ...editSubItemForm, description: e.target.value })}
                                                                                    />
                                                                                </td>
                                                                                <td className="px-4 py-3 text-right font-mono text-gray-500">{formatIndianNumber(si.qty, 3)}</td>
                                                                                <td className="px-4 py-3 text-center">
                                                                                    <input
                                                                                        className="w-full border rounded p-1 text-center text-sm"
                                                                                        value={editSubItemForm.uom}
                                                                                        onChange={e => setEditSubItemForm({ ...editSubItemForm, uom: e.target.value })}
                                                                                    />
                                                                                </td>
                                                                                <td className="px-4 py-3 text-right">
                                                                                    <input
                                                                                        type="number"
                                                                                        className="w-full border rounded p-1 text-right text-sm"
                                                                                        value={editSubItemForm.rate}
                                                                                        onChange={e => setEditSubItemForm({ ...editSubItemForm, rate: Number(e.target.value) })}
                                                                                    />
                                                                                </td>
                                                                                <td className="px-4 py-3 text-right font-bold text-gray-900">{formatIndianNumber((si.qty || 0) * (Number(editSubItemForm.rate) || 0))}</td>
                                                                                <td className="px-4 py-3 text-center flex justify-center gap-3">
                                                                                    <button onClick={saveSubItemEdit} className="text-green-600 hover:text-green-800"><Check className="w-4 h-4" /></button>
                                                                                    <button onClick={() => setEditingSubItemId(null)} className="text-gray-600 hover:text-gray-800"><X className="w-4 h-4" /></button>
                                                                                </td>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <td className="px-4 py-3 text-gray-700">{si.description}</td>
                                                                                <td className="px-4 py-3 text-right font-mono">{formatIndianNumber(si.qty, 3)}</td>
                                                                                <td className="px-4 py-3 text-center text-gray-500">{si.uom}</td>
                                                                                <td className="px-4 py-3 text-right text-gray-600">{formatIndianNumber(si.rate)}</td>
                                                                                <td className="px-4 py-3 text-right font-bold text-gray-900">{formatIndianNumber(si.amount)}</td>
                                                                                <td className="px-4 py-3 text-center flex justify-center gap-3">
                                                                                    <button onClick={() => startSubItemEdit(si)} className="text-blue-600 hover:text-blue-800" title="Edit Sub Item"><Edit2 className="w-4 h-4" /></button>
                                                                                    <button
                                                                                        onClick={() => setSelectedMeasurement({ item, subItem: si })}
                                                                                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                                                                                        title="Manage Measurements"
                                                                                    >
                                                                                        <Calculator className="w-4 h-4" />
                                                                                        <span className="text-xs">Sheet</span>
                                                                                    </button>
                                                                                    <button onClick={() => setDeleteItem({ id: si.id, type: 'SUBITEM' })} className="text-red-400 hover:text-red-600">
                                                                                        <Trash2 className="w-3 h-3" />
                                                                                    </button>
                                                                                </td>
                                                                            </>
                                                                        )}
                                                                    </tr>
                                                                )) : (
                                                                    <tr>
                                                                        <td colSpan={6} className="px-4 py-6 text-center text-gray-400 italic">
                                                                            No sub-items or measurements.
                                                                            <button onClick={() => setCreateSubItemModal(item.id)} className="text-blue-600 hover:underline ml-2">Click to add</button>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modals */}
            <DeleteConfirmationDialog
                isOpen={!!deleteItem}
                onClose={() => setDeleteItem(null)}
                onConfirm={confirmDelete}
                itemName="this item"
            />

            {isImportWizardOpen && projectId && (
                <ImportWizard
                    mode="BOQ_ITEM"
                    onClose={() => setIsImportWizardOpen(false)}
                    projectId={Number(projectId)}
                    onSuccess={fetchItems}
                />
            )}

            {selectedMeasurement && projectId && (
                <MeasurementManager
                    projectId={Number(projectId)}
                    boqItem={selectedMeasurement.item}
                    subItem={selectedMeasurement.subItem}
                    onClose={() => setSelectedMeasurement(null)}
                    onUpdate={fetchItems}
                    epsNodes={epsNodes}
                />
            )}

            {/* Create Sub-item Modal */}
            {createSubItemModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-[400px] shadow-2xl scale-in-center">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-indigo-600" />
                            Add Sub-item
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
                                <input
                                    className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="e.g. Ground Floor Concrete"
                                    value={newSubItem.description}
                                    onChange={e => setNewSubItem({ ...newSubItem, description: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-4">
                                <div className="w-1/2">
                                    <label className="text-xs font-bold text-gray-500 uppercase">UOM</label>
                                    <input
                                        className="w-full border rounded p-2"
                                        value={newSubItem.uom}
                                        onChange={e => setNewSubItem({ ...newSubItem, uom: e.target.value })}
                                    />
                                </div>
                                <div className="w-1/2">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Base Rate</label>
                                    <input
                                        type="number"
                                        className="w-full border rounded p-2 font-mono"
                                        value={newSubItem.rate}
                                        onChange={e => setNewSubItem({ ...newSubItem, rate: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <button onClick={() => setCreateSubItemModal(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-medium transition-colors">Cancel</button>
                                <button onClick={handleCreateSubItem} className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 shadow-md transition-all">Create</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
                        <h2 className="text-lg font-bold mb-4">Add BOQ Item</h2>
                        <div className="space-y-4">
                            <input
                                placeholder="BOQ Code"
                                className="w-full border p-2 rounded"
                                value={newItem.boqCode || ''}
                                onChange={e => setNewItem({ ...newItem, boqCode: e.target.value })}
                            />
                            <textarea
                                placeholder="Description"
                                className="w-full border p-2 rounded"
                                value={newItem.description || ''}
                                onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                            />
                            <div className="flex gap-2">
                                <input
                                    placeholder="UOM"
                                    className="w-1/2 border p-2 rounded"
                                    value={newItem.unitOfMeasure || ''}
                                    onChange={e => setNewItem({ ...newItem, unitOfMeasure: e.target.value })}
                                />
                                <input
                                    type="number"
                                    placeholder="Qty"
                                    className="w-1/2 border p-2 rounded"
                                    value={newItem.totalQuantity}
                                    onChange={e => setNewItem({ ...newItem, totalQuantity: Number(e.target.value) })}
                                />
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                                <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Create</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BoqPage;
