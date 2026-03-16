import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: any[];
  widget: any;
  isDesignMode?: boolean;
}

export default function AreaChartWidget({ data }: Props) {
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
  const labelKey =
    keys.find(
      (k) => typeof data[0][k] === "string" || k.toLowerCase().includes("date"),
    ) || keys[0];
  const valueKey =
    keys.find(
      (k) =>
        k !== labelKey &&
        (typeof data[0][k] === "number" || !isNaN(Number(data[0][k]))),
    ) || keys[1];

  const chartData = data.slice(0, 50).map((row) => ({
    name: String(row[labelKey] || "").substring(0, 12),
    value: Number(row[valueKey] || 0),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={chartData}
        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#2563eb"
          strokeWidth={2}
          fill="url(#areaGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
