import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Users,
  Calendar,
  Plus,
  Search,
  Settings,
  FileSpreadsheet,
  MoreVertical,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  CalendarDays,
} from "lucide-react";
import api from "../../api/axios";
import LaborCategoryModal from "../../components/labor/LaborCategoryModal";
import LaborEntryModal from "../../components/labor/LaborEntryModal";
import LaborImportModal from "../../components/labor/LaborImportModal";

type TabType = "daily" | "weekly" | "monthly" | "reconciliation";

const LaborCountView = () => {
  const { projectId } = useParams();
  const [presence, setPresence] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [activeTab, setActiveTab] = useState<TabType>("daily");

  // Modals
  const [showCatModal, setShowCatModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, [projectId, selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [presRes, catRes, allocRes] = await Promise.all([
        api.get(`/labor/presence/${projectId}`),
        api.get(`/labor/categories?projectId=${projectId}`),
        api.get(`/labor/allocations/${projectId}`),
      ]);
      // Sort by date descending (latest first)
      const sortedPresence = presRes.data.sort(
        (a: any, b: any) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      setPresence(sortedPresence);
      setCategories(catRes.data);
      setAllocations(allocRes.data || []);
    } catch (err) {
      console.error("Failed to fetch labor data", err);
    } finally {
      setLoading(false);
    }
  };

  // Get weekly summary (last 7 days)
  const getWeeklySummary = () => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekData = presence.filter((p) => {
      const d = new Date(p.date);
      return d >= weekAgo && d <= today;
    });

    // Group by category
    const summary: Record<
      string,
      {
        name: string;
        group: string;
        total: number;
        dailyCounts: Record<string, number>;
      }
    > = {};
    categories.forEach((cat) => {
      summary[cat.id] = {
        name: cat.name,
        group: cat.categoryGroup,
        total: 0,
        dailyCounts: {},
      };
    });

    weekData.forEach((entry) => {
      if (summary[entry.categoryId]) {
        summary[entry.categoryId].total += parseFloat(entry.count) || 0;
        const dateKey = entry.date;
        summary[entry.categoryId].dailyCounts[dateKey] =
          (summary[entry.categoryId].dailyCounts[dateKey] || 0) +
          (parseFloat(entry.count) || 0);
      }
    });

    return Object.values(summary).filter((s) => s.total > 0);
  };

  // Get monthly summary
  const getMonthlySummary = () => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const monthData = presence.filter((p) => {
      const d = new Date(p.date);
      return d >= monthStart && d <= today;
    });

    const summary: Record<
      string,
      { name: string; group: string; total: number }
    > = {};
    categories.forEach((cat) => {
      summary[cat.id] = { name: cat.name, group: cat.categoryGroup, total: 0 };
    });

    monthData.forEach((entry) => {
      if (summary[entry.categoryId]) {
        summary[entry.categoryId].total += parseFloat(entry.count) || 0;
      }
    });

    return Object.values(summary).filter((s) => s.total > 0);
  };

  // Get reconciliation data for selected date
  const getReconciliation = () => {
    const datePresence = presence.filter((p) => p.date === selectedDate);

    // Group presence by category
    const presenceByCategory: Record<number, number> = {};
    datePresence.forEach((p) => {
      presenceByCategory[p.categoryId] =
        (presenceByCategory[p.categoryId] || 0) + (parseFloat(p.count) || 0);
    });

    // For now, allocations are simulated. In production, fetch from /labor/activity by date
    const allocationByCategory: Record<number, number> = {};
    allocations
      .filter((a) => a.date === selectedDate)
      .forEach((a) => {
        allocationByCategory[a.categoryId] =
          (allocationByCategory[a.categoryId] || 0) +
          (parseFloat(a.count) || 0);
      });

    return categories
      .map((cat) => {
        const present = presenceByCategory[cat.id] || 0;
        const allocated = allocationByCategory[cat.id] || 0;
        const unassigned = present - allocated;
        let status: "ok" | "warning" | "error" = "ok";
        if (unassigned > 0) status = "warning";
        if (unassigned < 0) status = "error";
        if (present === 0 && allocated === 0) status = "ok";

        return {
          categoryId: cat.id,
          categoryName: cat.name,
          categoryGroup: cat.categoryGroup,
          present,
          allocated,
          unassigned,
          status,
        };
      })
      .filter((r) => r.present > 0 || r.allocated > 0);
  };

  const tabs = [
    { id: "daily", label: "Daily Register", icon: Calendar },
    { id: "weekly", label: "Weekly Summary", icon: CalendarDays },
    { id: "monthly", label: "Monthly Report", icon: BarChart3 },
    { id: "reconciliation", label: "Reconciliation", icon: TrendingUp },
  ];

  const filteredPresence = selectedDate
    ? presence.filter((p) => p.date === selectedDate)
    : presence;

  const totalManpower = filteredPresence.reduce(
    (sum, p) => sum + (parseFloat(p.count) || 0),
    0,
  );

  return (
    <div className="h-full flex flex-col bg-surface-base">
      {/* Top Header */}
      <div className="bg-surface-card border-b border-border-default px-8 py-6 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <div className="p-2 bg-secondary rounded-xl text-white shadow-lg shadow-indigo-100">
                <Users className="w-6 h-6" />
              </div>
              Manpower Dashboard
            </h2>
            <p className="text-text-muted text-sm mt-1 font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-secondary" />
              Daily tracking, weekly/monthly reports & reconciliation
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCatModal(true)}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-text-secondary px-4 py-2.5 rounded-xl font-bold text-sm transition-all border border-border-default"
            >
              <Settings className="w-4 h-4" />
              Categories
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 bg-success-muted hover:bg-emerald-100 text-emerald-700 px-4 py-2.5 rounded-xl font-bold text-sm transition-all border border-emerald-100"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Import
            </button>
            <button
              onClick={() => setShowEntryModal(true)}
              className="flex items-center gap-2 bg-secondary hover:bg-secondary-dark text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-200 ring-2 ring-indigo-50"
            >
              <Plus className="w-4 h-4" />
              New Entry
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-6 bg-slate-100 p-1 rounded-xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-surface-card text-secondary shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Date Filter & Stats (for Daily and Reconciliation) */}
          {(activeTab === "daily" || activeTab === "reconciliation") && (
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-8 bg-surface-card p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-6">
                <div className="flex items-center gap-3 flex-1">
                  <div className="bg-surface-base p-2 rounded-lg text-text-disabled">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search contractor or category..."
                    className="bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-600 placeholder:text-text-disabled w-full"
                  />
                </div>
                <div className="h-8 w-px bg-slate-100"></div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-text-disabled uppercase tracking-wider">
                    Date
                  </span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-surface-base border-none rounded-lg text-sm font-bold text-secondary focus:ring-2 ring-indigo-100 cursor-pointer px-3 py-1.5"
                  />
                </div>
              </div>

              <div className="col-span-4 bg-secondary p-4 rounded-2xl shadow-lg shadow-indigo-100 flex items-center justify-between text-white relative overflow-hidden">
                <div className="relative z-10">
                  <h4 className="text-indigo-100 text-[10px] font-black uppercase tracking-widest mb-1">
                    Total Manpower
                  </h4>
                  <p className="text-3xl font-black">{totalManpower}</p>
                </div>
                <Users className="w-16 h-16 text-secondary/30 absolute -right-2 -bottom-2" />
                <div className="bg-surface-card/10 px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/20">
                  <span className="text-[10px] font-bold">LIVE ON SITE</span>
                </div>
              </div>
            </div>
          )}

          {/* DAILY REGISTER TAB */}
          {activeTab === "daily" && (
            <div className="bg-surface-card rounded-2xl border border-border-default shadow-sm overflow-hidden min-h-[400px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-base/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-black text-text-disabled uppercase tracking-widest">
                      Category
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black text-text-disabled uppercase tracking-widest">
                      Contractor
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black text-text-disabled uppercase tracking-widest">
                      Type
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black text-text-disabled uppercase tracking-widest text-center">
                      Count
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black text-text-disabled uppercase tracking-widest">
                      Logged By
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black text-text-disabled uppercase tracking-widest text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3 text-text-disabled animate-pulse">
                          <Users className="w-10 h-10 opacity-20" />
                          <p className="font-bold text-sm">Loading...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPresence.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3 text-slate-300">
                          <Users className="w-12 h-12 opacity-20" />
                          <p className="font-semibold text-lg">
                            No entries for this date
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPresence.map((entry) => (
                      <tr
                        key={entry.id}
                        className="hover:bg-surface-base/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-secondary-muted text-secondary flex items-center justify-center font-bold text-xs ring-1 ring-indigo-100">
                              {entry.category?.name?.charAt(0)}
                            </div>
                            <span className="font-bold text-text-secondary text-sm">
                              {entry.category?.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-slate-600">
                            {entry.contractorName || "N/A"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                              entry.category?.categoryGroup === "Skilled"
                                ? "bg-warning-muted text-warning border border-amber-100"
                                : "bg-surface-base text-text-muted border border-slate-100"
                            }`}
                          >
                            {entry.category?.categoryGroup || "General"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-lg font-black text-slate-800">
                            {entry.count}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-600 flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                              {entry.updatedBy || "System"}
                            </span>
                            <span className="text-[10px] text-text-disabled font-medium flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {new Date(entry.updatedOn).toLocaleTimeString()}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="p-2 text-slate-300 hover:text-slate-600 hover:bg-surface-card rounded-lg transition-all">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* WEEKLY SUMMARY TAB */}
          {activeTab === "weekly" && (
            <div className="bg-surface-card rounded-2xl border border-border-default shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-text-secondary flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-secondary" />
                  Weekly Manpower Summary (Last 7 Days)
                </h3>
                <span className="text-xs font-bold text-text-disabled">
                  {new Date(
                    Date.now() - 7 * 24 * 60 * 60 * 1000,
                  ).toLocaleDateString()}{" "}
                  - {new Date().toLocaleDateString()}
                </span>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-base/50 border-b border-slate-100">
                    <th className="px-6 py-3 text-[10px] font-black text-text-disabled uppercase">
                      Category
                    </th>
                    <th className="px-6 py-3 text-[10px] font-black text-text-disabled uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-[10px] font-black text-text-disabled uppercase text-center">
                      Total (7 Days)
                    </th>
                    <th className="px-6 py-3 text-[10px] font-black text-text-disabled uppercase text-center">
                      Daily Avg
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {getWeeklySummary().map((item, idx) => (
                    <tr key={idx} className="hover:bg-surface-base/50">
                      <td className="px-6 py-4 font-bold text-text-secondary">
                        {item.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-surface-base text-text-muted border border-slate-100">
                          {item.group || "General"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-black text-slate-800 text-lg">
                        {item.total}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-secondary">
                        {(item.total / 7).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                  {getWeeklySummary().length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-text-disabled"
                      >
                        No data for the past 7 days
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* MONTHLY REPORT TAB */}
          {activeTab === "monthly" && (
            <div className="bg-surface-card rounded-2xl border border-border-default shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-text-secondary flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-500" />
                  Monthly Manpower Report
                </h3>
                <span className="text-xs font-bold text-text-disabled">
                  {new Date().toLocaleString("default", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-base/50 border-b border-slate-100">
                    <th className="px-6 py-3 text-[10px] font-black text-text-disabled uppercase">
                      Category
                    </th>
                    <th className="px-6 py-3 text-[10px] font-black text-text-disabled uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-[10px] font-black text-text-disabled uppercase text-center">
                      Total Man-Days
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {getMonthlySummary().map((item, idx) => (
                    <tr key={idx} className="hover:bg-surface-base/50">
                      <td className="px-6 py-4 font-bold text-text-secondary">
                        {item.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-surface-base text-text-muted border border-slate-100">
                          {item.group || "General"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-black text-slate-800 text-lg">
                        {item.total}
                      </td>
                    </tr>
                  ))}
                  {getMonthlySummary().length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-12 text-center text-text-disabled"
                      >
                        No data for this month
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="p-4 bg-surface-base border-t border-slate-100 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-600">
                  Total Man-Days:{" "}
                  <span className="text-secondary">
                    {getMonthlySummary().reduce((s, i) => s + i.total, 0)}
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* RECONCILIATION TAB */}
          {activeTab === "reconciliation" && (
            <div className="bg-surface-card rounded-2xl border border-border-default shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-text-secondary flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-500" />
                  Labor Reconciliation for {selectedDate}
                </h3>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />{" "}
                    Matched
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />{" "}
                    Unassigned
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />{" "}
                    Over-Allocated
                  </span>
                </div>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-base/50 border-b border-slate-100">
                    <th className="px-6 py-3 text-[10px] font-black text-text-disabled uppercase">
                      Category
                    </th>
                    <th className="px-6 py-3 text-[10px] font-black text-text-disabled uppercase text-center">
                      Present
                    </th>
                    <th className="px-6 py-3 text-[10px] font-black text-text-disabled uppercase text-center">
                      Allocated
                    </th>
                    <th className="px-6 py-3 text-[10px] font-black text-text-disabled uppercase text-center">
                      Unassigned
                    </th>
                    <th className="px-6 py-3 text-[10px] font-black text-text-disabled uppercase text-center">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {getReconciliation().map((item, idx) => (
                    <tr key={idx} className="hover:bg-surface-base/50">
                      <td className="px-6 py-4 font-bold text-text-secondary">
                        {item.categoryName}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-text-secondary">
                        {item.present}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-secondary">
                        {item.allocated}
                      </td>
                      <td className="px-6 py-4 text-center font-black">
                        <span
                          className={`${item.unassigned > 0 ? "text-warning" : item.unassigned < 0 ? "text-rose-600" : "text-success"}`}
                        >
                          {item.unassigned > 0
                            ? `+${item.unassigned}`
                            : item.unassigned}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.status === "ok" && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                        )}
                        {item.status === "warning" && (
                          <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto" />
                        )}
                        {item.status === "error" && (
                          <AlertTriangle className="w-5 h-5 text-rose-500 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                  {getReconciliation().length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-text-disabled"
                      >
                        No presence or allocation data for this date
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <LaborCategoryModal
        isOpen={showCatModal}
        onClose={() => setShowCatModal(false)}
        projectId={projectId!}
        onSave={fetchData}
      />
      <LaborEntryModal
        isOpen={showEntryModal}
        onClose={() => setShowEntryModal(false)}
        projectId={projectId!}
        onSave={fetchData}
        categories={categories}
      />
      <LaborImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        projectId={projectId!}
        onSave={fetchData}
        categories={categories}
      />
    </div>
  );
};

export default LaborCountView;
