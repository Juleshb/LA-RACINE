import AppTopBar from './AppTopBar';

export default function SchoolHeader({ portalLabel = 'Campus', onOpenMenu }) {
  return <AppTopBar portalLabel={portalLabel} onOpenMenu={onOpenMenu} />;
}
