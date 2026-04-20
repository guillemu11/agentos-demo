import { useState } from 'react';

function TypeChip({ classification }) {
    const t = classification?.type || 'unclassified';
    const label = t.replace(/_/g, ' ');
    return <span className={`ci-chip ci-chip--${t}`}>{label}</span>;
}

function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const today = new Date();
    const same = d.toDateString() === today.toDateString();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (same) return `Today · ${hh}:${mm}`;
    const day = String(d.getDate()).padStart(2, '0');
    const mon = d.toLocaleString(undefined, { month: 'short' });
    return `${day} ${mon} · ${hh}:${mm}`;
}

export default function InboxTable({ emails, onSelect }) {
    const [filter, setFilter] = useState('');
    const filtered = emails.filter(
        (e) =>
            !filter ||
            (e.subject || '').toLowerCase().includes(filter.toLowerCase()) ||
            (e.brand_name || '').toLowerCase().includes(filter.toLowerCase()) ||
            (e.sender_email || '').toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="ci-inbox-wrap">
            <div className="ci-inbox-head">
                <span className="ci-inbox-count">
                    <strong>{filtered.length}</strong>
                    {filter && emails.length !== filtered.length
                        ? ` of ${emails.length} emails`
                        : emails.length === 1
                        ? ' email'
                        : ' emails'}
                </span>
                <input
                    placeholder="Filter by subject, brand, or sender…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="ci-filter"
                />
            </div>

            {filtered.length === 0 ? (
                <div className="ci-inbox-empty">
                    {emails.length === 0
                        ? 'No emails ingested yet. Connect Gmail and subscribe to a brand newsletter.'
                        : 'No emails match that filter.'}
                </div>
            ) : (
                <div className="ci-inbox-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Received</th>
                                <th>Brand</th>
                                <th>Subject</th>
                                <th>Type</th>
                                <th>From</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((e) => (
                                <tr key={e.id} onClick={() => onSelect?.(e)} className="ci-row">
                                    <td className="col-date">{fmtDate(e.received_at)}</td>
                                    <td className="col-brand">
                                        {e.brand_name || <em>Unclassified</em>}
                                    </td>
                                    <td className="col-subject">{e.subject || '—'}</td>
                                    <td className="col-type">
                                        <TypeChip classification={e.classification} />
                                    </td>
                                    <td className="col-from">{e.sender_email}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
