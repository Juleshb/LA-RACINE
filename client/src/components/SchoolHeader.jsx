import AppTopBar from './AppTopBar';

export default function SchoolHeader({ portalLabel = 'Campus', onOpenMenu, onToggleSidebar, sidebarCollapsed }) {
  return <AppTopBar portalLabel={portalLabel} onOpenMenu={onOpenMenu} onToggleSidebar={onToggleSidebar} sidebarCollapsed={sidebarCollapsed} />;
}
