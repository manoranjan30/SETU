interface Props {
    data: any[];
    widget: any;
    isDesignMode?: boolean;
}

export default function ProgressRingWidget({ data }: Props) {
    const firstNumericKey = data.length
        ? Object.keys(data[0]).find((k) =>
            (typeof data[0][k] === 'number' || !isNaN(Number(data[0][k]))) &&
            Number(data[0][k]) <= 100,
        )
        : undefined;

    const value = firstNumericKey && data.length
        ? Number(data[0][firstNumericKey] || 0)
        : 0;

    const percentage = Math.min(Math.max(value, 0), 100);
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    const color = percentage >= 75 ? '#22c55e' : percentage >= 50 ? '#f59e0b' : '#ef4444';

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%',
        }}>
            <svg width={120} height={120} viewBox="0 0 120 120">
                <circle cx={60} cy={60} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={8} />
                <circle
                    cx={60} cy={60} r={radius}
                    fill="none" stroke={color} strokeWidth={8}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                />
                <text x={60} y={57} textAnchor="middle" fontSize={24} fontWeight={800} fill="#1e293b">
                    {percentage.toFixed(0)}%
                </text>
                <text x={60} y={73} textAnchor="middle" fontSize={10} fill="#94a3b8">
                    Complete
                </text>
            </svg>
        </div>
    );
}
