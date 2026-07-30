import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import Logo from './Logo';
import Profile from '../pages/Profile';

export default function ProfileShell() {
  const { user, defaultCampusId } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const campusId = user?.campusId || defaultCampusId || localStorage.getItem('campusId');

  return (
    <div className="profile-shell">
      <header className="profile-shell-header">
        <div className="profile-shell-header-inner">
          <Logo size="sm" showSubtitle={false} />
          {campusId ? (
            <Link to={`/campus/${campusId}`} className="profile-shell-back">
              <ArrowLeft className="w-4 h-4" aria-hidden />
              {t('ui.backToPortal')}
            </Link>
          ) : (
            <button type="button" onClick={() => navigate('/campuses')} className="profile-shell-back">
              <ArrowLeft className="w-4 h-4" aria-hidden />
              {t('ui.backToCampuses')}
            </button>
          )}
        </div>
      </header>
      <main className="profile-shell-main">
        <Profile />
      </main>
    </div>
  );
}
