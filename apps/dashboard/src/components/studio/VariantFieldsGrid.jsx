// apps/dashboard/src/components/studio/VariantFieldsGrid.jsx
import React, { useState } from 'react';
import { varLabel } from './studioConstants.js';

// Fallback fields if no template variables available
const FALLBACK_FIELDS = ['subject', 'preheader', 'hero_headline', 'cta', 'body_copy'];

export default function VariantFieldsGrid({ variantData, allVarNames, onApprove, onRegenerate }) {
  const fields = allVarNames?.length ? allVarNames : FALLBACK_FIELDS;
  const [editValues, setEditValues] = useState({});

  return (
    <div className="studio-fields-grid">
      {fields.map(varName => {
        const field = variantData?.[varName] || { status: 'pending', value: null };
        const editVal = editValues[varName] ?? field.value ?? '';
        const isDirty = editValues[varName] !== undefined && editValues[varName] !== field.value;
        const cls = field.status === 'approved' ? 'filled' : field.status === 'generating' ? 'generating' : '';
        const isFullWidth = varName.includes('body') || varName.includes('copy') || varName.includes('block_body');

        return (
          <div
            key={varName}
            className={`studio-field ${cls}${isFullWidth ? ' studio-field--full' : ''}`}
          >
            <div className="studio-field-label">
              {varLabel(varName)}
              {field.status === 'approved' && <span className="studio-field-status ok">✓</span>}
              {field.status === 'generating' && <span className="studio-field-status gen">generating…</span>}
              {field.status === 'pending' && <span className="studio-field-status pend">pending</span>}
            </div>
            <textarea
              className={`studio-field-textarea${!editVal ? ' empty' : ''}`}
              value={editVal}
              onChange={e => setEditValues(prev => ({ ...prev, [varName]: e.target.value }))}
              placeholder="Waiting for generation…"
              rows={isFullWidth ? 3 : 2}
            />
            {(field.value || isDirty) && (
              <div className="studio-field-actions">
                <button
                  className="studio-brief-action approve"
                  onClick={() => {
                    const val = editValues[varName] ?? field.value;
                    onApprove?.(varName, val);
                    setEditValues(prev => { const n = { ...prev }; delete n[varName]; return n; });
                  }}
                >
                  ✓ Approve
                </button>
                <button
                  className="studio-brief-action regen"
                  onClick={() => onRegenerate?.(varName)}
                >
                  ↺ Regenerate
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
