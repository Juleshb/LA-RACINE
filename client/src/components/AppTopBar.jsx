import { Menu } from 'lucide-react';
import { useCampus } from '../context/CampusContext';
import { useTranslation } from '../context/LanguageContext';
import TopCampusMenu from './TopCampusMenu';
import TopProfileMenu from './TopProfileMenu';
import LanguageSwitcher from './LanguageSwitcher';
import PortalThemeToggle from './PortalThemeToggle';

export default function AppTopBar({ portalLabel, onOpenMenu }) {
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
      <TopCampusMenu portalLabel={portalLabel} />
      <div className="manager-topbar-actions">
        <PortalThemeToggle />
        <LanguageSwitcher tone="app" />
        <TopProfileMenu campusId={campusId} />
      </div>
    </header>
  );
}
