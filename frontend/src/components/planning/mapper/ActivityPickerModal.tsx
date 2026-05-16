import React from "react";
import { X, Check, Maximize2, Minimize2 } from "lucide-react";
import ScheduleTreePanel from "./ScheduleTreePanel";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (activityId: number) => void;
  activities: any[];
  projectId: number;
  selectedWoItems?: Array<{
    workOrderItemId: number;
    description: string;
    materialCode?: string;
    linkedActivities?: string;
    treeContext?: string;
    boqPath?: string;
    fullContext?: string;
  }>;
}

const ActivityPickerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  activities,
  projectId,
  selectedWoItems = [],
}) => {
  const [selectedActivityId, setSelectedActivityId] = React.useState<
    number | null
  >(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      setIsFullscreen(false);
      setSelectedActivityId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div
        className={`bg-surface-card rounded-lg shadow-xl flex flex-col ${
          isFullscreen
            ? "w-[96vw] h-[94vh] max-w-none"
            : "w-full max-w-4xl h-[80vh]"
        }`}
      >
        <div className="p-4 border-b flex justify-between items-center bg-surface-base rounded-t-lg">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              Select Target Activity
            </h2>
            <p className="text-sm text-text-muted">
              Manual tree-based mapping for the selected WO items.
            </p>
            {selectedWoItems.length > 0 && (
              <p className="mt-1 text-xs text-text-disabled">
                Smart suggestions are intentionally hidden here so you can validate and map directly from the schedule tree.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-2 hover:bg-gray-200 rounded-full text-text-muted"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full text-text-muted"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="w-96 min-h-0 border-r bg-surface-base p-4 flex flex-col">
            <div className="rounded-xl border border-border-default bg-surface-card p-3">
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-disabled">
                Selected WO Items
              </div>
              <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1 text-xs">
                {selectedWoItems.map((item) => (
                  <div
                    key={item.workOrderItemId}
                    className="rounded-lg bg-surface-base px-2 py-2"
                  >
                    <div className="font-semibold text-slate-800">
                      {item.description}
                    </div>
                    {item.boqPath && (
                      <div className="mt-1 text-text-muted">
                        BOQ: {item.boqPath}
                      </div>
                    )}
                    {item.treeContext && (
                      <div className="mt-1 text-[10px] text-text-disabled">
                        WO: {item.treeContext}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden p-4">
            <ScheduleTreePanel
              activities={activities}
              projectId={projectId}
              selectedActivityId={selectedActivityId}
              onSelectActivity={setSelectedActivityId}
              suggestedActivityIds={[]}
            />
          </div>
        </div>

        <div className="p-4 border-t bg-surface-base flex justify-end gap-3 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-secondary hover:bg-surface-raised rounded text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => selectedActivityId && onConfirm(selectedActivityId)}
            disabled={!selectedActivityId}
            className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2 ${
              selectedActivityId
                ? "bg-primary text-white hover:bg-primary-dark shadow-sm"
                : "bg-gray-300 text-text-muted cursor-not-allowed"
            }`}
          >
            <Check size={16} />
            Link Selected Items
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActivityPickerModal;
