import React from 'react';
import { X, Check } from 'lucide-react';

export default function OptionPreviewModal({ option, onAccept, onClose, accepting }) {
  if (!option) return null;
  return (
    <div className="cc2-modal-backdrop" onClick={onClose}>
      <div className="cc2-modal cc2-modal--wide" onClick={e => e.stopPropagation()}>
        <header className="cc2-modal__header">
          <div>
            <div className="cc2-modal__badge ai">
              {(option.direction || '').toUpperCase()}
            </div>
            <h2 className="cc2-modal__title">{option.headline}</h2>
          </div>
          <button className="cc2-modal__close" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="cc2-modal__body">
          <div className="cc2-option-preview">
            <div className="cc2-option-preview__frame">
              <div className="cc2-option-preview__label">📱 Mobile</div>
              <div className="cc2-option-preview__mock">
                <h3>{option.subject}</h3>
                <p className="cc2-option-preview__preheader">{option.preheader}</p>
                <p>{option.body}</p>
                <button className="cc2-btn primary" type="button">{option.cta_label}</button>
              </div>
            </div>
            <div className="cc2-option-preview__frame">
              <div className="cc2-option-preview__label">💻 Desktop</div>
              <div className="cc2-option-preview__mock cc2-option-preview__mock--wide">
                <h3>{option.subject}</h3>
                <p className="cc2-option-preview__preheader">{option.preheader}</p>
                <p>{option.body}</p>
                <button className="cc2-btn primary" type="button">{option.cta_label}</button>
              </div>
            </div>
          </div>
          {option.mood && (
            <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
              Mood: {option.mood}
            </p>
          )}
        </div>

        <footer className="cc2-modal__footer">
          <button className="cc2-btn" onClick={onClose} type="button">Back</button>
          <div style={{ flex: 1 }} />
          <button
            className="cc2-btn primary"
            onClick={onAccept}
            type="button"
            disabled={accepting}
          >
            <Check size={14} /> {accepting ? 'Accepting…' : 'Accept this option'}
          </button>
        </footer>
      </div>
    </div>
  );
}
