
import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { UserPlus } from 'lucide-react';
import AddVendorModal from './AddVendorModal';

interface Vendor {
    id: number;
    vendorCode: string;
    name: string;
    contactPerson?: string;
    createdAt: string;
}

const VendorList: React.FC = () => {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 space-y-6">
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

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Vendor Code</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Contact</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Date Added</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">Loading vendors...</td></tr>
                        )}
                        {!loading && vendors.length === 0 && (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 font-medium">No vendors found. Add your first vendor to begin.</td></tr>
                        )}
                        {vendors.map((vendor) => (
                            <tr key={vendor.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-mono text-sm font-bold text-indigo-600">{vendor.vendorCode}</td>
                                <td className="px-6 py-4 font-medium text-slate-700">{vendor.name}</td>
                                <td className="px-6 py-4 text-slate-500 text-sm">{vendor.contactPerson || '-'}</td>
                                <td className="px-6 py-4 text-slate-400 text-sm">{new Date(vendor.createdAt).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <AddVendorModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={fetchVendors}
            />
        </div>
    );
};

export default VendorList;
