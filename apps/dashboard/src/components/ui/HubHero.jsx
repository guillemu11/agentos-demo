export default function HubHero({ eyebrow, title, titleAccent = '.', subtitle, actions, hint }) {
  return (
    <header className="jl__hero">
      <div className="jl__hero-grid" aria-hidden="true" />
      <div className="jl__hero-glow" aria-hidden="true" />
      <div className="jl__hero-content">
        {eyebrow && <div className="jl__hero-eyebrow">{eyebrow}</div>}
        {title && (
          <h1 className="jl__hero-title">
            {title}
            {titleAccent && <span className="jl__hero-title-accent">{titleAccent}</span>}
          </h1>
        )}
        {subtitle && <p className="jl__hero-subtitle">{subtitle}</p>}
        {(actions || hint) && (
          <div className="jl__hero-actions">
            {actions}
            {hint && <div className="jl__hero-hint">{hint}</div>}
          </div>
        )}
      </div>
    </header>
  );
}
