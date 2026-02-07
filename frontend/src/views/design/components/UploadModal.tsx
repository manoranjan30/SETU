
import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Upload, FileText, AlertCircle } from 'lucide-react';

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (file: File, registerId: number, revisionNumber: string) => Promise<void>;
    registerItem: { id: number; drawingNumber: string; title: string; nextRevision: string } | null;
}

const UploadModal = ({ isOpen, onClose, onUpload, registerItem }: UploadModalProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [revisionNumber, setRevisionNumber] = useState(registerItem?.nextRevision || '0');
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onDrop = (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0]);
            setError(null);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        maxFiles: 1,
        multiple: false
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !registerItem) return;

        setIsUploading(true);
        setError(null);

        try {
            await onUpload(file, registerItem.id, revisionNumber);
            onClose();
            setFile(null);
        } catch (err: any) {
            setError(err.message || 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    if (!isOpen || !registerItem) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Upload Drawing</h3>
                        <p className="text-sm text-gray-500">{registerItem.drawingNumber} - {registerItem.title}</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Revision Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Revision Number
                        </label>
                        <input
                            type="text"
                            value={revisionNumber}
                            onChange={(e) => setRevisionNumber(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                            placeholder="e.g. 0, A, B, 1"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            System suggested next revision: <span className="font-mono font-medium">{registerItem.nextRevision}</span>
                        </p>
                    </div>

                    {/* File Dropzone */}
                    <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
                            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}
                            ${file ? 'bg-green-50 border-green-200' : ''}
                        `}
                    >
                        <input {...getInputProps()} />

                        {file ? (
                            <div className="flex flex-col items-center text-green-700">
                                <FileText size={40} className="mb-2" />
                                <span className="font-medium text-sm truncate max-w-full px-4">{file.name}</span>
                                <span className="text-xs opacity-70">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                    className="mt-3 text-xs text-red-500 hover:underline"
                                >
                                    Remove file
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center text-gray-500">
                                <Upload size={40} className="mb-2 text-gray-400" />
                                <p className="text-sm font-medium text-gray-700">
                                    {isDragActive ? 'Drop PDF here' : 'Click or Drag PDF here'}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">Max size 50MB</p>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!file || isUploading}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-blue-200"
                        >
                            {isUploading ? 'Uploading...' : 'Upload Revision'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UploadModal;
