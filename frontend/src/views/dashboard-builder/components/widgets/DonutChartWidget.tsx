import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
    data: any[];
    widget: any;
    isDesignMode?: boolean;
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function DonutChartWidget({ data, widget }: Props) {
    if (!data.length) {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 12 }}>No data</div>;
    }

    const keys = Object.keys(data[0]);
    const configuredLabel = widget?.queryConfig?.labelField as string | undefined;
    const configuredValue = widget?.queryConfig?.valueField as string | undefined;
    const labelKey = configuredLabel || keys.find((k) => typeof data[0][k] === 'string') || keys[0];
    const valueKey = configuredValue || keys.find((k) => k !== labelKey && (typeof data[0][k] === 'number' || !isNaN(Number(data[0][k])))) || keys[1];

    const chartData = data.slice(0, 8).map((row) => ({
        name: String(row[labelKey] || 'N/A').substring(0, 20),
        value: Math.abs(Number(row[valueKey] || 0)),
    })).filter((d) => d.value > 0);

    const total = chartData.reduce((sum, d) => sum + d.value, 0);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="55%"
                        outerRadius="75%"
                    >
                        {chartData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                </PieChart>
            </ResponsiveContainer>
            <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)', textAlign: 'center',
            }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>
                    {total >= 1000 ? `${(total / 1000).toFixed(1)}K` : total.toLocaleString()}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>TOTAL</div>
            </div>
        </div>
    );
}
