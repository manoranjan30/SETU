import { TrendingUp } from "lucide-react";

interface Props {
  data: any[];
  widget: any;
  isDesignMode?: boolean;
}

export default function KpiCardWidget({ data, widget }: Props) {
  if (!data.length) {
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
        No data
      </div>
    );
  }

  const configuredField = widget?.queryConfig?.valueField as string | undefined;
  const firstNumericKey =
    configuredField ||
    Object.keys(data[0]).find(
      (k) => typeof data[0][k] === "number" || !isNaN(Number(data[0][k])),
    );
  const aggregation = widget?.queryConfig?.aggregation || "SUM";
  const value = firstNumericKey
    ? aggregation === "COUNT"
      ? data.length
      : aggregation === "AVG"
        ? data.reduce(
            (sum, row) => sum + Number(row[firstNumericKey] || 0),
            0,
          ) / Math.max(data.length, 1)
        : data.reduce((sum, row) => sum + Number(row[firstNumericKey] || 0), 0)
    : data.length;
  const label = widget.displayConfig?.label || firstNumericKey || "Total";
  const formatted =
    value >= 1000000
      ? `${(value / 1000000).toFixed(1)}M`
      : value >= 1000
        ? `${(value / 1000).toFixed(1)}K`
        : value.toLocaleString(undefined, { maximumFractionDigits: 1 });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        gap: 4,
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: "#1e293b",
          lineHeight: 1,
        }}
      >
        {formatted}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12,
          color: "#22c55e",
          fontWeight: 600,
        }}
      >
        <TrendingUp size={14} />
        {data.length} records
      </div>
    </div>
  );
}
