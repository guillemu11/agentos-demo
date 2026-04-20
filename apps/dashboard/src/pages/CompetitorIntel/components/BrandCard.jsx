import { Link } from 'react-router-dom';

const AXES = [
    { key: 'lifecycle_maturity', label: 'Lifecycle' },
    { key: 'email_sophistication', label: 'Email' },
    { key: 'journey_depth', label: 'Journey' },
    { key: 'personalisation', label: 'Personal.' },
];

function formatRelative(iso) {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return 'just now';
    const min = Math.floor(diff / 60_000);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.floor(hr / 24);
    return `${d}d ago`;
}

export default function BrandCard({ brand, investigationId }) {
    const hasOverall = brand.overall != null;
    const overall = hasOverall ? Number(brand.overall).toFixed(1) : '—';

    return (
        <Link
            className="ci-brand-card"
            to={`/app/competitor-intel/${investigationId}/brand/${brand.id}`}
        >
            <div className="ci-brand-card-head">
                <div className="ci-brand-card-head-text">
                    {brand.category && <span className="ci-brand-card-category">{brand.category}</span>}
                    <h3>{brand.name}</h3>
                </div>
                <div className={`ci-score-big${hasOverall ? '' : ' is-empty'}`}>
                    {overall}
                    {hasOverall && <span className="ci-score-out-of">/10</span>}
                </div>
            </div>

            <ul className="ci-subscores">
                {AXES.map((a) => {
                    const v = brand[a.key];
                    const filled = v != null;
                    return (
                        <li key={a.key} className={filled ? '' : 'is-empty'}>
                            <span>{a.label}</span>
                            <div className="ci-bar">
                                <div style={{ width: `${(v || 0) * 10}%` }} />
                            </div>
                            <strong>{filled ? Number(v).toFixed(1) : '—'}</strong>
                        </li>
                    );
                })}
            </ul>

            <div className="ci-brand-card-foot">
                <span className="ci-stat">
                    <strong>{brand.emails_count ?? 0}</strong> emails
                </span>
                <span className="ci-stat">
                    <strong>
                        {brand.steps_done ?? 0}/{brand.steps_total ?? 0}
                    </strong>{' '}
                    steps
                </span>
                <span className="ci-stat">
                    Last <strong>{formatRelative(brand.last_email_at)}</strong>
                </span>
            </div>
        </Link>
    );
}
