import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  data: any[];
  widget: any;
  isDesignMode?: boolean;
}

const COLORS = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#a855f7",
];

export default function PieChartWidget({ data }: Props) {
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

  const keys = Object.keys(data[0]);
  const labelKey = keys.find((k) => typeof data[0][k] === "string") || keys[0];
  const valueKey =
    keys.find(
      (k) =>
        k !== labelKey &&
        (typeof data[0][k] === "number" || !isNaN(Number(data[0][k]))),
    ) || keys[1];

  const chartData = data
    .slice(0, 10)
    .map((row) => ({
      name: String(row[labelKey] || "N/A").substring(0, 20),
      value: Math.abs(Number(row[valueKey] || 0)),
    }))
    .filter((d) => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius="70%"
          label={(props: any) =>
            `${props.name || ""} ${((props.percent ?? 0) * 100).toFixed(0)}%`
          }
          labelLine={{ stroke: "#94a3b8" }}
          style={{ fontSize: 11 }}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
