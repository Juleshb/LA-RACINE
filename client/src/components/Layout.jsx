import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, School, Users, GraduationCap, BookOpen, BookMarked, Award,
  ClipboardCheck, Wallet, Shield, LogOut, ChevronRight,
  Library, Clock, FileText, Sparkles, Bus, MessageSquare, ClipboardList, Video, Calendar, BarChart3, Globe,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCampus } from '../context/CampusContext';
import { useTranslation, translateAppNavItem, translateAppNavGroup } from '../context/LanguageContext';
import { getNavForRole, getNavGroupsForRole, hasPermission, PERMISSIONS } from '../config/permissions';
import SidebarNavGroup, { useNavGroupCollapse } from './SidebarNavGroup';
import SchoolHeader from './SchoolHeader';
import ManagerTopBar from './ManagerTopBar';
import Logo from './Logo';
import AcademicYearBanner from './AcademicYearBanner';
import { StudentBottomNav } from './student/StudentPortalNav';
import StudentNavbar from './student/StudentNavbar';
import StudentSidebar from './student/StudentSidebar';
import StudentLiveClassBanner from './student/StudentLiveClassBanner';
import { useLiveOnlineClasses } from '../hooks/useLiveOnlineClasses';

const iconMap = {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  BookMarked,
  Award,
  ClipboardCheck,
  Wallet,
  School,
  Shield,
  Calendar,
  Library,
  Clock,
  FileText,
  Sparkles,
  Bus,
  MessageSquare,
  ClipboardList,
  Video,
  BarChart3,
  Globe,
};

function NavItem({ to, icon, label, campusId, end, badge }) {
  const Icon = iconMap[icon];
  return (
    <NavLink
      to={to}
      end={end ?? to === `/campus/${campusId}`}
      className={({ isActive }) => `group nav-item ${isActive ? 'nav-item-active' : ''}`}
    >
      <Icon className="w-[18px] h-[18px] shrink-0" />
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-40 nav-chevron" />
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout, isManager } = useAuth();
  const { campus, campusId, academicYear } = useCampus();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isParent = user?.role === 'PARENT';
  const isTeacher = user?.role === 'TEACHER';
  const isStudent = user?.role === 'STUDENT';
  const isStaff = ['SCHOOL_MANAGER', 'SECRETARY', 'HEAD_OF_STUDIES', 'HEAD_OF_DISCIPLINE', 'ACCOUNTANT', 'LIBRARIAN'].includes(user?.role);
  const rawNavGroups = getNavGroupsForRole(user.role, campusId);
  const navGroups = rawNavGroups?.length
    ? rawNavGroups.map((group) => ({
      ...translateAppNavGroup(group, user.role, t),
      items: group.items.map((item) => translateAppNavItem(item, user.role, t)),
    }))
    : null;
  const navItems = navGroups?.length
    ? []
    : getNavForRole(user.role, campusId).map((item) => translateAppNavItem(item, user.role, t));
  const { isExpanded, toggleGroup, activeGroupId } = useNavGroupCollapse(
    navGroups || [],
    `laracine_nav_groups_${user?.role || 'guest'}`,
  );
  const [commUnread, setCommUnread] = useState(0);
  const { primaryLive, hasLiveClass, upcomingSessions } = useLiveOnlineClasses(
    isStudent && Boolean(campusId),
  );
  const studentNavBadges = {
    messages: commUnread,
    hasLiveClass,
    upcomingClasses: upcomingSessions.length,
  };

  useEffect(() => {
    if (!campusId || !hasPermission(user?.role, PERMISSIONS.COMMUNICATION)) return;
    api.getCommunicationUnreadCount()
      .then((r) => setCommUnread(r?.count ?? 0))
      .catch(() => setCommUnread(0));
    const t = setInterval(() => {
      api.getCommunicationUnreadCount()
        .then((r) => setCommUnread(r?.count ?? 0))
        .catch(() => {});
    }, 60000);
    return () => clearInterval(t);
  }, [campusId, user?.role]);

  const commBadge = (to) => (to?.includes('/communication') ? commUnread : 0);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`min-h-screen flex ${isStudent ? 'student-portal-layout bg-gradient-to-b from-violet-50/80 to-sky-50/50' : 'bg-gray-50'}`}>
      {isStudent ? (
        <StudentSidebar
          campusId={campusId}
          badges={studentNavBadges}
        />
      ) : (
      <aside className={`sidebar ${isManager ? 'sidebar-manager' : ''} ${isStaff && !isManager ? 'sidebar-staff' : ''} ${isParent ? 'sidebar-parent' : ''} ${isTeacher ? 'sidebar-teacher' : ''}`}>
        <div className="sidebar-brand">
          <Logo size="sm" showSubtitle />
        </div>

        <nav className="sidebar-nav" aria-label={t('app.mainNav')}>
          {navGroups?.length > 0 ? (
            navGroups.map((group) => (
              <SidebarNavGroup
                key={group.id}
                group={group}
                isExpanded={isExpanded}
                onToggle={toggleGroup}
                isActiveGroup={activeGroupId === group.id}
              >
                {group.items.map(({ to, icon, label }) => (
                  <NavItem key={to} to={to} icon={icon} label={label} campusId={campusId} badge={commBadge(to)} />
                ))}
              </SidebarNavGroup>
            ))
          ) : (
            <div className="space-y-0.5 px-2">
              {navItems.map(({ to, icon, label }) => (
                <NavItem key={to} to={to} icon={icon} label={label} campusId={campusId} badge={commBadge(to)} />
              ))}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <button
            onClick={handleLogout}
            className="nav-item w-full text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="w-[18px] h-[18px]" />
            {t('app.signOut')}
          </button>
        </div>
      </aside>
      )}

      <main className={`flex-1 flex flex-col min-w-0 ${isStudent ? 'student-main lg:ml-64' : 'ml-64'}`}>
        {isStudent ? (
          <StudentNavbar campus={campus} campusId={campusId} user={user} academicYear={academicYear} />
        ) : isManager ? (
          <ManagerTopBar />
        ) : (
          <SchoolHeader
            portalLabel={isParent ? t('app.familyPortal') : isTeacher ? t('app.teacherPortal') : t('app.campus')}
          />
        )}
        <div className={`flex-1 overflow-auto ${isStudent ? 'student-main-content p-4 sm:p-6 lg:p-8' : 'p-6 lg:p-8'}`}>
          {!isStudent && <AcademicYearBanner />}
          <Outlet />
        </div>
        {isStudent && (
          <StudentLiveClassBanner campusId={campusId} session={primaryLive} />
        )}
        {isStudent && (
          <StudentBottomNav campusId={campusId} badges={studentNavBadges} />
        )}
      </main>
    </div>
  );
}
