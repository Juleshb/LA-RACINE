import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, ClipboardCheck, Award, BookOpen,
  Clock, Sparkles, Bus, Library, GraduationCap, Video, Bot,
} from 'lucide-react';
import { STUDENT_NAV_ITEMS } from '../../config/permissions';
import { translateStudentNavItem, useTranslation } from '../../context/LanguageContext';

const iconMap = {
  LayoutDashboard,
  MessageSquare,
  ClipboardCheck,
  Award,
  BookOpen,
  Clock,
  Sparkles,
  Bus,
  Library,
  GraduationCap,
  Video,
  Bot,
};

const TILE_STYLES = {
  LayoutDashboard: { bg: 'bg-sky-100', text: 'text-sky-700', ring: 'ring-sky-200' },
  MessageSquare: { bg: 'bg-violet-100', text: 'text-violet-700', ring: 'ring-violet-200' },
  ClipboardCheck: { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  Award: { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-200' },
  BookOpen: { bg: 'bg-rose-100', text: 'text-rose-700', ring: 'ring-rose-200' },
  Clock: { bg: 'bg-indigo-100', text: 'text-indigo-700', ring: 'ring-indigo-200' },
  Sparkles: { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', ring: 'ring-fuchsia-200' },
  Bus: { bg: 'bg-orange-100', text: 'text-orange-700', ring: 'ring-orange-200' },
  Library: { bg: 'bg-indigo-100', text: 'text-indigo-700', ring: 'ring-indigo-200' },
  GraduationCap: { bg: 'bg-violet-100', text: 'text-violet-700', ring: 'ring-violet-200' },
  Video: { bg: 'bg-cyan-100', text: 'text-cyan-700', ring: 'ring-cyan-200' },
  Bot: { bg: 'bg-teal-100', text: 'text-teal-700', ring: 'ring-teal-200' },
};

function NavTile({ to, icon, label, badge, end, variant = 'sidebar', isLive = false }) {
  const { t } = useTranslation();
  const Icon = iconMap[icon];
  const style = TILE_STYLES[icon] || TILE_STYLES.LayoutDashboard;
  const isBottom = variant === 'bottom';

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => [
        isBottom ? 'student-bottom-nav-item' : 'student-nav-tile',
        isActive ? 'student-nav-tile-active' : '',
        isLive ? 'student-nav-tile-live' : '',
      ].filter(Boolean).join(' ')}
    >
      <span className={`student-nav-tile-icon ${style.bg} ${style.text} ${style.ring} ${isLive ? 'student-nav-tile-icon-live' : ''}`}>
        <Icon className="w-6 h-6" aria-hidden />
        {isLive ? (
          <span className="student-nav-live-tag">{t('common.live')}</span>
        ) : badge > 0 ? (
          <span className="student-nav-badge">{badge > 9 ? '9+' : badge}</span>
        ) : null}
      </span>
      <span className="student-nav-tile-label">{label}</span>
    </NavLink>
  );
}

export function StudentSidebarNav({ campusId, badges = {} }) {
  const { t } = useTranslation();
  const items = STUDENT_NAV_ITEMS.map((item) => ({
    ...translateStudentNavItem(item, t),
    to: `/campus/${campusId}${item.to ? `/${item.to}` : ''}`,
    badge: item.to === 'communication' ? badges.messages || 0
      : item.to === 'homework' ? badges.homework || 0
        : item.to === 'online-classes' ? badges.upcomingClasses || 0
          : 0,
    isLive: item.to === 'online-classes' && badges.hasLiveClass,
  }));

  return (
    <nav className="student-sidebar-nav" aria-label="Student menu">
      <div className="student-nav-grid">
        {items.map((item) => (
          <NavTile
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.shortLabel || item.label}
            badge={item.badge}
            isLive={item.isLive}
            end={item.to === `/campus/${campusId}`}
            variant="sidebar"
          />
        ))}
      </div>
    </nav>
  );
}

export function StudentBottomNav({ campusId, badges = {} }) {
  const { t } = useTranslation();
  const primary = [
    STUDENT_NAV_ITEMS.find((i) => i.to === ''),
    STUDENT_NAV_ITEMS.find((i) => i.to === 'homework'),
    STUDENT_NAV_ITEMS.find((i) => i.to === 'ai-tutor'),
    STUDENT_NAV_ITEMS.find((i) => i.to === 'online-classes'),
    STUDENT_NAV_ITEMS.find((i) => i.to === 'e-learning'),
  ].filter(Boolean);

  return (
    <nav className="student-bottom-nav" aria-label={t('nav.myLearning')}>
      {primary.map((item) => {
        const translated = translateStudentNavItem(item, t);
        const to = `/campus/${campusId}${item.to ? `/${item.to}` : ''}`;
        const badge = item.to === 'communication' ? badges.messages || 0
          : item.to === 'homework' ? badges.homework || 0
            : item.to === 'online-classes' ? badges.upcomingClasses || 0
              : 0;
        const isLive = item.to === 'online-classes' && badges.hasLiveClass;
        return (
          <NavTile
            key={to}
            to={to}
            icon={item.icon}
            label={translated.shortLabel || translated.label}
            badge={badge}
            isLive={isLive}
            end={to === `/campus/${campusId}`}
            variant="bottom"
          />
        );
      })}
    </nav>
  );
}
