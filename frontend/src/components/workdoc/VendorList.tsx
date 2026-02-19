
import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { UserPlus, Pencil, Trash2, AlertTriangle, X, Search, FileText, ExternalLink } from 'lucide-react';
import AddVendorModal from './AddVendorModal';
import { toast } from 'react-hot-toast';

interface Vendor {
    id: number;
    vendorCode: string;
    name: string;
    gstin?: string;
    pan?: string;
    address?: string;
    state?: string;
    mobileNumber?: string;
    telNo?: string;
    faxNo?: string;
    contactEmail?: string;
    uamNo?: string;
    kindAttention?: string;
    createdAt: string;
}

interface WorkOrder {
    id: number;
    woNumber: string;
    projectId: number;
}

interface DeleteWarning {
    vendor: Vendor;
    workOrders: WorkOrder[];
}

const VendorList: React.FC = () => {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
    const [deleteWarning, setDeleteWarning] = useState<DeleteWarning | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    useEffect(() => {
        fetchVendors();
    }, []);

    const fetchVendors = async () => {
        setLoading(true);
        try {
            const response = await api.get('/workdoc/vendors');
            setVendors(response.data);
        } catch (error) {
            console.error("Failed to fetch vendors", error);
            toast.error('Failed to fetch vendors');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (vendor: Vendor) => {
        setEditingVendor(vendor);
        setIsAddModalOpen(true);
    };

    const handleDelete = async (vendor: Vendor) => {
        if (!confirm(`Are you sure you want to delete vendor "${vendor.name}"?`)) {
            return;
        }

        setDeletingId(vendor.id);
        try {
            const response = await api.post(`/workdoc/vendors/${vendor.id}/delete`);
            const result = response.data;

            if (result.success) {
                toast.success('Vendor deleted successfully');
                fetchVendors();
            } else if (result.hasWorkOrders) {
                // Show warning modal with work orders
                setDeleteWarning({
                    vendor,
                    workOrders: result.workOrders,
                });
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete vendor');
        } finally {
            setDeletingId(null);
        }
    };

    const handleModalSuccess = () => {
        fetchVendors();
        setEditingVendor(null);
    };

    const handleModalClose = () => {
        setIsAddModalOpen(false);
        setEditingVendor(null);
    };

    const filteredVendors = vendors.filter(v =>
        v.vendorCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.gstin && v.gstin.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-4 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-black text-slate-800">Vendor Directory</h3>
                    <p className="text-slate-500 text-sm">Manage project vendors and contractors</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100"
                >
                    <UserPlus size={18} /> Add New Vendor
                </button>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                    type="text"
                    placeholder="Search by code, name, or GSTIN..."
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Vendor Code</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">GSTIN</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Contact</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Date Added</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && (
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">Loading vendors...</td></tr>
                        )}
                        {!loading && filteredVendors.length === 0 && (
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400 font-medium">
                                {searchTerm ? 'No vendors match your search' : 'No vendors found. Add your first vendor to begin.'}
                            </td></tr>
                        )}
                        {filteredVendors.map((vendor) => (
                            <tr key={vendor.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-4 font-mono text-sm font-bold text-indigo-600">{vendor.vendorCode}</td>
                                <td className="px-6 py-4">
                                    <div>
                                        <p className="font-medium text-slate-700">{vendor.name}</p>
                                        {vendor.address && (
                                            <p className="text-xs text-slate-400 truncate max-w-xs">{vendor.address}</p>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-600 text-sm font-mono">{vendor.gstin || '-'}</td>
                                <td className="px-6 py-4 text-slate-500 text-sm">
                                    {vendor.kindAttention || vendor.mobileNumber || vendor.contactEmail || '-'}
                                </td>
                                <td className="px-6 py-4 text-slate-400 text-sm">
                                    {new Date(vendor.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEdit(vendor)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Edit Vendor"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(vendor)}
                                            disabled={deletingId === vendor.id}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                            title="Delete Vendor"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Stats Footer */}
            <div className="flex justify-between items-center text-sm text-slate-500">
                <span>Showing {filteredVendors.length} of {vendors.length} vendors</span>
            </div>

            {/* Add/Edit Modal */}
            <AddVendorModal
                isOpen={isAddModalOpen}
                onClose={handleModalClose}
                onSuccess={handleModalSuccess}
                initialData={editingVendor ? {
                    vendorCode: editingVendor.vendorCode,
                    name: editingVendor.name,
                    gstin: editingVendor.gstin || '',
                    pan: editingVendor.pan || '',
                    address: editingVendor.address || '',
                    state: editingVendor.state || '',
                    kindAttention: editingVendor.kindAttention || '',
                    mobileNumber: editingVendor.mobileNumber || '',
                    telNo: editingVendor.telNo || '',
                    faxNo: editingVendor.faxNo || '',
                    contactEmail: editingVendor.contactEmail || '',
                    uamNo: editingVendor.uamNo || ''
                } : undefined}
                vendorId={editingVendor?.id}
            />

            {/* Delete Warning Modal */}
            {deleteWarning && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                        {/* Header */}
                        <div className="bg-red-50 px-6 py-4 flex items-center gap-4 border-b border-red-100">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertTriangle className="text-red-600 w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-red-800 text-lg">Cannot Delete Vendor</h3>
                                <p className="text-red-600 text-sm">Work orders are assigned to this vendor</p>
                            </div>
                            <button
                                onClick={() => setDeleteWarning(null)}
                                className="ml-auto text-red-400 hover:text-red-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            <div className="bg-slate-50 p-4 rounded-xl">
                                <p className="text-sm text-slate-600">
                                    The vendor <strong className="text-slate-800">{deleteWarning.vendor.name}</strong> (Code: <code className="text-indigo-600">{deleteWarning.vendor.vendorCode}</code>)
                                    has <strong className="text-red-600">{deleteWarning.workOrders.length} work order(s)</strong> assigned.
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Associated Work Orders:</p>
                                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                                    {deleteWarning.workOrders.map(wo => (
                                        <div key={wo.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50">
                                            <FileText className="text-slate-400 w-4 h-4" />
                                            <div className="flex-1">
                                                <p className="font-medium text-slate-700">{wo.woNumber}</p>
                                                <p className="text-xs text-slate-400">Project ID: {wo.projectId}</p>
                                            </div>
                                            <button
                                                className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1"
                                                title="Go to Work Order"
                                            >
                                                <ExternalLink size={12} /> View
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <p className="text-sm text-amber-800">
                                    <strong>To delete this vendor:</strong> First delete all associated work orders, then try again.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setDeleteWarning(null)}
                                className="px-6 py-2 bg-slate-600 text-white font-bold rounded-lg hover:bg-slate-700 transition-colors"
                            >
                                Understood
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VendorList;
