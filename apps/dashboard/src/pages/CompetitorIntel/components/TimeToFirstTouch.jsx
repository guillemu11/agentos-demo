function fmt(sec) {
    if (sec == null || Number.isNaN(sec)) return '—';
    if (sec < 60) return `${Math.round(sec)}s`;
    if (sec < 3600) return `${Math.round(sec / 60)}min`;
    if (sec < 86400) return `${(sec / 3600).toFixed(1)}h`;
    return `${(sec / 86400).toFixed(1)}d`;
}

function qualitative(sec) {
    if (sec == null) return 'No email yet';
    if (sec < 300) return 'Immediate';
    if (sec < 3600) return 'Fast';
    if (sec < 86400) return 'Slow';
    return 'Very slow';
}

function bucket(sec) {
    if (sec == null) return 'none';
    if (sec < 300) return 'excellent';
    if (sec < 3600) return 'good';
    if (sec < 86400) return 'ok';
    return 'bad';
}

export default function TimeToFirstTouch({ rows }) {
    return (
        <div className="ci-ttft">
            {rows.map(r => {
                const sec = r.seconds_to_first != null ? Number(r.seconds_to_first) : null;
                return (
                    <div key={r.brand_id} className="ci-ttft-cell" data-bucket={bucket(sec)}>
                        <span className="ci-ttft-brand">{r.brand_name}</span>
                        <span className="ci-ttft-value">{fmt(sec)}</span>
                        <span className="ci-ttft-qual">{qualitative(sec)}</span>
                    </div>
                );
            })}
        </div>
    );
}
