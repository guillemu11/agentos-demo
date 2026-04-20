import { useState } from 'react';

function typeChip(classification) {
  const t = classification?.type || 'unclassified';
  return <span className={`ci-chip ci-chip--${t}`}>{t}</span>;
}

export default function InboxTable({ emails, onSelect }) {
  const [filter, setFilter] = useState('');
  const filtered = emails.filter(e =>
    !filter ||
    (e.subject || '').toLowerCase().includes(filter.toLowerCase()) ||
    (e.brand_name || '').toLowerCase().includes(filter.toLowerCase())
  );
  return (
    <div className="ci-inbox-table">
      <input
        placeholder="Filter..."
        value={filter}
        onChange={e => setFilter(e.target.value)}
        className="ci-filter"
      />
      {filtered.length === 0
        ? <p className="ci-muted">No emails yet.</p>
        : (
          <table>
            <thead><tr><th>Received</th><th>Brand</th><th>Subject</th><th>Type</th><th>From</th></tr></thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} onClick={() => onSelect?.(e)} className="ci-row">
                  <td>{e.received_at ? new Date(e.received_at).toLocaleString() : '—'}</td>
                  <td>{e.brand_name || <em>unclassified</em>}</td>
                  <td>{e.subject}</td>
                  <td>{typeChip(e.classification)}</td>
                  <td>{e.sender_email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </div>
  );
}
