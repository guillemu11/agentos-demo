import { useId } from 'react';

export default function TabStrip({ tabs, active, onChange, className = '', ariaLabel }) {
  const baseId = useId();
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`ui-tabs ${className}`.trim()}
    >
      {tabs.map((t) => {
        const id = `${baseId}-${t.id}`;
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            id={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`${id}-panel`}
            tabIndex={isActive ? 0 : -1}
            className={`ui-tab ${isActive ? 'ui-tab--active' : ''}`}
            onClick={() => onChange(t.id)}
          >
            {t.icon}
            <span className="ui-tab__label">{t.label}</span>
            {t.badge != null && <span className="ui-tab__badge">{t.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
