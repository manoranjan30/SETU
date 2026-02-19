import React from 'react';
import { useParams } from 'react-router-dom';
import PendingVendorBoard from '../components/workdoc/PendingVendorBoard';

const VendorMappingPage: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const pid = projectId ? parseInt(projectId, 10) : 0;

    if (!pid) return <div>Invalid Project ID</div>;

    return (
        <div className="h-full p-6">
            <h1 className="text-2xl font-bold mb-4 text-slate-800">Vendor Item Mapping</h1>
            <div className="h-[calc(100vh-140px)]">
                <PendingVendorBoard projectId={pid} />
            </div>
        </div>
    );
};

export default VendorMappingPage;
