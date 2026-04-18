import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((msg, opts = {}) => {
    const id = ++toastId;
    const toast = { id, msg, tone: opts.tone || 'info', duration: opts.duration ?? 3500 };
    setToasts((prev) => [...prev, toast]);
    if (toast.duration > 0) {
      setTimeout(() => dismiss(id), toast.duration);
    }
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    show,
    success: (msg, opts) => show(msg, { ...opts, tone: 'success' }),
    error: (msg, opts) => show(msg, { ...opts, tone: 'error' }),
    warning: (msg, opts) => show(msg, { ...opts, tone: 'warning' }),
    info: (msg, opts) => show(msg, { ...opts, tone: 'info' }),
    dismiss,
  }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="ui-toast-stack" role="region" aria-live="polite" aria-atomic="false">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  const Icon = toneIcon(toast.tone);
  return (
    <div className={`ui-toast ui-toast--${toast.tone}`} role="status">
      <Icon size={16} className="ui-toast__icon" />
      <div className="ui-toast__msg">{toast.msg}</div>
      <button type="button" className="ui-toast__close" onClick={onDismiss} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}

function toneIcon(tone) {
  switch (tone) {
    case 'success': return CheckCircle2;
    case 'warning': return AlertTriangle;
    case 'error': return XCircle;
    default: return Info;
  }
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside a <ToastProvider>');
  return ctx;
}
