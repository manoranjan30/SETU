import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { User, ShieldCheck, PlayCircle, CheckCircle2, AlertCircle } from 'lucide-react';

const icons = {
    RAISE_RFI: <PlayCircle className="w-5 h-5 text-indigo-500" />,
    INSPECT: <AlertCircle className="w-5 h-5 text-orange-500" />,
    APPROVE: <CheckCircle2 className="w-5 h-5 text-green-500" />,
    FINAL_APPROVE: <ShieldCheck className="w-5 h-5 text-purple-600" />,
    WITNESS: <User className="w-5 h-5 text-gray-500" />
};

const WorkflowNode = ({ data, isConnectable, selected }: NodeProps) => {
    const nodeData = data as any;
    return (
        <div className={`px-4 py-3 shadow-md rounded-md bg-white border-2 flex items-center gap-3 transition-colors ${selected ? 'border-primary' : 'border-gray-200'} min-w-[200px]`}>
            <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="w-3 h-3 bg-gray-400" />

            <div className="flex-shrink-0">
                {icons[nodeData.stepType as keyof typeof icons] || <User className="text-gray-400" />}
            </div>

            <div className="flex-1">
                <div className="font-semibold text-sm text-gray-800">{nodeData.label || 'Approval Step'}</div>
                <div className="text-xs text-gray-500 font-mono">
                    Order: {nodeData.stepOrder || '?'} | Mode: {nodeData.assignmentMode}
                </div>
            </div>

            <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="w-3 h-3 bg-gray-400" />
        </div>
    );
};

export default memo(WorkflowNode);
