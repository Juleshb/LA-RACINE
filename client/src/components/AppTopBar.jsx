import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useCampus } from '../context/CampusContext';
import { useTranslation } from '../context/LanguageContext';
import TopCampusMenu from './TopCampusMenu';
import TopSearch from './TopSearch';
import TopProfileMenu from './TopProfileMenu';
import LanguageSwitcher from './LanguageSwitcher';
import PortalThemeToggle from './PortalThemeToggle';

export default function AppTopBar({ portalLabel, onOpenMenu, onToggleSidebar, sidebarCollapsed = false }) {
  const { campusId } = useCampus();
  const { t } = useTranslation();

  return (
    <header className="manager-topbar">
      {onOpenMenu && (
        <button
          type="button"
          className="app-menu-btn lg:hidden"
          onClick={onOpenMenu}
          aria-label={t('app.openMenu')}
        >
          <Menu className="w-5 h-5" />
        </button>
      )}
      {onToggleSidebar && (
        <button
          type="button"
          className="app-menu-btn hidden lg:inline-flex"
          onClick={onToggleSidebar}
          aria-pressed={sidebarCollapsed}
          aria-label={sidebarCollapsed ? t('app.expandSidebar') : t('app.collapseSidebar')}
          title={sidebarCollapsed ? t('app.expandSidebar') : t('app.collapseSidebar')}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>
      )}
      <TopCampusMenu portalLabel={portalLabel} />
      <TopSearch />
      <div className="manager-topbar-actions">
        <PortalThemeToggle />
        <LanguageSwitcher tone="app" />
        <TopProfileMenu campusId={campusId} />
      </div>
    </header>
  );
}
