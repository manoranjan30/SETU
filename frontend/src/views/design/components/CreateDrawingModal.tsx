
import { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import api from '../../../api/axios';

interface CreateDrawingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    projectId: string;
}

interface Category {
    id: number;
    name: string;
    code: string;
    children?: Category[];
}

const CreateDrawingModal = ({ isOpen, onClose, onSuccess, projectId }: CreateDrawingModalProps) => {
    const [drawingNumber, setDrawingNumber] = useState('');
    const [title, setTitle] = useState('');
    const [categoryId, setCategoryId] = useState<number | ''>('');
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchCategories();
            // Reset form
            setDrawingNumber('');
            setTitle('');
            setCategoryId('');
            setError('');
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!categoryId) {
            setError('Please select a category');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await api.post(`/design/${projectId}/register`, {
                categoryId: Number(categoryId),
                drawingNumber,
                title
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create drawing');
        } finally {
            setLoading(false);
        }
    };

    // Flatten categories for select (or use grouped select)
    const renderCategoryOptions = (cats: Category[], prefix = ''): React.ReactNode[] => {
        return cats.map(cat => (
            <>
                <option key={cat.id} value={cat.id}>{prefix}{cat.name}</option>
                {cat.children && renderCategoryOptions(cat.children, prefix + '-- ')}
            </>
        ));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800">New Drawing Register</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(Number(e.target.value))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                required
                            >
                                <option value="">Select Category</option>
                                {renderCategoryOptions(categories)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Drawing Number</label>
                            <input
                                type="text"
                                value={drawingNumber}
                                onChange={(e) => setDrawingNumber(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="e.g. ARCH-001"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="e.g. Ground Floor Plan"
                                required
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? 'Creating...' : (
                                <>
                                    <Save size={16} />
                                    Create Register
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateDrawingModal;
