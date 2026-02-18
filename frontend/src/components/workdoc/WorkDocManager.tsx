import React, { useState } from 'react';
import clsx from 'clsx';
import VendorList from './VendorList';
import WorkOrderList from './WorkOrderList';
import WorkDocTemplateList from './WorkDocTemplateList';
import GlobalMappingBoard from './GlobalMappingBoard';

interface Props {
    projectId: number;
}

const WorkDocManager: React.FC<Props> = ({ projectId }) => {
    const [activeTab, setActiveTab] = useState<'orders' | 'vendors' | 'templates' | 'onboarding'>('orders');

    return (
        <div className="h-full flex flex-col bg-white shadow rounded-lg overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-8 py-4 flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Contract Management</h2>
                <nav className="flex bg-slate-200 p-1 rounded-xl border border-slate-300 shadow-inner" aria-label="Tabs">
                    {[
                        { id: 'orders', label: 'Work Orders' },
                        { id: 'vendors', label: 'Vendors' },
                        { id: 'onboarding', label: 'Vendor Onboarding' },
                        { id: 'templates', label: 'Parsing Templates' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={clsx(
                                "whitespace-nowrap py-2 px-6 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all",
                                activeTab === tab.id
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="flex-1 overflow-auto relative bg-white">
                {activeTab === 'orders' && <WorkOrderList />}
                {activeTab === 'vendors' && <VendorList />}
                {activeTab === 'templates' && <WorkDocTemplateList />}
                {activeTab === 'onboarding' && <GlobalMappingBoard projectId={projectId} />}
            </div>
        </div>
    );
};

export default WorkDocManager;
