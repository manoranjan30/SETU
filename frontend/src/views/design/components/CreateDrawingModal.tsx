
import { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Upload, Settings } from 'lucide-react';
import api from '../../../api/axios';
import CategoryManagerModal from './CategoryManagerModal';

interface CreateDrawingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    projectId: string;
    initialData?: {
        id: number;
        drawingNumber: string;
        title: string;
        category: { id: number };
    } | null;
}

interface Category {
    id: number;
    name: string;
    code: string;
    children?: Category[];
}

const CreateDrawingModal = ({ isOpen, onClose, onSuccess, projectId, initialData }: CreateDrawingModalProps) => {
    const isEditMode = !!initialData;
    const [drawingNumber, setDrawingNumber] = useState('');
    const [title, setTitle] = useState('');
    const [categoryId, setCategoryId] = useState<number | ''>('');
    const [categories, setCategories] = useState<Category[]>([]);
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchCategories();
            if (initialData) {
                setDrawingNumber(initialData.drawingNumber);
                setTitle(initialData.title);
                setCategoryId(initialData.category.id);
                setFile(null); // Files handled separately for edit
            } else {
                // Reset form
                setDrawingNumber('');
                setTitle('');
                setCategoryId('');
                setFile(null);
            }
            setError('');
        }
    }, [isOpen, initialData]);

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
            if (isEditMode && initialData) {
                // Edit Logic
                await api.patch(`/design/${projectId}/register/${initialData.id}`, {
                    categoryId: Number(categoryId),
                    drawingNumber,
                    title
                });

                // If file is selected in edit mode, it's a new revision (upload separate handled?)
                // For simplicity, we only edit metadata here. File uploads should be done via the specific 'Upload Revision' button in the main grid.
                if (file) {
                    // Optional: Auto-trigger upload if user selected a file, but strictly speaking "Edit" usually means metadata
                    // Let's inform user or handle it. For now, let's keep it metadata only for Edit to avoid confusion with Revisioning.
                    // Or we can treat it as "Update Metadata" and "Upload New Revision" in one go?
                    // The prompt asked for "edit and delete", implied metadata edit.
                    // Let's stick to metadata update.
                }

            } else {
                // Create Logic
                const res = await api.post(`/design/${projectId}/register`, {
                    categoryId: Number(categoryId),
                    drawingNumber,
                    title
                });

                const newRegisterId = res.data.id;

                // If file selected, Upload it immediately as Rev 0
                if (file) {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('registerId', String(newRegisterId));
                    formData.append('revisionNumber', '0'); // Default to 0

                    await api.post(`/design/${projectId}/upload`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                }
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to save drawing');
        } finally {
            setLoading(false);
        }
    };

    // Flatten categories for select
    const flattenCategories = (cats: Category[], prefix = ''): { id: number, name: string }[] => {
        let result: { id: number, name: string }[] = [];
        for (const cat of cats) {
            result.push({ id: cat.id, name: prefix + cat.name });
            if (cat.children) {
                result = [...result, ...flattenCategories(cat.children, prefix + '-- ')];
            }
        }
        return result;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800">
                        {isEditMode ? 'Edit Drawing Details' : 'New Drawing Register'}
                    </h3>
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
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-gray-700">Category</label>
                                <button type="button" onClick={() => setIsCatManagerOpen(true)} className="text-xs text-blue-600 hover:align-text-top flex items-center">
                                    <Settings size={12} className="mr-1" /> Manage
                                </button>
                            </div>
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(Number(e.target.value))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                required
                            >
                                <option value="">Select Category</option>
                                {flattenCategories(categories).map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
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

                        {!isEditMode && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Initial File (Optional)</label>
                                <div className="flex items-center justify-center w-full">
                                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <Upload className="w-8 h-8 mb-3 text-gray-400" />
                                            <p className="text-sm text-gray-500">
                                                {file ? file.name : <span className="font-semibold">Click to upload</span>}
                                            </p>
                                            <p className="text-xs text-gray-500">PDF, DWG, DXF, RVT, IFC, NWD</p>
                                        </div>
                                        <input
                                            type="file"
                                            className="hidden"
                                            onChange={(e) => e.target.files && setFile(e.target.files[0])}
                                        />
                                    </label>
                                </div>
                            </div>
                        )}
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
                            {loading ? 'Saving...' : (
                                <>
                                    <Save size={16} />
                                    {isEditMode ? 'Update Details' : (file ? 'Create & Upload' : 'Create Register')}
                                </>
                            )}
                        </button>
                    </div>
                </form>

                <CategoryManagerModal
                    isOpen={isCatManagerOpen}
                    onClose={() => setIsCatManagerOpen(false)}
                    onUpdate={fetchCategories}
                />
            </div>
        </div>
    );
};

export default CreateDrawingModal;
