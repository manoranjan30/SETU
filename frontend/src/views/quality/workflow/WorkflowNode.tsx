import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  User,
  ShieldCheck,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

const icons = {
  RAISE_RFI: <PlayCircle className="w-5 h-5 text-secondary" />,
  INSPECT: <AlertCircle className="w-5 h-5 text-orange-500" />,
  APPROVE: <CheckCircle2 className="w-5 h-5 text-success" />,
  FINAL_APPROVE: <ShieldCheck className="w-5 h-5 text-purple-600" />,
  WITNESS: <User className="w-5 h-5 text-text-muted" />,
};

const WorkflowNode = ({ id, data, isConnectable, selected }: NodeProps) => {
  const nodeData = data as any;
  return (
    <div
      className={`group px-4 py-3 shadow-md rounded-md bg-surface-card border-2 flex items-center gap-3 transition-colors ${selected ? "border-primary" : "border-border-default"} min-w-[200px] relative`}
    >
      {/* Delete button (only visible if nodeData.canDelete exists and is true) */}
      {nodeData.canDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            nodeData.onDelete?.(id);
          }}
          className="absolute -top-3 -right-3 bg-red-100 hover:bg-error text-error hover:text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all border border-red-200 shadow-sm z-10"
          title="Delete Last Step"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-gray-400"
      />

      <div className="flex-shrink-0">
        {icons[nodeData.stepType as keyof typeof icons] || (
          <User className="text-text-disabled" />
        )}
      </div>

      <div className="flex-1">
        <div className="font-semibold text-sm text-gray-800">
          {nodeData.label || "Approval Step"}
        </div>
        <div className="text-xs text-text-muted font-mono">
          Order: {nodeData.stepOrder || "?"} | Mode: {nodeData.assignmentMode}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-gray-400"
      />
    </div>
  );
};

export default memo(WorkflowNode);
