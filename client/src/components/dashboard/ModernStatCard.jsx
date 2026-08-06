export default function ModernStatCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  accent = 'brand',
  index = 0,
}) {
  return (
    <div
      className={`dash-metric dash-metric-${accent}`}
      style={{ '--dash-delay': `${index * 70}ms` }}
    >
      <div className="dash-metric-icon">
        <Icon className="w-4 h-4" />
      </div>
      <div className="dash-metric-copy">
        <p className="dash-metric-label">{label}</p>
        <p className="dash-metric-value">{value}</p>
        {sub && <p className="dash-metric-sub">{sub}</p>}
      </div>
      {trend != null && (
        <span className={`dash-metric-trend ${trend >= 0 ? 'is-up' : 'is-down'}`}>
          {trend >= 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
  );
}
