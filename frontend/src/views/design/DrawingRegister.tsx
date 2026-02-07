
import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import { type ColDef, ModuleRegistry, ClientSideRowModelModule, ValidationModule } from 'ag-grid-community';
import { Upload, Download, FileText, Plus, History, Eye } from 'lucide-react';
import api from '../../api/axios';
import UploadModal from './components/UploadModal';
import CreateDrawingModal from './components/CreateDrawingModal';
import RevisionHistoryModal from './components/RevisionHistoryModal';
import PreviewModal from './components/PreviewModal';

// Register modules
ModuleRegistry.registerModules([ClientSideRowModelModule, ValidationModule]);

interface RegisterItem {
    id: number;
    drawingNumber: string;
    title: string;
    category: {
        id: number;
        name: string;
        code: string;
    };
    status: string;
    currentRevision?: {
        id: number;
        revisionNumber: string;
        uploadedAt: string;
        uploadedBy: {
            id: number;
            username: string;
        };
        fileSize: number;
        originalFileName?: string;
        fileType?: string;
    };
    revisions: any[];
}

const DrawingRegister = () => {
    const { projectId } = useParams();
    const [rowData, setRowData] = useState<RegisterItem[]>([]);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<{ name: string, type: string } | null>(null);

    const fetchData = async () => {
        if (!projectId) return;
        try {
            const response = await api.get(`/design/${projectId}/register`);
            setRowData(response.data);
        } catch (error) {
            console.error('Failed to fetch register:', error);
        }
    };

    useEffect(() => {
        fetchData();
    }, [projectId]);

    const handleUploadClick = (item: any) => {
        let nextRevision = '0';
        if (item.currentRevision) {
            const current = item.currentRevision.revisionNumber;
            if (current === '0') nextRevision = 'A';
            else if (current.match(/^[A-Z]$/)) nextRevision = String.fromCharCode(current.charCodeAt(0) + 1);
            else if (!isNaN(Number(current))) nextRevision = String(Number(current) + 1);
        }

        setSelectedItem({ ...item, nextRevision });
        setIsUploadModalOpen(true);
    };

    const handleUpload = async (file: File, registerId: number, revisionNumber: string, revisionDate: string) => {
        if (!projectId) return;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('registerId', String(registerId));
        formData.append('revisionNumber', revisionNumber);
        formData.append('revisionDate', revisionDate);

        await api.post(`/design/${projectId}/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        // Refresh data
        await fetchData();
    };

    const handleDownload = async (revisionId: number, filename: string) => {
        if (!projectId) return;
        try {
            const response = await api.get(`/design/${projectId}/download/${revisionId}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Download failed", e);
            alert("Failed to download file");
        }
    };

    const handlePreview = async (revisionId: number, filename: string, fileType: string) => {
        if (!projectId) return;
        try {
            const response = await api.get(`/design/${projectId}/download/${revisionId}`, {
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { type: fileType || 'application/pdf' }); // Fallback to PDF if unknown, though risky
            const url = window.URL.createObjectURL(blob);

            setPreviewUrl(url);
            setPreviewFile({ name: filename, type: fileType });
            setIsPreviewModalOpen(true);
        } catch (e) {
            console.error("Preview failed", e);
            alert("Failed to load preview");
        }
    }

    const handleDelete = async (item: any) => {
        if (!projectId) return;
        if (!confirm(`Are you sure you want to delete ${item.drawingNumber}? This will strictly delete the file also from the system.`)) return;

        try {
            await api.delete(`/design/${projectId}/register/${item.id}`);
            await fetchData();
        } catch (e) {
            console.error("Delete failed", e);
            alert("Failed to delete record");
        }
    };

    const colDefs: ColDef<RegisterItem>[] = useMemo(() => [
        {
            field: 'category.name',
            headerName: 'Category',
            width: 150,
            rowGroup: false,
            enableRowGroup: false
        },
        { field: 'drawingNumber', headerName: 'Drawing No', width: 140, sortable: true, filter: true, pinned: 'left' },
        { field: 'title', headerName: 'Title', flex: 1, minWidth: 200 },
        {
            field: 'currentRevision.revisionNumber',
            headerName: 'Rev',
            width: 80,
            cellRenderer: (params: any) => {
                if (!params.value) return <span className="text-gray-400">-</span>;
                return <span className="font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">{params.value}</span>;
            }
        },
        {
            field: 'status',
            headerName: 'Status',
            width: 120,
            cellRenderer: (params: any) => {
                const status = params.value;
                let color = 'text-gray-500 bg-gray-100';
                if (status === 'GFC') color = 'text-green-600 bg-green-100';
                if (status === 'IN_PROGRESS') color = 'text-blue-600 bg-blue-100';
                return <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>{status}</span>;
            }
        },
        {
            field: 'currentRevision.uploadedAt',
            headerName: 'Date',
            width: 120,
            valueFormatter: (params: any) => params.value ? new Date(params.value).toLocaleDateString() : '-'
        },
        {
            headerName: 'Actions',
            width: 260,
            pinned: 'right',
            cellRenderer: (params: any) => {
                const item = params.data;
                if (!item) return null;
                return (
                    <div className="flex gap-2">
                        {item.currentRevision && (
                            <button
                                onClick={() => handlePreview(item.currentRevision.id, item.currentRevision.originalFileName || 'drawing', item.currentRevision.fileType)}
                                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                title="Preview"
                            >
                                <Eye size={16} />
                            </button>
                        )}
                        <button
                            onClick={() => handleUploadClick(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Upload New Revision"
                        >
                            <Upload size={16} />
                        </button>
                        {item.currentRevision && (
                            <button
                                onClick={() => handleDownload(item.currentRevision.id, item.currentRevision.originalFileName || 'drawing.pdf')}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Download Latest"
                            >
                                <Download size={16} />
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setSelectedItem(item);
                                setIsHistoryModalOpen(true);
                            }}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                            title="View History"
                        >
                            <History size={16} />
                        </button>
                        <button
                            onClick={() => {
                                setSelectedItem(item);
                                setIsCreateModalOpen(true);
                            }}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors"
                            title="Edit Details"
                        >
                            <FileText size={16} />
                        </button>
                        <button
                            onClick={() => handleDelete(item)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                        >
                            <Plus size={16} className="rotate-45" />
                        </button>
                    </div>
                );
            }
        }
    ], [projectId]);

    return (
        <div className="h-full flex flex-col bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <FileText size={20} className="text-blue-600" />
                    Drawing Register
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            setSelectedItem(null);
                            setIsCreateModalOpen(true);
                        }}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                    >
                        <Plus size={16} />
                        Add Drawing
                    </button>
                    <button
                        onClick={() => fetchData()}
                        className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            <div className="flex-1 ag-theme-alpine" style={{ width: '100%' }}>
                <AgGridReact
                    rowData={rowData}
                    columnDefs={colDefs}
                    defaultColDef={{
                        sortable: true,
                        filter: true,
                        resizable: true,
                        flex: 0
                    }}
                    rowHeight={48}
                    headerHeight={48}
                    animateRows={true}
                    loadingOverlayComponent={() => <div className="text-gray-500">Loading drawings...</div>}
                />
            </div>

            <UploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onUpload={handleUpload}
                registerItem={selectedItem}
            />

            <CreateDrawingModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={fetchData}
                projectId={projectId || ''}
                initialData={selectedItem}
            />

            <RevisionHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                registerItem={selectedItem}
                projectId={projectId || ''}
                onDownload={handleDownload}
            />

            <PreviewModal
                isOpen={isPreviewModalOpen}
                onClose={() => {
                    setIsPreviewModalOpen(false);
                    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                }}
                fileUrl={previewUrl}
                fileName={previewFile?.name || ''}
                fileType={previewFile?.type || ''}
            />
        </div>
    );
};

export default DrawingRegister;
