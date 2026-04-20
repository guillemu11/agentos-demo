import { Link } from 'react-router-dom';

export default function BrandCard({ brand, investigationId }) {
  const overall = brand.overall != null ? Number(brand.overall).toFixed(1) : '—';
  const axes = [
    { key: 'lifecycle_maturity',   label: 'Lifecycle' },
    { key: 'email_sophistication', label: 'Email' },
    { key: 'journey_depth',        label: 'Journey' },
    { key: 'personalisation',      label: 'Personalisation' }
  ];
  const lastEmail = brand.last_email_at ? new Date(brand.last_email_at).toLocaleString() : '—';
  return (
    <Link className="ci-brand-card" to={`/app/competitor-intel/${investigationId}/brand/${brand.id}`}>
      <header>
        <h3>{brand.name}</h3>
        <span className="ci-score-big">{overall}</span>
      </header>
      <ul className="ci-subscores">
        {axes.map(a => (
          <li key={a.key}>
            <span>{a.label}</span>
            <div className="ci-bar"><div style={{ width: `${(brand[a.key] || 0) * 10}%` }}/></div>
            <strong>{brand[a.key] != null ? Number(brand[a.key]).toFixed(1) : '—'}</strong>
          </li>
        ))}
      </ul>
      <footer>
        <span>{brand.emails_count} emails</span>
        <span>{brand.steps_done}/{brand.steps_total} steps</span>
        <span>Last: {lastEmail}</span>
      </footer>
    </Link>
  );
}
