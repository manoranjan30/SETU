import { useState } from "react";
import {
  X,
  BarChart3,
  PieChart,
  TrendingUp,
  Table,
  Target,
  Hash,
  Circle,
} from "lucide-react";
import type { DataSourceMeta } from "../../../services/dashboard-builder.service";

interface Props {
  dataSources: DataSourceMeta[];
  onAdd: (widgetType: string, dataSourceKey: string, title: string) => void;
  onClose: () => void;
}

const WIDGET_TYPES = [
  {
    type: "KPI",
    icon: Hash,
    label: "KPI Card",
    desc: "Single metric with trend",
  },
  { type: "COUNTER", icon: Hash, label: "Counter", desc: "Animated number" },
  {
    type: "PROGRESS_RING",
    icon: Circle,
    label: "Progress Ring",
    desc: "Percentage completion",
  },
  {
    type: "BAR",
    icon: BarChart3,
    label: "Bar Chart",
    desc: "Category comparisons",
  },
  {
    type: "STACKED_BAR",
    icon: BarChart3,
    label: "Stacked Bar",
    desc: "Multi-series bars",
  },
  {
    type: "LINE",
    icon: TrendingUp,
    label: "Line Chart",
    desc: "Trends over time",
  },
  {
    type: "AREA",
    icon: TrendingUp,
    label: "Area Chart",
    desc: "Volume trends",
  },
  { type: "PIE", icon: PieChart, label: "Pie Chart", desc: "Distribution" },
  {
    type: "DONUT",
    icon: PieChart,
    label: "Donut Chart",
    desc: "Distribution + center stat",
  },
  { type: "TABLE", icon: Table, label: "Data Table", desc: "Sortable table" },
  { type: "GAUGE", icon: Target, label: "Gauge", desc: "Value against target" },
];

export default function AddWidgetPanel({ dataSources, onAdd, onClose }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [title, setTitle] = useState("");

  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
    setStep(2);
  };

  const handleSourceSelect = (key: string) => {
    setSelectedSource(key);
    const source = dataSources.find((s) => s.key === key);
    setTitle(`${source?.label || ""}`);
    setStep(3);
  };

  const handleConfirm = () => {
    if (selectedType && selectedSource && title.trim()) {
      onAdd(selectedType, selectedSource, title.trim());
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: 480,
          background: "#fff",
          height: "100%",
          overflowY: "auto",
          boxShadow: "-10px 0 30px rgba(0,0,0,0.15)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid #e2e8f0",
            position: "sticky",
            top: 0,
            background: "#fff",
            zIndex: 10,
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "#1e293b",
              }}
            >
              Add Widget
            </h3>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  style={{
                    width: 24,
                    height: 4,
                    borderRadius: 2,
                    background: step >= s ? "#2563eb" : "#e2e8f0",
                    transition: "background 0.3s",
                  }}
                />
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: 6,
              border: "none",
              borderRadius: 6,
              background: "#f1f5f9",
              cursor: "pointer",
              color: "#64748b",
              display: "flex",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Content */}
        <div style={{ flex: 1, padding: 20 }}>
          {/* Step 1: Choose widget type */}
          {step === 1 && (
            <>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#475569",
                  margin: "0 0 16px",
                }}
              >
                Step 1: Choose Widget Type
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {WIDGET_TYPES.map((wt) => {
                  const Icon = wt.icon;
                  return (
                    <button
                      key={wt.type}
                      onClick={() => handleTypeSelect(wt.type)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "12px 14px",
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                        background: "#fff",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#2563eb";
                        e.currentTarget.style.background = "#eff6ff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e2e8f0";
                        e.currentTarget.style.background = "#fff";
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: "#f1f5f9",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={18} color="#2563eb" />
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#1e293b",
                          }}
                        >
                          {wt.label}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>
                          {wt.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Step 2: Choose data source */}
          {step === 2 && (
            <>
              <button
                onClick={() => setStep(1)}
                style={{
                  padding: "4px 10px",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  background: "#fff",
                  cursor: "pointer",
                  color: "#64748b",
                  fontSize: 12,
                  marginBottom: 12,
                  fontWeight: 500,
                }}
              >
                ← Back
              </button>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#475569",
                  margin: "0 0 16px",
                }}
              >
                Step 2: Choose Data Source
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {dataSources.map((ds) => (
                  <button
                    key={ds.key}
                    onClick={() => handleSourceSelect(ds.key)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      padding: "14px 16px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      background: "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#2563eb";
                      e.currentTarget.style.background = "#eff6ff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.background = "#fff";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#1e293b",
                        }}
                      >
                        {ds.label}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 12,
                          fontWeight: 600,
                          background:
                            ds.scope === "GLOBAL" ? "#dbeafe" : "#f0fdf4",
                          color: ds.scope === "GLOBAL" ? "#1d4ed8" : "#15803d",
                        }}
                      >
                        {ds.scope}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      Module: {ds.module} • {ds.fields.length} fields
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 3: Name & Confirm */}
          {step === 3 && (
            <>
              <button
                onClick={() => setStep(2)}
                style={{
                  padding: "4px 10px",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  background: "#fff",
                  cursor: "pointer",
                  color: "#64748b",
                  fontSize: 12,
                  marginBottom: 12,
                  fontWeight: 500,
                }}
              >
                ← Back
              </button>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#475569",
                  margin: "0 0 16px",
                }}
              >
                Step 3: Name Your Widget
              </p>
              <div
                style={{
                  padding: 16,
                  background: "#f8fafc",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  marginBottom: 20,
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    Widget Type:{" "}
                  </span>
                  <span
                    style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}
                  >
                    {selectedType}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    Data Source:{" "}
                  </span>
                  <span
                    style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}
                  >
                    {dataSources.find((s) => s.key === selectedSource)?.label}
                  </span>
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#475569",
                    marginBottom: 6,
                  }}
                >
                  Widget Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Activity Progress"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  autoFocus
                />
              </div>
              <button
                onClick={handleConfirm}
                disabled={!title.trim()}
                style={{
                  width: "100%",
                  padding: "12px 20px",
                  border: "none",
                  borderRadius: 8,
                  background: title.trim() ? "#2563eb" : "#94a3b8",
                  color: "#fff",
                  cursor: title.trim() ? "pointer" : "default",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Add Widget to Dashboard
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
