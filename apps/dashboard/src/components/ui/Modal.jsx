import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, size = 'md', showClose = true }) {
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    const dialog = dialogRef.current;
    if (dialog) {
      const focusable = dialog.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (focusable || dialog).focus();
    }

    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
      if (e.key === 'Tab' && dialog) {
        const focusables = dialog.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="ui-modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'ui-modal-title' : undefined}
        tabIndex={-1}
        className={`ui-modal ui-modal--${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showClose) && (
          <header className="ui-modal__header">
            {title && <h2 id="ui-modal-title" className="ui-modal__title">{title}</h2>}
            {showClose && (
              <button
                type="button"
                className="ui-modal__close"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            )}
          </header>
        )}
        <div className="ui-modal__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
