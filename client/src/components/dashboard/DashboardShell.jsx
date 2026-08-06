export default function DashboardShell({
  brand = 'École La RACINE',
  kicker,
  title,
  description,
  actions,
  heroAside,
  children,
  className = '',
}) {
  return (
    <div className={`dash-page ${className}`.trim()}>
      <div className="dash-mesh" aria-hidden>
        <span className="dash-mesh-glow dash-mesh-a" />
        <span className="dash-mesh-glow dash-mesh-b" />
        <span className="dash-mesh-grid" />
      </div>

      <header className="dash-dayboard">
        <div className="dash-dayboard-main">
          <p className="dash-brand">{brand}</p>
          {kicker && <p className="dash-kicker">{kicker}</p>}
          <h1 className="dash-title">{title}</h1>
          {description && <p className="dash-desc">{description}</p>}
          {actions && <div className="dash-header-actions">{actions}</div>}
        </div>
        {heroAside && <div className="dash-dayboard-aside">{heroAside}</div>}
      </header>

      <div className="dash-body">{children}</div>
    </div>
  );
}
