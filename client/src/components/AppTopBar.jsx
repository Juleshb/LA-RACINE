import { useCampus } from '../context/CampusContext';
import TopCampusMenu from './TopCampusMenu';
import TopProfileMenu from './TopProfileMenu';
import LanguageSwitcher from './LanguageSwitcher';

export default function AppTopBar({ portalLabel }) {
  const { campusId } = useCampus();

  return (
    <header className="manager-topbar">
      <TopCampusMenu portalLabel={portalLabel} />
      <div className="manager-topbar-actions">
        <LanguageSwitcher tone="app" />
        <TopProfileMenu campusId={campusId} />
      </div>
    </header>
  );
}
