export default function EmptyState({ icon, title, description, action, className = '' }) {
  return (
    <div className={`ui-empty ${className}`.trim()}>
      {icon && <div className="ui-empty__icon">{icon}</div>}
      {title && <h3 className="ui-empty__title">{title}</h3>}
      {description && <p className="ui-empty__desc">{description}</p>}
      {action && <div className="ui-empty__action">{action}</div>}
    </div>
  );
}
