export default function ModernStatCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  accent = 'brand',
}) {
  return (
    <div className={`dashboard-kpi dashboard-kpi-${accent}`}>
      <div className="dashboard-kpi-glow" aria-hidden="true" />
      <div className="dashboard-kpi-top">
        <div className="dashboard-kpi-icon">
          <Icon className="w-5 h-5" />
        </div>
        {trend != null && (
          <span className={`dashboard-kpi-trend ${trend >= 0 ? 'dashboard-kpi-trend-up' : 'dashboard-kpi-trend-down'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="dashboard-kpi-value">{value}</p>
      <p className="dashboard-kpi-label">{label}</p>
      {sub && <p className="dashboard-kpi-sub">{sub}</p>}
    </div>
  );
}
