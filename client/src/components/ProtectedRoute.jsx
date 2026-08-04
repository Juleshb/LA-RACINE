import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../config/permissions';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && location.pathname !== '/set-new-password') {
    return <Navigate to="/set-new-password" replace />;
  }
  return <Outlet />;
}

export function PublicRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (user) {
    if (user.mustChangePassword) return <Navigate to="/set-new-password" replace />;
    return <Navigate to="/app" replace />;
  }
  return <Outlet />;
}

export function RequirePermission({ permission, denyRoles = [], children }) {
  const { user } = useAuth();
  if (denyRoles.includes(user?.role) || !hasPermission(user.role, permission)) {
    return <Navigate to="/app" replace />;
  }
  return children;
}
