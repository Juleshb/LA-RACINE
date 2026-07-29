import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, GraduationCap, LogOut, User } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { useStudentPhotoUrl } from '../../hooks/useStudentPhotoUrl';
import StudentAvatar from './StudentAvatar';

export default function StudentProfileMenu({ campusId, user }) {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState(null);
  const rootRef = useRef(null);
  const photoUrl = useStudentPhotoUrl(user?.role === 'STUDENT');

  useEffect(() => {
    api.getStudentDashboard()
      .then((r) => setStudent(r.student || null))
      .catch(() => setStudent(null));
  }, []);

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
    <div className="student-profile-menu" ref={rootRef}>
      <button
        type="button"
        className="student-profile-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <StudentAvatar
          photoUrl={photoUrl}
          firstName={user?.firstName}
          lastName={user?.lastName}
          variant="menu"
        />
        <span className="student-profile-menu-text hidden sm:block">
          <span className="student-profile-menu-name">{user?.firstName}</span>
          {student?.class?.name && (
            <span className="student-profile-menu-class">{student.class.name}</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-violet-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="student-profile-menu-panel" role="menu">
          <div className="student-profile-menu-head">
            <StudentAvatar
              photoUrl={photoUrl}
              firstName={user?.firstName}
              lastName={user?.lastName}
              variant="menuHead"
            />
            <div className="min-w-0">
              <p className="student-profile-menu-head-name">{user?.firstName}</p>
              {student?.class?.name && (
                <p className="student-profile-menu-head-class">
                  <GraduationCap className="w-3.5 h-3.5" />
                  {student.class.name}
                </p>
              )}
            </div>
          </div>

          <Link
            to={`/campus/${campusId}/profile`}
            className="student-profile-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <User className="w-4 h-4" />
            {t('profile.viewProfile')}
          </Link>

          <button type="button" className="student-profile-menu-item student-profile-menu-signout" role="menuitem" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
            {t('common.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}
