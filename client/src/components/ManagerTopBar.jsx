import AppTopBar from './AppTopBar';

export default function ManagerTopBar({ onOpenMenu, onToggleSidebar, sidebarCollapsed }) {
  return <AppTopBar onOpenMenu={onOpenMenu} onToggleSidebar={onToggleSidebar} sidebarCollapsed={sidebarCollapsed} />;
}
