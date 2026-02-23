import { Handle, Position, type NodeProps } from '@xyflow/react';

interface ActivityNodeData extends Record<string, unknown> {
    label: string;
    description?: string;
    sequence: number;
}

export function QualityActivityNode({ data }: NodeProps<any>) { // Using any broadly or defining specific Node type
    const activityData = data as ActivityNodeData;

    return (
        <div className="bg-white border-2 border-slate-200 rounded-lg shadow-sm p-3 w-64 hover:border-blue-400 transition-colors">
            <Handle
                type="target"
                position={Position.Left}
                className="!bg-slate-400 !w-3 !h-3"
            />

            <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-sm truncate" title={activityData.label}>
                        {activityData.label}
                    </span>
                    <span className="text-xs font-mono bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                        #{activityData.sequence}
                    </span>
                </div>

                {activityData.description && (
                    <div className="text-xs text-slate-500 line-clamp-2" title={activityData.description}>
                        {activityData.description}
                    </div>
                )}
            </div>

            <Handle
                type="source"
                position={Position.Right}
                className="!bg-blue-500 !w-3 !h-3"
            />
        </div>
    );
}
