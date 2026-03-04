interface Props {
    data: any[];
    widget: any;
    isDesignMode?: boolean;
}

export default function TableWidget({ data }: Props) {
    if (!data.length) {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 12 }}>No data</div>;
    }

    const columns = Object.keys(data[0]).filter((k) => k !== 'id');

    return (
        <div style={{ overflow: 'auto', height: '100%', fontSize: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col}
                                style={{
                                    position: 'sticky', top: 0, padding: '6px 10px',
                                    background: '#f8fafc', borderBottom: '2px solid #e2e8f0',
                                    textAlign: 'left', fontWeight: 600, color: '#475569',
                                    fontSize: 11, whiteSpace: 'nowrap', textTransform: 'capitalize',
                                }}
                            >
                                {col.replace(/([A-Z])/g, ' $1').trim()}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.slice(0, 50).map((row, i) => (
                        <tr
                            key={i}
                            style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}
                        >
                            {columns.map((col) => (
                                <td
                                    key={col}
                                    style={{
                                        padding: '5px 10px', borderBottom: '1px solid #f1f5f9',
                                        whiteSpace: 'nowrap', color: '#334155', maxWidth: 180,
                                        overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}
                                >
                                    {row[col] != null ? String(row[col]) : '—'}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
