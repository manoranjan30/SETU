import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit, Trash2, CalendarCheck, Check } from "lucide-react";
import api from "../../api/axios";

interface WorkCalendar {
  id: number;
  name: string;
  description: string;
  isDefault: boolean;
  dailyWorkHours: number;
  workingDays: string[];
  holidays: string[];
}

const CalendarListPage = () => {
  const navigate = useNavigate();
  const [calendars, setCalendars] = useState<WorkCalendar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCalendars();
  }, []);

  const fetchCalendars = async () => {
    try {
      const res = await api.get("/calendars");
      setCalendars(res.data);
    } catch (error) {
      console.error("Failed to fetch calendars", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this calendar?"))
      return;
    try {
      await api.delete(`/calendars/${id}`); // api baseURL already has /api
      setCalendars((prev) => prev.filter((c) => c.id !== id));
    } catch (error: any) {
      console.error("Delete failed", error);
      const msg = error.response?.data?.message || "Failed to delete calendar";
      alert(msg);
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center text-text-muted">
        Loading calendars...
      </div>
    );

  return (
    <div className="h-[calc(100vh-64px)] overflow-auto bg-surface-base flex flex-col">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Work Calendars</h1>
            <p className="text-text-muted">
              Define working days, holidays, and standard hours.
            </p>
          </div>
          <button
            onClick={() => navigate("/dashboard/calendars/new")}
            className="flex items-center gap-2 bg-secondary hover:bg-secondary-dark text-white px-4 py-2 rounded-md transition-colors shadow-sm"
          >
            <Plus size={18} />
            Create Calendar
          </button>
        </div>

        <div className="bg-surface-card rounded-lg shadow border border-border-default overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-surface-base border-b border-border-default">
              <tr>
                <th className="px-6 py-3 font-semibold text-text-secondary">
                  Name
                </th>
                <th className="px-6 py-3 font-semibold text-text-secondary">
                  Description
                </th>
                <th className="px-6 py-3 font-semibold text-text-secondary">
                  Default
                </th>
                <th className="px-6 py-3 font-semibold text-text-secondary">
                  Daily Hours
                </th>
                <th className="px-6 py-3 font-semibold text-text-secondary">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {calendars.map((cal) => (
                <tr key={cal.id} className="hover:bg-surface-base group">
                  <td className="px-6 py-4 font-medium text-text-primary flex items-center gap-2">
                    <CalendarCheck size={16} className="text-text-disabled" />
                    {cal.name}
                  </td>
                  <td className="px-6 py-4 text-text-secondary">
                    {cal.description || "-"}
                  </td>
                  <td className="px-6 py-4">
                    {cal.isDefault ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <Check size={12} className="mr-1" /> Default
                      </span>
                    ) : (
                      <span className="text-text-disabled">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-text-secondary">
                    {cal.dailyWorkHours}h
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() =>
                          navigate(`/dashboard/calendars/${cal.id}`)
                        }
                        className="p-1.5 text-primary hover:bg-primary-muted rounded"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(cal.id)}
                        className="p-1.5 text-error hover:bg-error-muted rounded"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {calendars.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-text-disabled"
                  >
                    No calendars found. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CalendarListPage;
