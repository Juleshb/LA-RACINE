import { Link } from 'react-router-dom';
import AppIcon from '../icons/AppIcon';
import { useTranslation } from '../../context/LanguageContext';

export default function StudentLiveClassBanner({ campusId, session }) {
  const { t } = useTranslation();
  if (!session) return null;

  const isLive = session.status === 'live';

  return (
    <div className="student-live-banner" role="status" aria-live="polite">
      <Link
        to={`/campus/${campusId}/online-classes?join=${session.id}`}
        className="student-live-banner-btn"
      >
        <span className={`student-live-badge ${isLive ? 'student-live-badge-now' : ''}`}>
          {isLive ? t('common.live') : t('common.startingSoon')}
        </span>
        <span className="student-live-banner-title">{session.title}</span>
        <span className="student-live-banner-cta">
          {t('common.joinNow')}
          <AppIcon name="video" className="w-5 h-5" />
        </span>
      </Link>
    </div>
  );
}
