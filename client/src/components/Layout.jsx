import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, School, Users, GraduationCap, BookOpen, BookMarked, Award,
  ClipboardCheck, Wallet, Shield, LogOut, ChevronRight, Scale, PanelLeftClose, PanelLeftOpen,
  Library, Clock, FileText, Sparkles, Bus, MessageSquare, ClipboardList, Video, Calendar, BarChart3,   Globe, CreditCard, Bot, FlaskConical, Megaphone, Package,
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
import InstallPortalApp from './InstallPortalApp';
import StudentNavbar from './student/StudentNavbar';
import PortalEduField from './PortalEduField';
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
  Scale,
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
  CreditCard,
  Bot,
  FlaskConical,
  Megaphone,
  Package,
};

function NavItem({ to, icon, label, campusId, end, badge, onNavigate }) {
  const Icon = iconMap[icon];
  return (
    <NavLink
      to={to}
      end={end ?? to === `/campus/${campusId}`}
      onClick={onNavigate}
      title={label}
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
  const { user, logout, isManager, permissions, setCampusPermissions } = useAuth();
  const { campus, campusId, academicYear } = useCampus();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isParent = user?.role === 'PARENT';
  const isTeacher = user?.role === 'TEACHER';
  const isStudent = user?.role === 'STUDENT';
  const isAiTutor = isStudent && /\/ai-tutor\/?$/.test(location.pathname);
  const isStaff = ['SCHOOL_MANAGER', 'SCHOOL_ADMIN', 'SECRETARY', 'HEAD_OF_STUDIES', 'HEAD_OF_DISCIPLINE', 'ACCOUNTANT', 'ACTIVITIES_MANAGER', 'LIBRARIAN', 'INVENTORY_MANAGER'].includes(user?.role);
  const rawNavGroups = getNavGroupsForRole(user.role, campusId, permissions);
  const navGroups = rawNavGroups?.length
    ? rawNavGroups.map((group) => ({
      ...translateAppNavGroup(group, user.role, t),
      items: group.items.map((item) => translateAppNavItem(item, user.role, t)),
    }))
    : null;
  const navItems = navGroups?.length
    ? []
    : getNavForRole(user.role, campusId, permissions).map((item) => translateAppNavItem(item, user.role, t));
  const { isExpanded, toggleGroup, activeGroupId } = useNavGroupCollapse(
    navGroups || [],
    `laracine_nav_groups_${user?.role || 'guest'}`,
  );
  const [commUnread, setCommUnread] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('laracine_sidebar_rail') !== '0';
    } catch {
      return true;
    }
  });
  const sidebarRail = sidebarCollapsed && !navOpen;
  const [railDismissed, setRailDismissed] = useState(false);
  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      try { localStorage.setItem('laracine_sidebar_rail', next ? '1' : '0'); } catch { /* keep the choice for this visit */ }
      return next;
    });
  };
  const { primaryLive, hasLiveClass, upcomingSessions } = useLiveOnlineClasses(
    isStudent && Boolean(campusId),
  );
  const studentNavBadges = {
    messages: commUnread,
    hasLiveClass,
    upcomingClasses: upcomingSessions.length,
  };

  useEffect(() => {
    if (!campusId || !user) return undefined;
    let cancelled = false;
    api.getMyAccess()
      .then((data) => {
        if (!cancelled && Array.isArray(data?.permissions)) setCampusPermissions(data.permissions);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [campusId, user?.id, user?.role, setCampusPermissions]);

  useEffect(() => {
    if (!campusId || !hasPermission(user?.role, PERMISSIONS.COMMUNICATION, permissions)) return;
    api.getCommunicationUnreadCount()
      .then((r) => setCommUnread(r?.count ?? 0))
      .catch(() => setCommUnread(0));
    const t = setInterval(() => {
      api.getCommunicationUnreadCount()
        .then((r) => setCommUnread(r?.count ?? 0))
        .catch(() => {});
    }, 60000);
    return () => clearInterval(t);
  }, [campusId, user?.role, permissions]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  const commBadge = (to) => (to?.includes('/communication') ? commUnread : 0);

  const chooseMenu = () => {
    setNavOpen(false);
    setSidebarCollapsed(true);
    setRailDismissed(true);
    try { localStorage.setItem('laracine_sidebar_rail', '1'); } catch { /* keep the choice for this visit */ }
    const focused = document.activeElement;
    if (focused instanceof HTMLElement) focused.blur();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`portal-shell min-h-screen flex ${isStudent ? 'student-portal-layout' : ''}`}>
      {isStudent ? (
        <StudentSidebar
          campusId={campusId}
          badges={studentNavBadges}
        />
      ) : (
      <>
      {navOpen && (
        <button
          type="button"
          className="sidebar-scrim lg:hidden"
          aria-label={t('app.closeMenu')}
          onClick={() => setNavOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${navOpen ? 'is-open' : ''} ${sidebarRail ? 'is-collapsed' : ''} ${railDismissed ? 'is-rail-dismissed' : ''} ${isManager ? 'sidebar-manager' : ''} ${isStaff && !isManager ? 'sidebar-staff' : ''} ${isParent ? 'sidebar-parent' : ''} ${isTeacher ? 'sidebar-teacher' : ''}`}
        onMouseLeave={() => setRailDismissed(false)}
      >
        <div className="sidebar-brand">
          <Logo size="sm" showSubtitle />
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={toggleSidebar}
            aria-pressed={sidebarCollapsed}
            aria-label={sidebarCollapsed ? t('app.expandSidebar') : t('app.collapseSidebar')}
            title={sidebarCollapsed ? t('app.expandSidebar') : t('app.collapseSidebar')}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
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
                  <NavItem key={to} to={to} icon={icon} label={label} campusId={campusId} badge={commBadge(to)} onNavigate={chooseMenu} />
                ))}
              </SidebarNavGroup>
            ))
          ) : (
            <div className="space-y-0.5 px-2">
              {navItems.map(({ to, icon, label }) => (
                <NavItem key={to} to={to} icon={icon} label={label} campusId={campusId} badge={commBadge(to)} onNavigate={chooseMenu} />
              ))}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <InstallPortalApp />
          <button
            onClick={handleLogout}
            title={t('app.signOut')}
            className="nav-item w-full text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span className="flex-1">{t('app.signOut')}</span>
          </button>
        </div>
      </aside>
      </>
      )}

      <main className={`flex-1 flex flex-col min-w-0 ${isStudent ? 'student-main lg:ml-64' : 'lg:ml-64'}${!isStudent && sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
        {isStudent ? (
          <StudentNavbar campus={campus} campusId={campusId} user={user} academicYear={academicYear} />
        ) : isManager ? (
          <ManagerTopBar onOpenMenu={() => setNavOpen(true)} onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
        ) : (
          <SchoolHeader
            portalLabel={isParent ? t('app.familyPortal') : isTeacher ? t('app.teacherPortal') : t('app.campus')}
            onOpenMenu={() => setNavOpen(true)}
            onToggleSidebar={toggleSidebar}
            sidebarCollapsed={sidebarCollapsed}
          />
        )}
        <div
          className={`portal-workspace flex-1 overflow-auto ${
            isStudent ? 'student-main-content p-3 sm:p-6 lg:p-8' : 'p-3 sm:p-6 lg:p-8'
          }${isAiTutor ? ' is-ai-tutor-shell' : ''}`}
        >
          <PortalEduField />
          {!isStudent && <AcademicYearBanner />}
          <Outlet />
        </div>
        {isStudent && (
          <StudentLiveClassBanner campusId={campusId} session={primaryLive} />
        )}
        {isStudent && (
          <StudentBottomNav campusId={campusId} badges={studentNavBadges} />
        )}
        {!isStudent && !isParent && campusId && !location.pathname.endsWith('/ask-ai') && (
          <NavLink to={`/campus/${campusId}/ask-ai`} className="ask-racine-launcher">
            <Bot className="w-4 h-4" aria-hidden />
            {t('app.askAi.title')}
          </NavLink>
        )}
      </main>
    </div>
  );
}
