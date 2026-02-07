import React from 'react';
import { Calendar, Table, CheckSquare, Layers, Split, FileText } from 'lucide-react';
import { clsx } from 'clsx';

interface PlanningDashboardProps {
    children: React.ReactNode;
    currentView: string;
    onViewChange: (view: string) => void;
}

const PlanningDashboard: React.FC<PlanningDashboardProps> = ({ children, currentView, onViewChange }) => {
    const menuItems = [
        {
            key: 'schedule',
            icon: <Calendar size={18} />,
            label: 'Master Schedule',
        },
        {
            key: 'matrix',
            icon: <Layers size={18} />,
            label: 'Schedule Mapper',
        },
        {
            key: 'mapper',
            icon: <Split size={18} />,
            label: 'Qty Mapper',
        },
        {
            key: 'contracts',
            icon: <FileText size={18} />,
            label: 'Contracts (WO)',
        },
        {
            key: 'schedules', // New Item
            icon: <Layers size={18} />,
            label: 'Working Schedules',
        },

        {
            key: 'lookahead',
            icon: <Table size={18} />,
            label: 'Lookahead Plan',
        },
        {
            key: 'recovery',
            icon: <CheckSquare size={18} />,
            label: 'Recovery Plans',
        },
    ];

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-[2px_0_5px_rgba(0,0,0,0.02)] z-10">
                <div className="p-4 border-b border-gray-100 flex-shrink-0">
                    <h2 className="text-lg font-semibold text-gray-800">Planning Domain</h2>
                    <p className="text-xs text-gray-500">Make schedules intelligent</p>
                </div>
                <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin">
                    <ul className="space-y-1">
                        {menuItems.map((item) => (
                            <li key={item.key}>
                                <button
                                    onClick={() => onViewChange(item.key)}
                                    className={clsx(
                                        "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                                        currentView === item.key
                                            ? "bg-blue-50 text-blue-700"
                                            : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                    )}
                                >
                                    {item.icon}
                                    {item.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>
            </div>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {['schedule', 'mapper', 'matrix', 'schedules', 'gantt_version', 'lookahead'].includes(currentView) ? (
                    children
                ) : (
                    <div className="flex-1 overflow-auto p-6">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 min-h-[400px] p-6">
                            {children}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default PlanningDashboard;
