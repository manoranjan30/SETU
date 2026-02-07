import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import api from '../../api/axios';

interface EpsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    mode: 'create' | 'edit';
    parentNode?: any; // For create
    nodeToEdit?: any; // For edit
}

const EpsModal: React.FC<EpsModalProps> = ({ isOpen, onClose, onSuccess, mode, parentNode, nodeToEdit }) => {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (mode === 'edit' && nodeToEdit) {
            setName(nodeToEdit.name);
        } else {
            setName('');
        }
        setError('');
    }, [mode, nodeToEdit, isOpen]);

    if (!isOpen) return null;

    // Determine type automatically
    const getNextType = (parentType: string) => {
        switch (parentType) {
            case 'COMPANY': return 'PROJECT';
            case 'PROJECT': return 'BLOCK';
            case 'BLOCK': return 'TOWER';
            case 'TOWER': return 'FLOOR';
            case 'FLOOR': return 'UNIT';
            case 'UNIT': return 'ROOM';
            default: return null;
        }
    };

    const targetType = mode === 'create'
        ? (parentNode ? getNextType(parentNode.type) : 'COMPANY')
        : nodeToEdit.type;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (mode === 'create') {
                await api.post('/eps', {
                    name,
                    type: targetType,
                    parentId: parentNode?.id,
                    order: 0
                });
            } else {
                await api.patch(`/eps/${nodeToEdit.id}`, { name });
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to save node');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-96 p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">
                        {mode === 'create' ? `Add New ${targetType}` : 'Edit Node'}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {error && <div className="mb-4 p-2 bg-red-100 text-red-700 text-sm rounded">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={`Enter ${targetType} Name`}
                            autoFocus
                            required
                        />
                    </div>
                    {parentNode && (
                        <div className="mb-4 text-xs text-gray-500">
                            Creating child under: <span className="font-semibold">{parentNode.name}</span> ({parentNode.type})
                        </div>
                    )}
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
                        >
                            <Save className="w-4 h-4 mr-1" />
                            {loading ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EpsModal;
