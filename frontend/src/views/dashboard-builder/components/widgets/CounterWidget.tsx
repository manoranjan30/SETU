import { useEffect, useState } from 'react';

interface Props {
    data: any[];
    widget: any;
    isDesignMode?: boolean;
}

export default function CounterWidget({ data, widget }: Props) {
    const [displayed, setDisplayed] = useState(0);

    const configuredField = widget?.queryConfig?.valueField as string | undefined;
    const firstNumericKey = data.length
        ? configuredField || Object.keys(data[0]).find((k) => typeof data[0][k] === 'number' || !isNaN(Number(data[0][k])))
        : undefined;
    const aggregation = widget?.queryConfig?.aggregation || 'SUM';
    const target = firstNumericKey
        ? aggregation === 'COUNT'
            ? data.length
            : aggregation === 'AVG'
                ? data.reduce((sum, row) => sum + Number(row[firstNumericKey] || 0), 0) / Math.max(data.length, 1)
                : data.reduce((sum, row) => sum + Number(row[firstNumericKey] || 0), 0)
        : data.length;

    useEffect(() => {
        if (target === 0) { setDisplayed(0); return; }
        const duration = 800;
        const steps = 30;
        const increment = target / steps;
        let current = 0;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                setDisplayed(target);
                clearInterval(timer);
            } else {
                setDisplayed(Math.floor(current));
            }
        }, duration / steps);
        return () => clearInterval(timer);
    }, [target]);

    const formatted = displayed >= 1000000
        ? `${(displayed / 1000000).toFixed(1)}M`
        : displayed >= 1000
            ? `${(displayed / 1000).toFixed(1)}K`
            : displayed.toLocaleString();

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%',
        }}>
            <div style={{
                fontSize: 36, fontWeight: 800, color: '#2563eb',
                fontFeatureSettings: '"tnum"',
                transition: 'all 0.3s',
            }}>
                {formatted}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginTop: 4 }}>
                {firstNumericKey?.replace(/([A-Z])/g, ' $1').trim() || 'Total'}
            </div>
        </div>
    );
}
