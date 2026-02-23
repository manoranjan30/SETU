import React from 'react';

export default function Sidebar() {
    const onDragStart = (event: React.DragEvent, nodeType: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <aside className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col gap-4 z-10 shadow-sm">
            <h2 className="font-bold text-slate-700 mb-2">Toolbox</h2>
            <div className="text-xs text-slate-500 mb-4">
                Drag these to the canvas to add steps.
            </div>

            <div
                className="bg-white border-2 border-slate-300 rounded p-3 cursor-grab hover:border-blue-500 hover:shadow-md transition-all flex items-center gap-2"
                onDragStart={(event) => onDragStart(event, 'activityNode')}
                draggable
            >
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <div className="font-medium text-slate-700">Standard Activity</div>
            </div>

            <div className="mt-auto p-3 bg-blue-50 rounded text-xs text-blue-700 border border-blue-100">
                💡 <strong>Tip:</strong><br />
                Connect output (right) to input (left) to create dependencies.<br />
                Click on a connection to toggle between Hard (Red) and Soft (Yellow) constraints.
            </div>
        </aside>
    );
}
