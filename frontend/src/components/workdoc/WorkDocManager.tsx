
import React, { useState } from 'react';
import VendorList from './VendorList';
import WorkOrderList from './WorkOrderList';

const WorkDocManager: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'orders' | 'vendors'>('orders');

    return (
        <div className="h-full flex flex-col p-4 bg-white shadow rounded-lg overflow-hidden">
            <div className="border-b border-gray-200 mb-4">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`${activeTab === 'orders'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Work Orders
                    </button>
                    <button
                        onClick={() => setActiveTab('vendors')}
                        className={`${activeTab === 'vendors'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Vendors
                    </button>
                </nav>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'orders' ? <WorkOrderList /> : <VendorList />}
            </div>
        </div>
    );
};

export default WorkDocManager;
