// apps/dashboard/src/components/studio/VariantFieldsGrid.jsx
import React from 'react';

const FIELDS = [
  { key: 'subject',      label: 'Subject' },
  { key: 'preheader',    label: 'Preheader' },
  { key: 'heroHeadline', label: 'Hero Headline' },
  { key: 'cta',          label: 'CTA' },
  { key: 'bodyCopy',     label: 'Body Copy' },
];

export default function VariantFieldsGrid({ variantData }) {
  if (!variantData) {
    return (
      <div className="studio-fields-grid">
        {FIELDS.map(f => (
          <div key={f.key} className={`studio-field${f.key === 'bodyCopy' ? ' full-width' : ''}`} style={f.key === 'bodyCopy' ? { gridColumn: '1/-1' } : {}}>
            <div className="studio-field-label">
              {f.label}
              <span className="studio-field-status pend">pendiente</span>
            </div>
            <div className="studio-field-value empty">Esperando generación…</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="studio-fields-grid">
      {FIELDS.map(f => {
        const field = variantData[f.key] || { status: 'pending', value: null };
        const cls = field.status === 'approved' ? 'filled' : field.status === 'generating' ? 'generating' : '';
        return (
          <div
            key={f.key}
            className={`studio-field ${cls}`}
            style={f.key === 'bodyCopy' ? { gridColumn: '1/-1' } : {}}
          >
            <div className="studio-field-label">
              {f.label}
              {field.status === 'approved' && <span className="studio-field-status ok">✓</span>}
              {field.status === 'generating' && <span className="studio-field-status gen">generando…</span>}
              {field.status === 'pending' && <span className="studio-field-status pend">pendiente</span>}
            </div>
            <div className={`studio-field-value ${!field.value ? 'empty' : ''}`}>
              {field.value || 'Esperando…'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
