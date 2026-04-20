import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function ChatPromptChips({ chips = [], onSelect, asButton = false }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    const escape = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const handleSelect = (chip) => {
    setOpen(false);
    onSelect(chip);
  };

  if (asButton) {
    return (
      <div style={{ position: 'relative' }} ref={ref}>
        <button
          className="chat-sparkle-btn"
          onClick={() => setOpen(o => !o)}
          title={t('aiProposals.chatChipsLabel')}
          type="button"
        >
          ✦
        </button>
        {open && (
          <div className="chat-chips-popover">
            <div className="chat-chips-popover__label">{t('aiProposals.chatChipsLabel')}</div>
            {chips.map((chip, i) => (
              <button key={i} className="chat-prompt-chip" onClick={() => handleSelect(chip)} type="button">
                {chip}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="chat-prompt-chips">
      {chips.map((chip, i) => (
        <button key={i} className="chat-prompt-chip" onClick={() => handleSelect(chip)} type="button">
          {chip}
        </button>
      ))}
    </div>
  );
}
