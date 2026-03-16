import React, { useState, useEffect } from "react";
import planningService, {
  type PlanningActivity,
} from "../../services/planning.service";
import microScheduleService, {
  type CreateMicroScheduleDto,
  type MicroSchedule,
} from "../../services/micro-schedule.service";
import {
  Save,
  RefreshCw,
  Calendar,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import ActivitySearchDropdown from "./ActivitySearchDropdown";

interface MicroScheduleFormProps {
  projectId: number;
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: MicroSchedule | null;
}

const MicroScheduleForm: React.FC<MicroScheduleFormProps> = ({
  projectId,
  onSuccess,
  onCancel,
  initialData,
}) => {
  const [activities, setActivities] = useState<PlanningActivity[]>([]);
  const [wbsNodes, setWbsNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedParentActivity, setSelectedParentActivity] =
    useState<PlanningActivity | null>(null);
  const [showActivityDetails, setShowActivityDetails] = useState(false);

  const [formData, setFormData] = useState<Partial<CreateMicroScheduleDto>>({
    projectId,
    name: "",
    description: "",
    parentActivityId: undefined,
    linkedActivityIds: [],
    baselineStart: "",
    baselineFinish: "",
    plannedStart: "",
    plannedFinish: "",
  });

  useEffect(() => {
    if (projectId) {
      console.log("Fetching activities for project:", projectId);
      fetchActivities();
    }
  }, [projectId]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        projectId: initialData.projectId,
        name: initialData.name,
        description: initialData.description,
        parentActivityId: initialData.parentActivityId,
        linkedActivityIds:
          initialData.activities?.map((a) => a.parentActivityId) || [],
        baselineStart: initialData.baselineStart
          ? initialData.baselineStart.split("T")[0]
          : "",
        baselineFinish: initialData.baselineFinish
          ? initialData.baselineFinish.split("T")[0]
          : "",
        plannedStart: initialData.plannedStart
          ? initialData.plannedStart.split("T")[0]
          : "",
        plannedFinish: initialData.plannedFinish
          ? initialData.plannedFinish.split("T")[0]
          : "",
      });

      if (initialData.parentActivityId) {
        const parent = activities.find(
          (a) => a.id === initialData.parentActivityId,
        );
        if (parent) setSelectedParentActivity(parent);
      }
    }
  }, [initialData, activities]);

  const fetchActivities = async () => {
    try {
      setLoadingActivities(true);
      setError(null);

      console.log(
        "📊 [Micro Schedule] Fetching activities for project:",
        projectId,
      );

      const [acts, nodes] = await Promise.all([
        planningService.getProjectActivities(projectId),
        planningService.getWbsNodes(projectId),
      ]);

      console.log("✅ [Micro Schedule] Fetched activities:", acts);
      console.log("✅ [Micro Schedule] Activity count:", acts?.length || 0);
      console.log("✅ [Micro Schedule] Fetched WBS nodes:", nodes);
      console.log("✅ [Micro Schedule] WBS count:", nodes?.length || 0);

      // Detailed validation
      if (!acts || acts.length === 0) {
        console.warn("⚠️ [Micro Schedule] No activities found in database");
        setError(
          `No schedule activities found for Project ${projectId}. Please import a project schedule first from the Schedule page.`,
        );
        setActivities([]);
        setWbsNodes(nodes || []);
      } else if (!nodes || nodes.length === 0) {
        console.warn("⚠️ [Micro Schedule] No WBS nodes found in database");
        setError(
          `No WBS structure found for Project ${projectId}. Please ensure your schedule includes WBS information.`,
        );
        setActivities(acts || []);
        setWbsNodes([]);
      } else {
        console.log("✅ [Micro Schedule] Data loaded successfully");
        setActivities(acts);
        setWbsNodes(nodes);
      }
    } catch (error: any) {
      console.error("❌ [Micro Schedule] Error fetching planning data:", error);
      console.error(
        "❌ [Micro Schedule] Error details:",
        error.response?.data || error.message,
      );
      setError(
        `Failed to load schedule data: ${error.response?.data?.message || error.message || "Unknown error"}`,
      );
      setActivities([]);
      setWbsNodes([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleParentActivitySelect = (
    activityId: number,
    activity: PlanningActivity,
  ) => {
    console.log("Selected activity:", activity);
    setSelectedParentActivity(activity);

    // Auto-populate form data
    const startDate = activity.startDatePlanned
      ? String(activity.startDatePlanned).split("T")[0]
      : "";
    const finishDate = activity.finishDatePlanned
      ? String(activity.finishDatePlanned).split("T")[0]
      : "";

    setFormData((prev) => ({
      ...prev,
      parentActivityId: activityId,
      linkedActivityIds: [activityId],
      name: prev.name || `Micro Schedule: ${activity.activityName}`,
      baselineStart: startDate,
      baselineFinish: finishDate,
      plannedStart: startDate,
      plannedFinish: finishDate,
    }));

    setShowActivityDetails(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.parentActivityId) {
      alert("Please select a parent schedule activity first.");
      return;
    }

    try {
      setLoading(true);
      const dto = formData as CreateMicroScheduleDto;

      if (initialData) {
        await microScheduleService.updateMicroSchedule(
          initialData.id,
          formData,
        );
      } else {
        await microScheduleService.createMicroSchedule(dto);
      }
      onSuccess();
    } catch (error) {
      console.error("Error saving micro schedule:", error);
      alert("Failed to save micro schedule. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* STEP 1: Parent Activity Selection - MANDATORY FIRST */}
      <div className="bg-primary-muted border-2 border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">
            1
          </div>
          <div className="flex-1">
            <label className="block text-sm font-bold text-blue-900 mb-2">
              Select Parent Schedule Activity{" "}
              <span className="text-error">*</span>
            </label>
            <p className="text-xs text-blue-700 mb-3">
              Choose the master schedule activity you want to break down into
              micro-level tasks
            </p>

            {loadingActivities ? (
              <div className="h-12 flex items-center justify-center bg-surface-card border rounded text-text-disabled text-sm">
                <RefreshCw size={16} className="animate-spin mr-2" />
                Loading schedule activities...
              </div>
            ) : error ? (
              <div className="bg-error-muted border border-red-200 rounded p-3 text-error text-sm">
                <div className="font-semibold mb-1">{error}</div>
                <button
                  type="button"
                  onClick={fetchActivities}
                  className="text-xs text-primary hover:text-blue-800 underline flex items-center gap-1 mt-2"
                >
                  <RefreshCw size={12} /> Retry Loading
                </button>
              </div>
            ) : (
              <ActivitySearchDropdown
                activities={activities}
                wbsNodes={wbsNodes}
                selectedActivityId={formData.parentActivityId}
                onSelect={handleParentActivitySelect}
                placeholder="-- Search or Select Schedule Activity --"
              />
            )}
          </div>
        </div>
      </div>

      {/* Show Activity Summary Card */}
      {selectedParentActivity && (
        <div className="bg-surface-base border border-border-default rounded-lg p-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-text-secondary">
              Selected Activity Summary
            </h3>
            <button
              type="button"
              onClick={() => setShowActivityDetails(!showActivityDetails)}
              className="text-xs text-primary hover:text-blue-800 flex items-center gap-1"
            >
              {showActivityDetails ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
              {showActivityDetails ? "Hide" : "Show"} Details
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-surface-card p-3 rounded border">
              <div className="text-xs text-text-muted uppercase font-bold mb-1">
                Activity Code
              </div>
              <div className="text-sm font-medium text-text-primary">
                {selectedParentActivity.activityCode}
              </div>
            </div>
            <div className="bg-surface-card p-3 rounded border">
              <div className="text-xs text-text-muted uppercase font-bold mb-1">
                Activity Name
              </div>
              <div className="text-sm font-medium text-text-primary">
                {selectedParentActivity.activityName}
              </div>
            </div>
            <div className="bg-surface-card p-3 rounded border">
              <div className="text-xs text-text-muted uppercase font-bold mb-1 flex items-center gap-1">
                <Calendar size={12} /> Duration
              </div>
              <div className="text-sm font-medium text-text-primary">
                {selectedParentActivity.startDatePlanned &&
                selectedParentActivity.finishDatePlanned
                  ? `${new Date(selectedParentActivity.startDatePlanned).toLocaleDateString()} - ${new Date(selectedParentActivity.finishDatePlanned).toLocaleDateString()}`
                  : "Not set"}
              </div>
            </div>
          </div>

          {showActivityDetails &&
            selectedParentActivity.boqItems &&
            selectedParentActivity.boqItems.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <div className="text-xs text-text-muted uppercase font-bold mb-2">
                  Linked BOQ Items
                </div>
                <div className="space-y-1">
                  {selectedParentActivity.boqItems.map((item: any) => (
                    <div
                      key={item.id}
                      className="text-xs bg-surface-card px-2 py-1 rounded border"
                    >
                      [{item.boqCode}] {item.description} - {item.qty}{" "}
                      {item.uom}
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {/* STEP 2: Micro Schedule Details - Progressive Disclosure */}
      {selectedParentActivity && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
              2
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-text-secondary mb-3">
                Micro Schedule Details
              </h3>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Micro Schedule Name <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-border-strong rounded-md focus:ring-primary focus:border-primary"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., First Floor Slab - Week 1 Breakdown"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Description
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-border-strong rounded-md focus:ring-primary focus:border-primary"
                    rows={2}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Describe the detailed breakdown scope..."
                  />
                </div>

                {/* Dates Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border p-4 rounded-md bg-surface-base">
                    <h4 className="text-xs font-bold text-text-muted mb-3 uppercase tracking-wider">
                      Baseline (From Parent)
                    </h4>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">
                          Start Date
                        </label>
                        <input
                          type="date"
                          className="w-full px-3 py-2 border border-border-strong rounded-md bg-surface-card text-text-muted cursor-not-allowed text-sm"
                          value={formData.baselineStart}
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">
                          Finish Date
                        </label>
                        <input
                          type="date"
                          className="w-full px-3 py-2 border border-border-strong rounded-md bg-surface-card text-text-muted cursor-not-allowed text-sm"
                          value={formData.baselineFinish}
                          readOnly
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border p-4 rounded-md bg-primary-muted border-blue-100">
                    <h4 className="text-xs font-bold text-blue-800 mb-3 uppercase tracking-wider">
                      Planned Window *
                    </h4>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-primary mb-1">
                          Start Date
                        </label>
                        <input
                          type="date"
                          required
                          className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-primary focus:border-primary text-sm"
                          value={formData.plannedStart}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              plannedStart: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-primary mb-1">
                          Finish Date
                        </label>
                        <input
                          type="date"
                          required
                          className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-primary focus:border-primary text-sm"
                          value={formData.plannedFinish}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              plannedFinish: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Box */}
                <div className="bg-warning-muted border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle
                    size={16}
                    className="text-yellow-600 flex-shrink-0 mt-0.5"
                  />
                  <div className="text-xs text-yellow-800">
                    <strong>Next Step:</strong> After creating this micro
                    schedule, you'll be able to add detailed micro activities
                    with BOQ quantity allocation and location mapping. Each
                    micro activity MUST be linked to a BOQ item for quantity
                    tracking.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-6 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface-card border border-border-strong rounded-md hover:bg-surface-base"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !selectedParentActivity}
          className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            !selectedParentActivity
              ? "Please select a parent activity first"
              : ""
          }
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <Save size={18} />
          )}
          {initialData ? "Update Schedule" : "Create Micro Schedule"}
        </button>
      </div>
    </form>
  );
};

export default MicroScheduleForm;
