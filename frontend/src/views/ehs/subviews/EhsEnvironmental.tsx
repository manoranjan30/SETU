import { useState, useEffect } from "react";
import {
  Plus,
  Droplets,
  Trash2,
  Wind,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Info,
} from "lucide-react";
import api from "../../../api/axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Props {
  projectId: number;
}

const WATER_SOURCES = ["MUNICIPAL", "TANKER", "BOREWELL", "STP", "RAINWATER"];

const EhsEnvironmental: React.FC<Props> = ({ projectId }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    waterDomestic: 0,
    waterConstruction: 0,
    waterSource: WATER_SOURCES[1],
    tankerCount: 0,
    hazardousWaste: 0,
    nonHazardousWaste: 0,
    dustControlDone: true,
    sprinklingFrequency: 2,
  });

  useEffect(() => {
    fetchLogs();
  }, [projectId]);

  const fetchLogs = async () => {
    try {
      const response = await api.get(`/ehs/${projectId}/environmental`);
      setLogs(response.data);
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/ehs/${projectId}/environmental`, formData);
      setShowModal(false);
      fetchLogs();
    } catch (error) {
      console.error("Error creating log:", error);
    }
  };

  return (
    <div className="space-y-8">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-card p-6 rounded-2xl border border-border-subtle shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-primary-muted rounded-xl text-primary">
              <Droplets className="w-6 h-6" />
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-success bg-success-muted px-2 py-1 rounded-full">
              <ArrowDownRight className="w-3 h-3" /> 12%
            </span>
          </div>
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">
            Water Consumption
          </h3>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-3xl font-black text-text-primary">4,250</p>
            <span className="text-sm font-bold text-text-disabled">
              KL (Monthly)
            </span>
          </div>
        </div>

        <div className="bg-surface-card p-6 rounded-2xl border border-border-subtle shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-orange-50 rounded-xl text-orange-600">
              <Trash2 className="w-6 h-6" />
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-error bg-error-muted px-2 py-1 rounded-full">
              <ArrowUpRight className="w-3 h-3" /> 5%
            </span>
          </div>
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">
            Waste Generated
          </h3>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-3xl font-black text-text-primary">820</p>
            <span className="text-sm font-bold text-text-disabled">
              Kg (Weekly)
            </span>
          </div>
        </div>

        <div className="bg-surface-card p-6 rounded-2xl border border-border-subtle shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-success-muted rounded-xl text-success">
              <Wind className="w-6 h-6" />
            </div>
            <span className="px-2 py-1 bg-success-muted text-emerald-700 text-[10px] font-black uppercase rounded border border-emerald-100">
              OPTIMAL
            </span>
          </div>
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">
            Air Quality (PM2.5)
          </h3>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-3xl font-black text-text-primary">32</p>
            <span className="text-sm font-bold text-text-disabled">μg/m³</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Segment */}
        <div className="lg:col-span-2 bg-surface-card p-8 rounded-3xl border border-border-subtle shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-black text-text-primary">
                Resource Consumption Trend
              </h3>
              <p className="text-sm text-text-muted">
                Water and Waste metrics over the last 7 days
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="bg-primary text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-primary-dark transition-all"
            >
              <Plus className="w-5 h-5" />
              Log Daily Entry
            </button>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { date: "Mon", water: 400, waste: 120 },
                  { date: "Tue", water: 300, waste: 100 },
                  { date: "Wed", water: 500, waste: 150 },
                  { date: "Thu", water: 450, waste: 130 },
                  { date: "Fri", water: 380, waste: 90 },
                  { date: "Sat", water: 420, waste: 110 },
                  { date: "Sun", water: 350, waste: 80 },
                ]}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f3f4f6"
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "#f9fafb" }}
                  contentStyle={{ borderRadius: "12px", border: "none" }}
                />
                <Legend iconType="circle" />
                <Bar
                  dataKey="water"
                  name="Water (KL)"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="waste"
                  name="Waste (Kg)"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Details Segment */}
        <div className="bg-surface-card p-8 rounded-3xl border border-border-subtle shadow-sm overflow-hidden relative">
          <h3 className="text-xl font-black text-text-primary mb-6">
            Recent Records
          </h3>
          <div className="space-y-6">
            {logs.slice(0, 5).map((log, i) => (
              <div key={i} className="flex gap-4 group">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-2xl bg-surface-base flex items-center justify-center group-hover:bg-primary-muted transition-colors">
                    <Calendar className="w-5 h-5 text-text-disabled group-hover:text-primary" />
                  </div>
                  <div className="w-px h-full bg-surface-raised mt-2" />
                </div>
                <div className="pb-6">
                  <p className="text-sm font-black text-text-primary">
                    {new Date(log.date).toLocaleDateString()}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="px-2 py-1 bg-primary-muted text-blue-700 text-[10px] font-bold rounded flex items-center gap-1">
                      <Droplets className="w-3 h-3" />{" "}
                      {Number(log.waterDomestic) +
                        Number(log.waterConstruction)}{" "}
                      KL
                    </span>
                    <span className="px-2 py-1 bg-orange-50 text-orange-700 text-[10px] font-bold rounded flex items-center gap-1">
                      <Trash2 className="w-3 h-3" />{" "}
                      {Number(log.hazardousWaste) +
                        Number(log.nonHazardousWaste)}{" "}
                      Kg
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-center py-10">
                <Info className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-text-disabled">
                  No environmental logs recorded yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-surface-card w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl">
            <div className="px-8 py-6 border-b flex justify-between items-center bg-primary-muted/30">
              <div>
                <h3 className="text-xl font-black text-text-primary flex items-center gap-2 uppercase tracking-tight">
                  <Droplets className="w-6 h-6 text-primary" />
                  Daily Environmental Log
                </h3>
                <p className="text-sm text-text-muted mt-0.5">
                  Record water, waste and dust control data
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-surface-raised rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-text-disabled" />
              </button>
            </div>
            <form
              onSubmit={handleSubmit}
              className="p-8 space-y-6 max-h-[70vh] overflow-auto"
            >
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-text-disabled tracking-widest pl-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  className="w-full px-4 py-3 bg-surface-base border-none rounded-2xl focus:ring-2 focus:ring-blue-600/10 outline-none"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-text-disabled tracking-widest pl-1">
                    Domestic Water (KL)
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 bg-surface-base border-none rounded-2xl focus:ring-2 focus:ring-blue-600/10 outline-none font-bold"
                    value={formData.waterDomestic}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        waterDomestic: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-text-disabled tracking-widest pl-1">
                    Construction Water (KL)
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 bg-surface-base border-none rounded-2xl focus:ring-2 focus:ring-blue-600/10 outline-none font-bold"
                    value={formData.waterConstruction}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        waterConstruction: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-text-disabled tracking-widest pl-1">
                    Primary Source
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-surface-base border-none rounded-2xl focus:ring-2 focus:ring-blue-600/10 outline-none font-bold text-text-secondary"
                    value={formData.waterSource}
                    onChange={(e) =>
                      setFormData({ ...formData, waterSource: e.target.value })
                    }
                  >
                    {WATER_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-text-disabled tracking-widest pl-1">
                    Tankers (if any)
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 bg-surface-base border-none rounded-2xl focus:ring-2 focus:ring-blue-600/10 outline-none font-bold"
                    value={formData.tankerCount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tankerCount: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-text-disabled tracking-widest pl-1">
                    Hazardous Waste (Kg)
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 bg-surface-base border-none rounded-2xl focus:ring-2 focus:ring-blue-600/10 outline-none font-bold"
                    value={formData.hazardousWaste}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hazardousWaste: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-text-disabled tracking-widest pl-1">
                    Construction Debris (Kg)
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 bg-surface-base border-none rounded-2xl focus:ring-2 focus:ring-blue-600/10 outline-none font-bold"
                    value={formData.nonHazardousWaste}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        nonHazardousWaste: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-border-subtle">
                <div>
                  <h4 className="text-sm font-black text-text-primary uppercase">
                    Dust Control Checklist
                  </h4>
                  <p className="text-xs text-text-disabled">
                    Water sprinkling status for the day
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-border-strong text-primary focus:ring-blue-600"
                      checked={formData.dustControlDone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dustControlDone: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm font-bold text-text-secondary">
                      Completed
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-disabled font-bold uppercase">
                      Freq:
                    </span>
                    <input
                      type="number"
                      className="w-16 px-3 py-1 bg-surface-base border-none rounded-lg text-sm font-bold"
                      value={formData.sprinklingFrequency}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sprinklingFrequency: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </form>
            <div className="px-8 py-6 bg-surface-base border-t flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-3 text-sm font-black uppercase text-text-muted hover:text-text-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 bg-primary text-white px-10 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-primary-dark transition-all shadow-xl shadow-blue-200"
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

export default EhsEnvironmental;
