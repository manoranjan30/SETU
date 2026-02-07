
import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import api from '../../../api/axios';

interface CategoryManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

interface Category {
    id: number;
    name: string;
    code: string;
}

const CategoryManagerModal = ({ isOpen, onClose, onUpdate }: CategoryManagerModalProps) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [newCatName, setNewCatName] = useState('');
    const [newCatCode, setNewCatCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchCategories();
        }
    }, [isOpen]);

    const fetchCategories = async () => {
        try {
            const res = await api.get('/design/categories');
            setCategories(res.data);
        } catch (err) {
            console.error('Failed to fetch categories');
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await api.post('/design/categories', {
                name: newCatName,
                code: newCatCode
            });
            setNewCatName('');
            setNewCatCode('');
            await fetchCategories();
            onUpdate(); // Notify parent to refresh list
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create category');
        } finally {
            setLoading(false);
        }
    };

    // Note: Delete endpoint might not exist yet in controller, skipping delete for now or implement if easy.
    // Given the request, "create" is the priority.

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-800">Manage Categories</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4">
                    {/* List */}
                    <div className="mb-6 max-h-60 overflow-y-auto border rounded bg-gray-50 p-2">
                        {categories.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">No categories found.</p>
                        ) : (
                            <ul className="space-y-2">
                                {categories.map(cat => (
                                    <li key={cat.id} className="flex justify-between items-center bg-white p-2 rounded shadow-sm border">
                                        <div>
                                            <span className="font-semibold text-gray-700">{cat.name}</span>
                                            <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono">{cat.code}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Create New */}
                    <form onSubmit={handleCreate} className="border-t pt-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Add New Category</h4>
                        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Category Name (e.g. Interior)"
                                className="flex-1 border rounded px-3 py-2 text-sm"
                                value={newCatName}
                                onChange={e => setNewCatName(e.target.value)}
                                required
                            />
                            <input
                                type="text"
                                placeholder="Code (e.g. INT)"
                                className="w-24 border rounded px-3 py-2 text-sm uppercase"
                                value={newCatCode}
                                onChange={e => setNewCatCode(e.target.value.toUpperCase())}
                                required
                            />
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 text-sm flex items-center"
                            >
                                <Plus size={16} />
                                Add
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CategoryManagerModal;
