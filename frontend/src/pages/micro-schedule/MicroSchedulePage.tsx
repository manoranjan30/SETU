import React, { useState } from "react";
import { useParams } from "react-router-dom";
import MicroScheduleList from "../../components/micro-schedule/MicroScheduleList";
import MicroScheduleForm from "../../components/micro-schedule/MicroScheduleForm";
import MicroActivityBreakdown from "../../components/micro-schedule/MicroActivityBreakdown";
import type { MicroSchedule } from "../../services/micro-schedule.service";
import { ArrowLeft } from "lucide-react";

const MicroSchedulePage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const pId = parseInt(projectId || "0");

  // View state: 'list', 'create', 'details'
  const [view, setView] = useState<"list" | "create" | "details">("list");
  const [selectedSchedule, setSelectedSchedule] =
    useState<MicroSchedule | null>(null);

  const handleCreate = () => {
    setSelectedSchedule(null);
    setView("create");
  };

  const handleEdit = (schedule: MicroSchedule) => {
    setSelectedSchedule(schedule);
    setView("create"); // Reuse create for edit
  };

  const handleView = (schedule: MicroSchedule) => {
    setSelectedSchedule(schedule);
    setView("details");
  };

  const handleBack = () => {
    setView("list");
    setSelectedSchedule(null);
  };

  if (view === "create") {
    return (
      <div className="flex flex-col h-full bg-surface-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={handleBack}
            className="p-1 hover:bg-surface-raised rounded-full"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-semibold">
            {selectedSchedule ? "Edit Micro Schedule" : "Create Micro Schedule"}
          </h2>
        </div>
        <div className="flex-1 overflow-auto">
          <MicroScheduleForm
            projectId={pId}
            initialData={selectedSchedule}
            onSuccess={handleBack}
            onCancel={handleBack}
          />
        </div>
      </div>
    );
  }

  if (view === "details") {
    return (
      <div className="flex flex-col h-full bg-surface-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <button
            onClick={handleBack}
            className="p-1 hover:bg-surface-raised rounded-full"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-semibold">{selectedSchedule?.name}</h2>
            <span className="text-xs text-text-muted uppercase font-bold tracking-wider">
              Project ID: {pId} • Base Activity:{" "}
              {selectedSchedule?.parentActivityId}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <MicroActivityBreakdown
            scheduleId={selectedSchedule?.id || 0}
            projectId={pId}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-surface-base">
      <MicroScheduleList
        projectId={pId}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onView={handleView}
      />
    </div>
  );
};

export default MicroSchedulePage;
