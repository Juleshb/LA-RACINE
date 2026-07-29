import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Library, GraduationCap, Video, LogOut,
} from 'lucide-react';
import { STUDENT_NAV_ITEMS } from '../../config/permissions';
import { translateStudentNavItem, useTranslation } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import AppIcon from '../icons/AppIcon';

const iconMap = {
  LayoutDashboard,
  BookOpen,
  Library,
  GraduationCap,
  Video,
};

const NAV_ACCENTS = {
  LayoutDashboard: 'student-side-item-sky',
  BookOpen: 'student-side-item-rose',
  Video: 'student-side-item-cyan',
  Library: 'student-side-item-indigo',
  GraduationCap: 'student-side-item-violet',
};

function SidebarNavItem({ to, icon, label, badge, isLive, end }) {
  const { t } = useTranslation();
  const Icon = iconMap[icon] || LayoutDashboard;
  const accent = NAV_ACCENTS[icon] || 'student-side-item-sky';

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => [
        'student-side-item',
        accent,
        isActive ? 'student-side-item-active' : '',
        isLive ? 'student-side-item-live' : '',
      ].filter(Boolean).join(' ')}
    >
      <span className="student-side-item-icon">
        <Icon className="w-5 h-5" aria-hidden />
        {isLive ? (
          <span className="student-side-live-dot" aria-label={t('common.live')} />
        ) : badge > 0 ? (
          <span className="student-side-badge">{badge > 9 ? '9+' : badge}</span>
        ) : null}
      </span>
      <span className="student-side-item-label">{label}</span>
      {isLive && <span className="student-side-live-tag">{t('common.live')}</span>}
    </NavLink>
  );
}

export default function StudentSidebar({ campusId, badges = {} }) {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const home = `/campus/${campusId}`;

  const items = STUDENT_NAV_ITEMS.map((item) => {
    const translated = translateStudentNavItem(item, t);
    return {
      ...translated,
      icon: item.icon,
      to: `${home}${item.to ? `/${item.to}` : ''}`,
      badge: item.to === 'homework' ? badges.homework || 0
        : item.to === 'online-classes' ? badges.upcomingClasses || 0
          : 0,
      isLive: item.to === 'online-classes' && badges.hasLiveClass,
      end: item.to === '',
    };
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="student-sidebar hidden lg:flex">
      <div className="student-sidebar-brand">
        <img src="/logo.png" alt="" className="student-sidebar-brand-logo" />
        <div className="min-w-0">
          <p className="student-sidebar-brand-kicker">
            <AppIcon name="learning" className="w-3.5 h-3.5" />
            {t('school.mySchool')}
          </p>
          <p className="student-sidebar-brand-name">{t('school.schoolName')}</p>
        </div>
      </div>

      <nav className="student-sidebar-menu" aria-label={t('nav.myLearning')}>
        <p className="student-sidebar-menu-title">{t('nav.myLearning')}</p>
        <div className="student-sidebar-menu-list">
          {items.map((item) => (
            <SidebarNavItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              badge={item.badge}
              isLive={item.isLive}
              end={item.end}
            />
          ))}
        </div>
      </nav>

      <div className="student-sidebar-footer">
        <button type="button" onClick={handleLogout} className="student-sidebar-signout">
          <LogOut className="w-[18px] h-[18px]" />
          {t('common.signOut')}
        </button>
      </div>
    </aside>
  );
}
