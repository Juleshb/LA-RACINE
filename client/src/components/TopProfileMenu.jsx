import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { ROLE_LABELS } from '../config/permissions';
import { api } from '../lib/api';

export default function TopProfileMenu({ campusId }) {
  const { user, roleLabel, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const rootRef = useRef(null);

  const initial = `${(user?.firstName?.[0] || '').toUpperCase()}${(user?.lastName?.[0] || '').toUpperCase()}` || '?';
  const role = roleLabel || ROLE_LABELS[user?.role] || user?.role;

  useEffect(() => {
    let revoked = null;
    if (!user?.hasPhoto) {
      setPhotoUrl(null);
      return undefined;
    }
    api.getMyPhotoUrl().then((url) => {
      revoked = url;
      setPhotoUrl(url);
    }).catch(() => setPhotoUrl(null));
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [user?.id, user?.hasPhoto]);

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

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <div className="top-profile-menu" ref={rootRef}>
      <button
        type="button"
        className="top-profile-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={t('app.myProfile')}
      >
        <span className="top-profile-menu-avatar">
          {photoUrl ? <img src={photoUrl} alt="" className="w-full h-full object-cover" /> : initial}
        </span>
        <span className="top-profile-menu-text hidden sm:block">
          <span className="top-profile-menu-name">{user?.firstName} {user?.lastName}</span>
          <span className="top-profile-menu-role">{role}</span>
        </span>
        <ChevronDown className={`top-profile-menu-chevron w-4 h-4 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="top-profile-menu-panel" role="menu">
          <div className="top-profile-menu-head">
            <span className="top-profile-menu-head-avatar">
              {photoUrl ? <img src={photoUrl} alt="" className="w-full h-full object-cover" /> : initial}
            </span>
            <div className="min-w-0">
              <p className="top-profile-menu-head-name">{user?.firstName} {user?.lastName}</p>
              <p className="top-profile-menu-head-role">{role}</p>
            </div>
          </div>

          <Link
            to={`/campus/${campusId}/profile`}
            className="top-profile-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <User className="w-4 h-4" />
            {t('app.myProfile')}
          </Link>

          <button
            type="button"
            className="top-profile-menu-item top-profile-menu-signout"
            role="menuitem"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            {t('app.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}
