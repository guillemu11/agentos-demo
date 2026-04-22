import React, { useEffect, useState } from 'react';
import { briefsApi } from './lib/briefsApi.js';

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export default function OverviewDashboard() {
  const [briefs, setBriefs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    briefsApi.list()
      .then(({ briefs }) => setBriefs(briefs))
      .catch(err => console.error('[overview] load failed', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="cc2-empty">Loading…</div>;

  const count = (pred) => briefs.filter(pred).length;
  const sevenDaysAgo = Date.now() - SEVEN_DAYS;

  const kpis = [
    { label: 'DRAFT',     value: count(b => b.status === 'draft'),     kind: 'muted' },
    { label: 'IN WIZARD', value: count(b => b.status === 'in_wizard'), kind: 'yellow' },
    { label: 'SCHEDULED', value: count(b => b.status === 'active'),    kind: 'primary' },
    {
      label: 'SENT · 7d',
      value: count(b => b.status === 'sent' && new Date(b.updated_at).getTime() > sevenDaysAgo),
      kind: 'green',
    },
  ];

  const pipeline = briefs
    .filter(b => b.status !== 'dismissed' && b.status !== 'sent')
    .sort((a, b) => {
      const da = a.send_date ? new Date(a.send_date).getTime() : Infinity;
      const db = b.send_date ? new Date(b.send_date).getTime() : Infinity;
      return da - db;
    });

  return (
    <div className="cc2-overview">
      <div className="cc2-kpi-row">
        {kpis.map(k => (
          <div key={k.label} className={`cc2-kpi-card k-${k.kind}`}>
            <div className="cc2-kpi-card__label">{k.label}</div>
            <div className="cc2-kpi-card__value">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="cc2-pipeline">
        <div className="cc2-pipeline__title">Pipeline</div>
        <table className="cc2-pipeline__table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Source</th>
              <th>Status</th>
              <th>Date</th>
              <th>Markets</th>
              <th>Variants</th>
            </tr>
          </thead>
          <tbody>
            {pipeline.length === 0 ? (
              <tr><td colSpan={6} className="cc2-pipeline__empty">No campaigns in pipeline.</td></tr>
            ) : (
              pipeline.map(b => {
                const markets = Array.isArray(b.markets) ? b.markets : [];
                const variants = Array.isArray(b.variants_plan) ? b.variants_plan.length : 0;
                return (
                  <tr key={b.id}>
                    <td>{b.name || <em style={{ color: 'var(--text-muted)' }}>(untitled)</em>}</td>
                    <td>
                      <span className={`cc2-source-pill s-${b.source}`}>
                        {b.source === 'ai' ? 'AI' : 'Human'}
                      </span>
                    </td>
                    <td><span className={`cc2-status-pill s-${b.status}`}>{b.status}</span></td>
                    <td>{b.send_date ? new Date(b.send_date).toLocaleDateString() : '—'}</td>
                    <td>{markets.join(', ') || '—'}</td>
                    <td>{variants}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
