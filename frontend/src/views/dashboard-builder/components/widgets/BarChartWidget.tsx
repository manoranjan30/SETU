import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
    data: any[];
    widget: any;
    isDesignMode?: boolean;
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function BarChartWidget({ data }: Props) {
    if (!data.length) {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 12 }}>No data</div>;
    }

    const keys = Object.keys(data[0]);
    const labelKey = keys.find((k) => typeof data[0][k] === 'string') || keys[0];
    const numericKeys = keys.filter((k) => k !== labelKey && (typeof data[0][k] === 'number' || !isNaN(Number(data[0][k]))));
    const valueKeys = numericKeys.slice(0, 3);

    const chartData = data.slice(0, 20).map((row) => {
        const item: any = { name: String(row[labelKey] || '').substring(0, 15) };
        valueKeys.forEach((k) => { item[k] = Number(row[k] || 0); });
        return item;
    });

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                {valueKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                {valueKeys.map((key, i) => (
                    <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
            </BarChart>
        </ResponsiveContainer>
    );
}
