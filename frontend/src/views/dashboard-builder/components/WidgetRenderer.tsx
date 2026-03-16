import { useState, useEffect } from "react";
import type { WidgetConfig } from "../../../services/dashboard-builder.service";
import { dashboardBuilderApi } from "../../../services/dashboard-builder.service";
import KpiCardWidget from "./widgets/KpiCardWidget";
import BarChartWidget from "./widgets/BarChartWidget";
import LineChartWidget from "./widgets/LineChartWidget";
import PieChartWidget from "./widgets/PieChartWidget";
import DonutChartWidget from "./widgets/DonutChartWidget";
import AreaChartWidget from "./widgets/AreaChartWidget";
import TableWidget from "./widgets/TableWidget";
import GaugeWidget from "./widgets/GaugeWidget";
import CounterWidget from "./widgets/CounterWidget";
import ProgressRingWidget from "./widgets/ProgressRingWidget";

interface Props {
  widget: WidgetConfig;
  isDesignMode?: boolean;
}

export default function WidgetRenderer({ widget, isDesignMode }: Props) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      if (!widget.dataSourceKey) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await dashboardBuilderApi.queryData(widget.dataSourceKey, {
          ...widget.queryConfig,
          limit: isDesignMode ? 20 : widget.queryConfig?.limit || 100,
        });
        if (active) {
          setData(res.data);
          setError("");
        }
      } catch (err: any) {
        if (active) setError(err?.message || "Failed to load data");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();

    // Auto-refresh (only in viewer mode)
    let interval: any;
    if (!isDesignMode && widget.refreshIntervalSec > 0) {
      interval = setInterval(fetchData, widget.refreshIntervalSec * 1000);
    }

    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [
    widget.dataSourceKey,
    widget.queryConfig,
    widget.refreshIntervalSec,
    isDesignMode,
  ]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#94a3b8",
          fontSize: 13,
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            border: "2px solid #e2e8f0",
            borderTopColor: "#2563eb",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#ef4444",
          fontSize: 12,
          textAlign: "center",
          padding: 8,
        }}
      >
        {error}
      </div>
    );
  }

  const widgetProps = { data, widget, isDesignMode };

  switch (widget.widgetType) {
    case "KPI":
      return <KpiCardWidget {...widgetProps} />;
    case "BAR":
    case "STACKED_BAR":
      return <BarChartWidget {...widgetProps} />;
    case "LINE":
      return <LineChartWidget {...widgetProps} />;
    case "AREA":
      return <AreaChartWidget {...widgetProps} />;
    case "PIE":
      return <PieChartWidget {...widgetProps} />;
    case "DONUT":
      return <DonutChartWidget {...widgetProps} />;
    case "TABLE":
      return <TableWidget {...widgetProps} />;
    case "GAUGE":
      return <GaugeWidget {...widgetProps} />;
    case "COUNTER":
      return <CounterWidget {...widgetProps} />;
    case "PROGRESS_RING":
      return <ProgressRingWidget {...widgetProps} />;
    default:
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "#94a3b8",
            fontSize: 12,
          }}
        >
          Widget type "{widget.widgetType}" coming soon
        </div>
      );
  }
}
