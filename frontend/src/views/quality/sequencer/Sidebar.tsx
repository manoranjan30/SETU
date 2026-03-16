import React from "react";

export default function Sidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="w-64 bg-surface-card border-r border-border-default p-4 flex flex-col gap-4 z-10 shadow-sm">
      <h2 className="font-bold text-text-secondary mb-2">Toolbox</h2>
      <div className="text-xs text-text-muted mb-4">
        Drag these to the canvas to add steps.
      </div>

      <div
        className="bg-surface-card border-2 border-slate-300 rounded p-3 cursor-grab hover:border-primary hover:shadow-md transition-all flex items-center gap-2"
        onDragStart={(event) => onDragStart(event, "activityNode")}
        draggable
      >
        <div className="w-3 h-3 bg-primary rounded-full"></div>
        <div className="font-medium text-text-secondary">Standard Activity</div>
      </div>

      <div className="mt-auto p-3 bg-primary-muted rounded text-xs text-blue-700 border border-blue-100">
        💡 <strong>Tip:</strong>
        <br />
        Connect output (right) to input (left) to create dependencies.
        <br />
        Click on a connection to toggle between Hard (Red) and Soft (Yellow)
        constraints.
      </div>
    </aside>
  );
}
