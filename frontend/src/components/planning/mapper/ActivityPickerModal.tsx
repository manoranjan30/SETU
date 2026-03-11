import React from "react";
import { X, Check } from "lucide-react";
import ScheduleTreePanel from "./ScheduleTreePanel";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (activityId: number) => void;

  // Pass-through props for ScheduleTreePanel
  activities: any[];
  projectId: number;
}

const ActivityPickerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  activities,
  projectId,
}) => {
  const [selectedActivityId, setSelectedActivityId] = React.useState<
    number | null
  >(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-card rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-surface-base rounded-t-lg">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              Select Target Activity
            </h2>
            <p className="text-sm text-text-muted">
              Pick an activity to link the selected BOQ items to.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full text-text-muted"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body: Schedule Tree */}
        <div className="flex-1 overflow-hidden p-4">
          <ScheduleTreePanel
            activities={activities}
            projectId={projectId}
            selectedActivityId={selectedActivityId}
            onSelectActivity={setSelectedActivityId}
          />
        </div>

        {/* Footer */}
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
            className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2
                            ${
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
