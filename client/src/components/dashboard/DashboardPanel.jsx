export default function DashboardPanel({
  title,
  description,
  action,
  children,
  className = '',
  bodyClassName = '',
  flush = false,
}) {
  return (
    <section className={`dash-panel ${className}`.trim()}>
      {(title || action) && (
        <div className="dash-panel-head">
          <div>
            {title && <h2 className="dash-panel-title">{title}</h2>}
            {description && <p className="dash-panel-desc">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={`${flush ? 'dash-panel-body-flush' : 'dash-panel-body'} ${bodyClassName}`.trim()}>
        {children}
      </div>
    </section>
  );
}
