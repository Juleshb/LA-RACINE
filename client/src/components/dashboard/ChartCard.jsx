const feeStatusColors = {
  PENDING: 'badge-warning',
  PAID: 'badge-success',
  OVERDUE: 'badge-danger',
  WAIVED: 'badge-warning',
};

export { feeStatusColors };

export default function ChartCard({ title, description, children, action }) {
  return (
    <div className="dash-panel dash-chart-card">
      <div className="dash-panel-head">
        <div>
          <h3 className="dash-panel-title">{title}</h3>
          {description && <p className="dash-panel-desc">{description}</p>}
        </div>
        {action}
      </div>
      <div className="dash-chart-body">{children}</div>
    </div>
  );
}
