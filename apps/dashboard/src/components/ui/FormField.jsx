import { cloneElement, useId } from 'react';

export default function FormField({ label, hint, error, required, children, className = '' }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const input = cloneElement(children, {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? 'true' : undefined,
    required,
  });

  return (
    <div className={`ui-field ${error ? 'ui-field--error' : ''} ${className}`.trim()}>
      {label && (
        <label htmlFor={id} className="ui-field__label">
          {label}
          {required && <span className="ui-field__req" aria-hidden="true"> *</span>}
        </label>
      )}
      {input}
      {hint && !error && <div id={hintId} className="ui-field__hint">{hint}</div>}
      {error && <div id={errorId} className="ui-field__error" role="alert">{error}</div>}
    </div>
  );
}
