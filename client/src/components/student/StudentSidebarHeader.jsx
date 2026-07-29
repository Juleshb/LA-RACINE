import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, GraduationCap } from 'lucide-react';
import { api } from '../../lib/api';
import AppIcon from '../icons/AppIcon';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from '../../context/LanguageContext';

export default function StudentSidebarHeader({ campus, academicYear, campusId, user }) {
  const { t } = useTranslation();
  const [student, setStudent] = useState(null);

  useEffect(() => {
    api.getStudentDashboard()
      .then((result) => setStudent(result.student || null))
      .catch(() => setStudent(null));
  }, []);

  const initial = (user.firstName?.[0] || '?').toUpperCase();

  return (
    <div className="student-sidebar-header">
      <div className="student-sidebar-school">
        <div className="student-sidebar-school-logo-wrap">
          <img src="/logo.png" alt="" className="student-sidebar-school-logo" />
        </div>
        <div className="student-sidebar-school-text">
          <p className="student-sidebar-school-kicker">
            <AppIcon name="learning" className="w-4 h-4" />
            {t('school.mySchool')}
          </p>
          <p className="student-sidebar-school-name">{t('school.schoolName')}</p>
          <p className="student-sidebar-campus">{campus.name}</p>
          {academicYear && (
            <p className="student-sidebar-year">{academicYear.name}</p>
          )}
        </div>
      </div>

      <div className="student-sidebar-lang">
        <LanguageSwitcher compact />
      </div>

      <Link
        to={`/campus/${campusId}/profile`}
        className="student-sidebar-profile"
        title={t('school.studentProfile')}
      >
        <div className="student-sidebar-profile-avatar" aria-hidden>
          <span>{initial}</span>
          <span className="student-sidebar-profile-badge">
            <AppIcon name="star" className="w-3 h-3" />
          </span>
        </div>
        <div className="student-sidebar-profile-body">
          <p className="student-sidebar-profile-name">{user.firstName}</p>
          {student?.class?.name ? (
            <p className="student-sidebar-profile-class">
              <GraduationCap className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{student.class.name}</span>
            </p>
          ) : (
            <p className="student-sidebar-profile-hint">{t('school.studentProfile')}</p>
          )}
        </div>
        <ChevronRight className="student-sidebar-profile-chevron" aria-hidden />
      </Link>
    </div>
  );
}
