import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Calendar, ChevronDown, MapPin, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCampus } from '../context/CampusContext';
import { hasPermission, PERMISSIONS } from '../config/permissions';

export default function TopCampusMenu({ portalLabel, variant = 'default' }) {
  const { campus, academicYear, campusId } = useCampus();
  const { isManager, campuses, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const canManageYears = hasPermission(user?.role, PERMISSIONS.ACADEMIC_YEAR);
  const otherCampuses = (campuses || []).filter((c) => c.id !== campusId && c.isActive !== false);
  const canSwitch = isManager || otherCampuses.length > 0;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const goToCampus = (id) => {
    setOpen(false);
    navigate(`/campus/${id}`);
  };

  return (
    <div className={`top-campus-menu ${variant === 'student' ? 'top-campus-menu-student' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="top-campus-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Campus"
      >
        <span className="top-campus-menu-icon">
          <Building2 className="w-4 h-4" />
        </span>
        <span className="top-campus-menu-text min-w-0">
          {portalLabel && (
            <span className="top-campus-menu-kicker">{portalLabel}</span>
          )}
          <span className="top-campus-menu-name">{campus.name}</span>
          {academicYear && (
            <span className="top-campus-menu-year hidden md:inline">
              <Calendar className="w-3 h-3 inline-block -mt-px mr-1" />
              {academicYear.name}
            </span>
          )}
        </span>
        <ChevronDown className={`top-campus-menu-chevron w-4 h-4 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="top-campus-menu-panel" role="menu">
          <div className="top-campus-menu-head">
            <span className="top-campus-menu-head-icon">
              <Building2 className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              {portalLabel && (
                <p className="top-campus-menu-head-kicker">{portalLabel}</p>
              )}
              <p className="top-campus-menu-head-name">{campus.name}</p>
              <p className="top-campus-menu-head-meta">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {campus.city} · {campus.code}
              </p>
            </div>
          </div>

          <div className="top-campus-menu-section">
            <p className="top-campus-menu-section-label">Academic year</p>
            {academicYear ? (
              <p className="top-campus-menu-year-row">
                <Calendar className="w-4 h-4 text-brand-600 shrink-0" />
                <span>{academicYear.name}</span>
              </p>
            ) : (
              <p className="top-campus-menu-year-missing">No active academic year</p>
            )}
            {canManageYears && (
              <Link
                to={`/campus/${campusId}/academic-years`}
                className="top-campus-menu-link"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <Calendar className="w-4 h-4" />
                {academicYear ? 'Manage academic years' : 'Set academic year'}
              </Link>
            )}
          </div>

          {canSwitch && (
            <div className="top-campus-menu-section border-t border-gray-100">
              <p className="top-campus-menu-section-label">Campus</p>
              {isManager ? (
                <button
                  type="button"
                  className="top-campus-menu-link w-full"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    navigate('/campuses');
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Switch campus
                </button>
              ) : (
                otherCampuses.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="top-campus-menu-link w-full"
                    role="menuitem"
                    onClick={() => goToCampus(c.id)}
                  >
                    <Building2 className="w-4 h-4" />
                    {c.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
