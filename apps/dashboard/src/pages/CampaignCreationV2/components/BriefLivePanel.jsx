import React from 'react';
import { Check, CircleDashed, Loader2 } from 'lucide-react';

const FIELDS = [
  { key: 'name',             label: 'Name' },
  { key: 'objective',        label: 'Objective' },
  { key: 'send_date',        label: 'Send date',  fmt: v => new Date(v).toLocaleString() },
  { key: 'template_id',      label: 'Template' },
  { key: 'markets',          label: 'Markets',    fmt: v => v.join(', ') },
  { key: 'languages',        label: 'Languages',  fmt: v => v.join(', ') },
  { key: 'variants_plan',    label: 'Variants',   fmt: v => `${v.length} planned` },
  { key: 'audience_summary', label: 'Audience' },
];

function isFilled(v) {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}

export default function BriefLivePanel({ brief, asking = null }) {
  const filled = FIELDS.filter(f => isFilled(brief[f.key])).length;
  return (
    <aside className="cc2-live-panel">
      <div className="cc2-live-panel__title">BRIEF BEING BUILT</div>
      {FIELDS.map(f => {
        const v = brief[f.key];
        const filled = isFilled(v);
        const pending = !filled && asking !== f.key;
        const asking_ = !filled && asking === f.key;
        return (
          <div key={f.key} className="cc2-live-field">
            <div className="cc2-live-field__label">{f.label}</div>
            <div className={`cc2-live-field__value ${filled ? 'filled' : asking_ ? 'asking' : 'pending'}`}>
              {filled ? (
                <><Check size={12} /> {f.fmt ? f.fmt(v) : v}</>
              ) : asking_ ? (
                <><Loader2 size={12} className="cc2-spin" /> asking…</>
              ) : (
                <><CircleDashed size={12} /> pending</>
              )}
            </div>
          </div>
        );
      })}
      <div className="cc2-live-progress">
        <div
          className="cc2-live-progress__bar"
          style={{ width: `${(filled / FIELDS.length) * 100}%` }}
        />
        <div className="cc2-live-progress__label">{filled}/{FIELDS.length} fields</div>
      </div>
    </aside>
  );
}
