function fmt(sec) {
    if (sec == null || Number.isNaN(sec)) return '—';
    const s = Number(sec);
    // Negative = signup timestamp drift (user reported BST, ingested as UTC).
    // Email actually arrived within first minute — show as approximate immediate.
    if (s < 0) return '~0s';
    if (s < 60) return `${Math.round(s)}s`;
    if (s < 3600) return `${Math.round(s / 60)}min`;
    if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
    return `${(s / 86400).toFixed(1)}d`;
}

function qualitative(sec) {
    if (sec == null) return 'No email yet';
    const s = Number(sec);
    if (s < 0) return 'Immediate*';
    if (s < 300) return 'Immediate';
    if (s < 3600) return 'Fast';
    if (s < 86400) return 'Slow';
    return 'Very slow';
}

function bucket(sec) {
    if (sec == null) return 'none';
    const s = Number(sec);
    if (s < 300) return 'excellent'; // negatives = immediate too
    if (s < 3600) return 'good';
    if (s < 86400) return 'ok';
    return 'bad';
}

export default function TimeToFirstTouch({ rows }) {
    // Group by brand
    const byBrand = new Map();
    for (const r of rows) {
        if (!byBrand.has(r.brand_id)) {
            byBrand.set(r.brand_id, { name: r.brand_name, personas: [] });
        }
        byBrand.get(r.brand_id).personas.push(r);
    }
    const brands = [...byBrand.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));

    return (
        <div className="ci-ttft-grid">
            {brands.map(([bid, b]) => (
                <div key={bid} className="ci-ttft-brand-card">
                    <div className="ci-ttft-brand-name">{b.name}</div>
                    <div className="ci-ttft-personas">
                        {b.personas
                            .sort((a, b) => (a.persona_name || '').localeCompare(b.persona_name || ''))
                            .map(p => {
                                const sec = p.seconds_to_first != null ? Number(p.seconds_to_first) : null;
                                const firstName = (p.persona_name || '').split(' ')[0];
                                return (
                                    <div
                                        key={p.persona_id}
                                        className="ci-ttft-cell"
                                        data-bucket={bucket(sec)}
                                    >
                                        <span className="ci-ttft-persona">{firstName}</span>
                                        <span className="ci-ttft-value">{fmt(sec)}</span>
                                        <span className="ci-ttft-qual">{qualitative(sec)}</span>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            ))}
        </div>
    );
}
