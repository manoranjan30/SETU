interface Props {
    data: any[];
    widget: any;
    isDesignMode?: boolean;
}

export default function GaugeWidget({ data, widget }: Props) {
    const configuredField = widget?.queryConfig?.valueField as string | undefined;
    const firstNumericKey = data.length
        ? configuredField || Object.keys(data[0]).find((k) => typeof data[0][k] === 'number' || !isNaN(Number(data[0][k])))
        : undefined;
    const value = firstNumericKey && data.length
        ? Number(data.reduce((sum, row) => sum + Number(row[firstNumericKey] || 0), 0) / Math.max(data.length, 1))
        : 0;

    const percentage = Math.min(Math.max(value, 0), 100);
    const angle = (percentage / 100) * 180;
    const radius = 60;
    const cx = 70;
    const cy = 70;

    const x = cx + radius * Math.cos(Math.PI - (angle * Math.PI) / 180);
    const y = cy - radius * Math.sin((angle * Math.PI) / 180);
    const largeArc = angle > 180 ? 1 : 0;

    const arcPath = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 ${largeArc} 1 ${x} ${y}`;
    const bgArcPath = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;

    const color = percentage >= 75 ? '#22c55e' : percentage >= 50 ? '#f59e0b' : '#ef4444';

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%',
        }}>
            <svg width={140} height={85} viewBox="0 0 140 80">
                <path d={bgArcPath} fill="none" stroke="#e2e8f0" strokeWidth={12} strokeLinecap="round" />
                {percentage > 0 && (
                    <path d={arcPath} fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" />
                )}
                <text x={cx} y={cy - 5} textAnchor="middle" fontSize={22} fontWeight={800} fill="#1e293b">
                    {percentage.toFixed(0)}%
                </text>
            </svg>
        </div>
    );
}
