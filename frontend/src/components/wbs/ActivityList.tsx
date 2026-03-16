import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import { Plus, Trash2, CheckCircle, Circle, PlayCircle } from "lucide-react";
// clsx removed as unused

interface Activity {
  id: number;
  activityCode: string;
  activityName: string;
  activityType: "TASK" | "MILESTONE";
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  responsibleRoleId?: number;
  responsibleUserId?: number;
  createdOn: string;
}

interface ActivityListProps {
  projectId: number;
  wbsNodeId: number;
}

const ActivityList: React.FC<ActivityListProps> = ({
  projectId,
  wbsNodeId,
}) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // New Activity Form State
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"TASK" | "MILESTONE">("TASK");

  useEffect(() => {
    if (wbsNodeId) fetchActivities();
  }, [wbsNodeId]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/projects/${projectId}/wbs/${wbsNodeId}/activities`,
      );
      setActivities(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newCode || !newName) return;
    try {
      await api.post(`/projects/${projectId}/wbs/${wbsNodeId}/activities`, {
        activityCode: newCode,
        activityName: newName,
        activityType: newType,
      });
      setIsAdding(false);
      setNewCode("");
      setNewName("");
      fetchActivities();
    } catch (err) {
      alert("Failed to create activity");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete activity?")) return;
    try {
      await api.delete(`/projects/${projectId}/wbs/activities/${id}`);
      fetchActivities();
    } catch (err) {
      alert("Failed to delete");
    }
  };

  // Status Icon Helper
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="w-4 h-4 text-success" />;
      case "IN_PROGRESS":
        return <PlayCircle className="w-4 h-4 text-primary" />;
      default:
        return <Circle className="w-4 h-4 text-gray-300" />;
    }
  };

  if (loading)
    return <div className="text-text-muted text-sm">Loading activities...</div>;

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-text-secondary">Activities</h3>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center text-xs bg-primary-muted text-primary px-2 py-1 rounded hover:bg-info-muted"
        >
          <Plus className="w-3 h-3 mr-1" /> Add Activity
        </button>
      </div>

      {isAdding && (
        <div className="bg-surface-base p-3 rounded mb-4 border border-blue-100">
          <div className="grid grid-cols-12 gap-2 text-sm">
            <div className="col-span-2">
              <input
                placeholder="Code (A100)"
                className="w-full border rounded px-2 py-1"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
              />
            </div>
            <div className="col-span-6">
              <input
                placeholder="Activity Name"
                className="w-full border rounded px-2 py-1"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="col-span-3">
              <select
                className="w-full border rounded px-2 py-1"
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
              >
                <option value="TASK">Task</option>
                <option value="MILESTONE">Milestone</option>
              </select>
            </div>
            <div className="col-span-1 flex items-center">
              <button
                onClick={handleCreate}
                className="bg-primary text-white p-1 rounded hover:bg-primary-dark w-full flex justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {activities.length === 0 ? (
          <p className="text-text-disabled text-sm italic">
            No activities added yet.
          </p>
        ) : (
          activities.map((act) => (
            <div
              key={act.id}
              className="flex items-center justify-between border border-border-subtle p-2 rounded hover:bg-surface-base"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(act.status)}
                <span className="font-mono text-xs bg-surface-raised px-1 rounded text-text-secondary">
                  {act.activityCode}
                </span>
                <span className="text-sm text-text-secondary font-medium">
                  {act.activityName}
                </span>
                {act.activityType === "MILESTONE" && (
                  <span className="text-[10px] bg-purple-100 text-purple-700 px-1 rounded uppercase font-bold">
                    Milestone
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDelete(act.id)}
                  className="text-red-400 hover:text-error"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActivityList;
