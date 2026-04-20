import { useState } from 'react';
import { Flag, Mail, Eye, MousePointerClick, Lightbulb } from 'lucide-react';

const KIND_META = {
  step_done:      { label: 'Playbook step', icon: Flag,               tone: 'you' },
  email_received: { label: 'Email received', icon: Mail,              tone: 'brand' },
  open:           { label: 'Opened',         icon: Eye,               tone: 'system' },
  click:          { label: 'Clicked',        icon: MousePointerClick, tone: 'system' },
  insight:        { label: 'Insight',        icon: Lightbulb,         tone: 'insight' },
};

function fmtTime(iso) {
  if (!iso) return '';
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

function typeChip(type) {
  if (!type) return null;
  return <span className={`ci-chip ci-chip--${type}`}>{type.replace(/_/g, ' ')}</span>;
}

function EventBody({ event, compact }) {
  const { kind, data } = event;
  if (kind === 'step_done') {
    const verb = data.status === 'skipped' ? 'Skipped' : 'Completed';
    return (
      <>
        <div className="ci-tl-primary">
          <strong>Step {data.step_order}</strong> — {verb}
          {data.status === 'skipped' && <span className="ci-tl-skipped"> (skipped)</span>}
        </div>
        <div className="ci-tl-secondary">{data.action}</div>
        {!compact && data.notes && <div className="ci-tl-notes">{data.notes}</div>}
      </>
    );
  }
  if (kind === 'email_received') {
    return (
      <>
        <div className="ci-tl-primary">
          {data.subject || '(no subject)'}
          {typeChip(data.type)}
        </div>
        <div className="ci-tl-secondary">
          from <code>{data.sender_email}</code>
          {data.phase === 2 && <span className="ci-tl-badge">LLM</span>}
        </div>
      </>
    );
  }
  if (kind === 'open') {
    return (
      <>
        <div className="ci-tl-primary">Opened email</div>
        <div className="ci-tl-secondary">{data.subject || '(no subject)'}</div>
      </>
    );
  }
  if (kind === 'click') {
    return (
      <>
        <div className="ci-tl-primary">Clicked link</div>
        <div className="ci-tl-secondary">
          {data.subject && <>on <em>{data.subject}</em> · </>}
          <code className="ci-tl-url">{data.link_url}</code>
        </div>
      </>
    );
  }
  if (kind === 'insight') {
    return (
      <>
        <div className="ci-tl-primary">
          {data.title}
          {data.severity && <span className={`ci-tl-badge ci-tl-badge--sev-${data.severity}`}>{data.severity}</span>}
        </div>
        {!compact && data.body && <div className="ci-tl-notes">{data.body}</div>}
      </>
    );
  }
  return null;
}

export default function Timeline({ events, compact = false, showBrand = false }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!events?.length) {
    return (
      <div className="ci-tl-empty">
        No events yet. Mark a playbook step done or wait for the ingestion worker (5 min).
      </div>
    );
  }

  return (
    <ol className="ci-timeline">
      {events.map((ev, i) => {
        const meta = KIND_META[ev.kind] || { label: ev.kind, icon: Flag, tone: 'system' };
        const Icon = meta.icon;
        const rowKey = `${ev.kind}-${ev.data?.step_id || ev.data?.email_id || ev.data?.engagement_id || ev.data?.insight_id || i}`;
        const isExpanded = expandedId === rowKey;
        const canExpand = (ev.kind === 'step_done' && ev.data.notes) || (ev.kind === 'insight' && ev.data.body);

        return (
          <li key={rowKey} className={`ci-tl-row ci-tl-row--${meta.tone}`} data-actor={ev.actor}>
            <div className="ci-tl-rail">
              <span className="ci-tl-dot" aria-hidden><Icon size={14} /></span>
            </div>
            <div className="ci-tl-body">
              <div className="ci-tl-meta">
                <time>{fmtTime(ev.at)}</time>
                <span className="ci-tl-kind">{meta.label}</span>
                {showBrand && ev.brand_name && <span className="ci-tl-brand">{ev.brand_name}</span>}
                {ev.persona_name && <span className="ci-tl-persona">{ev.persona_name}</span>}
                {ev.actor === 'you' && <span className="ci-tl-actor">you</span>}
                {ev.actor === 'brand' && <span className="ci-tl-actor ci-tl-actor--brand">brand</span>}
                {ev.actor === 'system' && <span className="ci-tl-actor ci-tl-actor--system">auto</span>}
              </div>
              <div
                className={`ci-tl-content${canExpand ? ' is-clickable' : ''}`}
                onClick={canExpand ? () => setExpandedId(isExpanded ? null : rowKey) : undefined}
                role={canExpand ? 'button' : undefined}
              >
                <EventBody event={ev} compact={compact && !isExpanded} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
