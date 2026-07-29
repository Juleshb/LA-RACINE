import { Link } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import StudentProfileMenu from './StudentProfileMenu';
import TopCampusMenu from '../TopCampusMenu';
import AppIcon from '../icons/AppIcon';

export default function StudentNavbar({ campus, campusId, user, academicYear }) {
  const { t } = useTranslation();
  const home = `/campus/${campusId}`;

  return (
    <header className="student-navbar">
      <div className="student-navbar-inner">
        <Link to={home} className="student-navbar-brand lg:hidden">
          <img src="/logo.png" alt="" className="student-navbar-logo" />
          <div className="min-w-0">
            <p className="student-navbar-kicker">
              <AppIcon name="learning" className="w-3.5 h-3.5" />
              {t('school.mySchool')}
            </p>
            <p className="student-navbar-title">{t('school.schoolName')}</p>
          </div>
        </Link>

        <div className="student-navbar-campus hidden lg:block lg:mr-auto">
          <TopCampusMenu portalLabel={t('school.mySchool')} variant="student" />
        </div>

        <div className="student-navbar-actions lg:ml-0">
          <LanguageSwitcher />
          <StudentProfileMenu campusId={campusId} user={user} />
        </div>
      </div>

      <div className="student-navbar-mobile-meta lg:hidden">
        <p className="truncate text-xs font-semibold text-violet-800">{campus?.name}</p>
        {academicYear?.name && (
          <p className="truncate text-[11px] text-violet-600">{academicYear.name}</p>
        )}
      </div>
    </header>
  );
}
