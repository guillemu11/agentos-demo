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
    // Key = brand_id|persona_id (persona may be null for rows with no emails)
    const keyed = new Map();
    for (const r of rows) {
        const key = `${r.brand_id}|${r.persona_id ?? 'none'}`;
        if (!keyed.has(key)) {
            keyed.set(key, {
                brand_id: r.brand_id,
                brand_name: r.brand_name,
                persona_id: r.persona_id,
                persona_name: r.persona_name,
                counts: {},
            });
        }
        if (r.type) keyed.get(key).counts[r.type] = r.c;
    }

    // Filter out rows with persona_id=null AND no counts (noise from LEFT JOIN with brands that have 0 emails)
    const allRows = [...keyed.values()].filter(r => {
        const hasAny = Object.values(r.counts).some(v => v > 0);
        // Keep rows even without counts if persona is set (shows brand×persona pair with 0 emails)
        return r.persona_id != null || hasAny;
    });

    // Sort by brand name, then persona name
    allRows.sort((a, b) => {
        const byBrand = a.brand_name.localeCompare(b.brand_name);
        if (byBrand !== 0) return byBrand;
        return (a.persona_name || '').localeCompare(b.persona_name || '');
    });

    return (
        <div className="ci-heatmap">
            <table>
                <thead>
                    <tr>
                        <th>Brand</th>
                        <th>Persona</th>
                        {stages.map(s => <th key={s}>{STAGE_LABELS[s] || s}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {allRows.map((r, i) => {
                        const prevBrand = i > 0 ? allRows[i - 1].brand_id : null;
                        const showBrand = r.brand_id !== prevBrand;
                        const firstName = (r.persona_name || '—').split(' ')[0];
                        return (
                            <tr key={`${r.brand_id}-${r.persona_id}`}>
                                <th scope="row" className="ci-heatmap-brand-cell">
                                    {showBrand ? r.brand_name : ''}
                                </th>
                                <td className="ci-heatmap-persona-cell">{firstName}</td>
                                {stages.map(s => {
                                    const c = r.counts[s] || 0;
                                    return (
                                        <td key={s} data-bucket={bucket(c)}>
                                            {c > 0 ? c : ''}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
