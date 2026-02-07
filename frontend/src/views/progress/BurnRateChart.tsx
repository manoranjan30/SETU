import React from 'react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';

interface BurnRateChartProps {
    data: Record<string, number>;
    loading?: boolean;
}

const BurnRateChart: React.FC<BurnRateChartProps> = ({ data, loading }) => {
    // Transform daily trends data for chart
    const chartData = Object.entries(data || {})
        .map(([date, value]) => ({
            date: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            rawDate: date,
            value: value
        }))
        .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime())
        .slice(-30); // Last 30 days

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 h-[400px] animate-pulse">
                <div className="h-6 bg-slate-100 rounded w-1/4 mb-8"></div>
                <div className="h-64 bg-slate-50 rounded w-full"></div>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-xl">
                    <p className="text-xs font-bold text-slate-500 mb-1">{label}</p>
                    <p className="text-sm font-black text-indigo-600">
                        {new Intl.NumberFormat('en-IN', {
                            style: 'currency',
                            currency: 'INR',
                            maximumFractionDigits: 0
                        }).format(payload[0].value)}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="font-bold text-slate-700">Daily Burn Rate Trend</h3>
                    <p className="text-xs text-slate-400 mt-1">Financial value of executed work (Last 30 Days)</p>
                </div>
                <div className="flex gap-2">
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded">Daily</span>
                </div>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            tickFormatter={(value: number) => `₹${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#4f46e5"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorValue)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default BurnRateChart;
