import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function DashQuickLink({ to, icon: Icon, label, badge }) {
  return (
    <Link to={to} className="dash-quick-link">
      <span className="dash-quick-link-icon">
        <Icon className="w-4 h-4" />
      </span>
      <span className="dash-quick-link-label">{label}</span>
      {badge > 0 && (
        <span className="dash-quick-link-badge">{badge > 9 ? '9+' : badge}</span>
      )}
      <ChevronRight className="dash-quick-link-chevron" aria-hidden />
    </Link>
  );
}
