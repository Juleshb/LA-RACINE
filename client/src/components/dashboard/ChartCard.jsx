const feeStatusColors = {
  PENDING: 'badge-warning',
  PAID: 'badge-success',
  OVERDUE: 'badge-danger',
  WAIVED: 'badge-warning',
};

export { feeStatusColors };

export default function ChartCard({ title, description, children, action }) {
  return (
    <div className="dashboard-chart-card">
      <div className="dashboard-chart-header">
        <div>
          <h3 className="dashboard-chart-title">{title}</h3>
          {description && <p className="dashboard-chart-desc">{description}</p>}
        </div>
        {action}
      </div>
      <div className="dashboard-chart-body">{children}</div>
    </div>
  );
}
