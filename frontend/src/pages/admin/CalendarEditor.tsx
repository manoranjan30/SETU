import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Plus, X } from "lucide-react";
import api from "../../api/axios";

interface WorkWeek {
  id?: number;
  name: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  workingDays: string[];
}

interface WorkCalendar {
  id?: number;
  name: string;
  description: string;
  isDefault: boolean;
  dailyWorkHours: number;
  workingDays: string[];
  holidays: string[];
  workWeeks: WorkWeek[];
}

const DAYS_OF_WEEK = [
  { id: 1, label: "Monday" },
  { id: 2, label: "Tuesday" },
  { id: 3, label: "Wednesday" },
  { id: 4, label: "Thursday" },
  { id: 5, label: "Friday" },
  { id: 6, label: "Saturday" },
  { id: 0, label: "Sunday" },
];

const CalendarEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [formData, setFormData] = useState<WorkCalendar>({
    name: "",
    description: "",
    isDefault: false,
    dailyWorkHours: 8,
    workingDays: ["1", "2", "3", "4", "5"],
    holidays: [],
    workWeeks: [],
  });

  // Work Week Editor State
  const [isWorkWeekModalOpen, setIsWorkWeekModalOpen] = useState(false);
  const [currentWorkWeek, setCurrentWorkWeek] = useState<WorkWeek>({
    name: "",
    fromDate: "",
    toDate: "",
    workingDays: ["1", "2", "3", "4", "5"],
  });
  const [editingWorkWeekIndex, setEditingWorkWeekIndex] = useState<
    number | null
  >(null);

  const [newHoliday, setNewHoliday] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);

  useEffect(() => {
    if (isEdit) {
      fetchCalendar();
    }
  }, [id]);

  const fetchCalendar = async () => {
    try {
      const res = await api.get(`/calendars/${id}`);
      const data = res.data;
      // Ensure array types
      setFormData({
        ...data,
        workingDays: Array.isArray(data.workingDays)
          ? data.workingDays
          : (data.workingDays || "").split(","),
        holidays: Array.isArray(data.holidays)
          ? data.holidays
          : (data.holidays || "").split(",").filter((x: string) => x),
      });
    } catch (error) {
      console.error("Failed to fetch calendar", error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = isEdit ? `calendars/${id}` : "calendars";
      const method = isEdit ? "put" : "post";

      // api[method] (post or put)
      await api[method](url, formData);

      navigate("/dashboard/calendars");
    } catch (error) {
      console.error("Save failed", error);
      alert("Failed to save calendar");
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (dayId: number) => {
    const strId = dayId.toString();
    setFormData((prev) => {
      const exists = prev.workingDays.includes(strId);
      return {
        ...prev,
        workingDays: exists
          ? prev.workingDays.filter((d) => d !== strId)
          : [...prev.workingDays, strId],
      };
    });
  };

  const addHoliday = () => {
    if (!newHoliday) return;
    if (formData.holidays.includes(newHoliday)) return;
    setFormData((prev) => ({
      ...prev,
      holidays: [...prev.holidays, newHoliday].sort(),
    }));
    setNewHoliday("");
  };

  const removeHoliday = (date: string) => {
    setFormData((prev) => ({
      ...prev,
      holidays: prev.holidays.filter((h) => h !== date),
    }));
  };

  if (initialLoading)
    return (
      <div className="p-8 text-center text-text-muted">Loading editor...</div>
    );

  return (
    <div className="h-[calc(100vh-64px)] overflow-auto bg-surface-base flex flex-col items-center py-8">
      <div className="w-full max-w-3xl px-4">
        <button
          onClick={() => navigate("/dashboard/calendars")}
          className="flex items-center gap-2 text-text-muted hover:text-text-secondary mb-6 transition-colors"
        >
          <ArrowLeft size={18} /> Back to Calendars
        </button>

        <div className="bg-surface-card rounded-xl shadow-lg border border-border-subtle overflow-hidden">
          <div className="border-b border-border-subtle bg-surface-base/50 px-8 py-5 flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-800">
              {isEdit ? "Edit Calendar" : "New Calendar"}
            </h1>
          </div>

          <form onSubmit={handleSave} className="p-8 space-y-8">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-secondary">
                  Calendar Name
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-border-strong rounded-md focus:ring-2 focus:ring-secondary focus:border-secondary transition-all outline-none"
                  placeholder="e.g. India Standard"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-secondary">
                  Daily Work Hours
                </label>
                <input
                  type="number"
                  step="0.5"
                  required
                  className="w-full px-3 py-2 border border-border-strong rounded-md focus:ring-2 focus:ring-secondary focus:border-secondary transition-all outline-none"
                  value={formData.dailyWorkHours}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dailyWorkHours: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary">
                Description
              </label>
              <textarea
                className="w-full px-3 py-2 border border-border-strong rounded-md focus:ring-2 focus:ring-secondary focus:border-secondary transition-all outline-none"
                rows={2}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            <div className="flex items-center gap-3 bg-primary-muted p-4 rounded-lg border border-blue-100 text-blue-800">
              <input
                type="checkbox"
                id="isDefault"
                className="w-4 h-4 text-primary rounded focus:ring-primary cursor-pointer"
                checked={formData.isDefault}
                onChange={(e) =>
                  setFormData({ ...formData, isDefault: e.target.checked })
                }
              />
              <label
                htmlFor="isDefault"
                className="text-sm font-medium cursor-pointer select-none"
              >
                Set as System Default Calendar
              </label>
            </div>

            {/* Working Days */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-text-secondary">
                Working Days
              </label>
              <div className="flex flex-wrap gap-3">
                {DAYS_OF_WEEK.map((day) => {
                  const isSelected = formData.workingDays.includes(
                    day.id.toString(),
                  );
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleDay(day.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        isSelected
                          ? "bg-secondary text-white shadow-md shadow-indigo-200"
                          : "bg-surface-raised text-text-muted hover:bg-gray-200"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Holidays */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-text-secondary">
                Non-Working Days (Holidays)
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 px-3 py-2 border border-border-strong rounded-md focus:ring-2 focus:ring-secondary outline-none"
                  value={newHoliday}
                  onChange={(e) => setNewHoliday(e.target.value)}
                />
                <button
                  type="button"
                  onClick={addHoliday}
                  className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
                >
                  <Plus size={16} /> Add
                </button>
              </div>

              {formData.holidays.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 max-h-40 overflow-auto p-2 border border-border-subtle rounded-lg bg-surface-base">
                  {formData.holidays.map((date) => (
                    <span
                      key={date}
                      className="inline-flex items-center gap-2 bg-surface-card border border-border-default px-3 py-1.5 rounded-full text-sm text-text-secondary shadow-sm"
                    >
                      {date}
                      <button
                        type="button"
                        onClick={() => removeHoliday(date)}
                        className="text-text-disabled hover:text-error transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* WORK WEEKS SECTION */}
            <div className="space-y-4 pt-6 border-t border-border-subtle">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium text-gray-800">
                    Work Weeks (Exceptions)
                  </h3>
                  <p className="text-sm text-text-muted">
                    Define specific working days for date ranges.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentWorkWeek({
                      name: "",
                      fromDate: "",
                      toDate: "",
                      workingDays: ["1", "2", "3", "4", "5"],
                    });
                    setEditingWorkWeekIndex(null);
                    setIsWorkWeekModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-secondary-muted text-indigo-700 hover:bg-indigo-100 rounded text-sm font-medium"
                >
                  + Add Work Week
                </button>
              </div>

              <div className="space-y-2">
                {formData.workWeeks?.length === 0 && (
                  <div className="text-sm text-text-disabled italic">
                    No custom work weeks defined.
                  </div>
                )}
                {formData.workWeeks?.map((ww, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-3 border border-border-default rounded-lg bg-surface-base"
                  >
                    <div>
                      <div className="font-medium text-gray-800">{ww.name}</div>
                      <div className="text-xs text-text-muted">
                        {ww.fromDate} — {ww.toDate} • Days:{" "}
                        {ww.workingDays
                          .map((d) =>
                            DAYS_OF_WEEK.find(
                              (x) => x.id.toString() === d,
                            )?.label.substring(0, 3),
                          )
                          .join(", ")}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentWorkWeek(ww);
                          setEditingWorkWeekIndex(idx);
                          setIsWorkWeekModalOpen(true);
                        }}
                        className="text-primary hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newWW = [...(formData.workWeeks || [])];
                          newWW.splice(idx, 1);
                          setFormData({ ...formData, workWeeks: newWW });
                        }}
                        className="text-error hover:text-red-700 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="pt-6 border-t border-border-subtle flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-secondary hover:bg-secondary-dark text-white px-6 py-2.5 rounded-md font-medium transition-colors shadow-lg shadow-indigo-100 disabled:opacity-50"
              >
                <Save size={18} />
                {loading ? "Saving..." : "Save Calendar"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* WORK WEEK MODAL */}
      {isWorkWeekModalOpen && (
        <div className="fixed inset-0 bg-surface-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-surface-card rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold">Edit Work Week</h3>
              <button onClick={() => setIsWorkWeekModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  Name
                </label>
                <input
                  className="w-full border p-2 rounded"
                  value={currentWorkWeek.name}
                  onChange={(e) =>
                    setCurrentWorkWeek({
                      ...currentWorkWeek,
                      name: e.target.value,
                    })
                  }
                  placeholder="e.g. Summer Schedule"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    From Date
                  </label>
                  <input
                    type="date"
                    className="w-full border p-2 rounded"
                    value={currentWorkWeek.fromDate}
                    onChange={(e) =>
                      setCurrentWorkWeek({
                        ...currentWorkWeek,
                        fromDate: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    To Date
                  </label>
                  <input
                    type="date"
                    className="w-full border p-2 rounded"
                    value={currentWorkWeek.toDate}
                    onChange={(e) =>
                      setCurrentWorkWeek({
                        ...currentWorkWeek,
                        toDate: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Working Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = currentWorkWeek.workingDays.includes(
                      day.id.toString(),
                    );
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => {
                          const str = day.id.toString();
                          const exists =
                            currentWorkWeek.workingDays.includes(str);
                          const newDays = exists
                            ? currentWorkWeek.workingDays.filter(
                                (d) => d !== str,
                              )
                            : [...currentWorkWeek.workingDays, str];
                          setCurrentWorkWeek({
                            ...currentWorkWeek,
                            workingDays: newDays,
                          });
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          isSelected
                            ? "bg-secondary text-white"
                            : "bg-surface-raised text-text-muted hover:bg-gray-200"
                        }`}
                      >
                        {day.label.substring(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                onClick={() => setIsWorkWeekModalOpen(false)}
                className="px-4 py-2 text-text-secondary hover:bg-surface-raised rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const newWW = [...(formData.workWeeks || [])];
                  if (editingWorkWeekIndex !== null) {
                    newWW[editingWorkWeekIndex] = currentWorkWeek;
                  } else {
                    newWW.push(currentWorkWeek);
                  }
                  setFormData({ ...formData, workWeeks: newWW });
                  setIsWorkWeekModalOpen(false);
                }}
                className="px-4 py-2 bg-secondary text-white rounded hover:bg-secondary-dark"
              >
                Save Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarEditor;
