const STAGE_LABELS = {
    welcome: 'Welcome',
    nurture: 'Nurture',
    triggered_click_followup: 'Triggered',
    re_engagement: 'Re-engage',
    abandonment: 'Abandon',
    transactional: 'Transac.',
};

function bucket(c) {
    if (!c || c === 0) return 'empty';
    if (c < 2) return 'low';
    if (c < 5) return 'mid';
    return 'high';
}

export default function LifecycleHeatmap({ rows, stages }) {
    const brandMap = new Map();
    for (const r of rows) {
        if (!brandMap.has(r.brand_id)) {
            brandMap.set(r.brand_id, { name: r.brand_name, counts: {} });
        }
        if (r.type) brandMap.get(r.brand_id).counts[r.type] = r.c;
    }
    const brands = [...brandMap.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));

    return (
        <div className="ci-heatmap">
            <table>
                <thead>
                    <tr>
                        <th></th>
                        {stages.map(s => <th key={s}>{STAGE_LABELS[s] || s}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {brands.map(([id, b]) => (
                        <tr key={id}>
                            <th scope="row">{b.name}</th>
                            {stages.map(s => {
                                const c = b.counts[s] || 0;
                                return (
                                    <td key={s} data-bucket={bucket(c)}>
                                        {c > 0 ? c : ''}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
