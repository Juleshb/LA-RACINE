import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

function isItemActive(itemTo, pathname) {
  if (pathname === itemTo) return true;
  const isDashboard = /^\/campus\/[^/]+$/.test(itemTo);
  if (isDashboard) return false;
  return pathname.startsWith(`${itemTo}/`);
}

export function findActiveGroupId(groups, pathname) {
  const match = groups.find((group) =>
    group.items.some((item) => isItemActive(item.to, pathname) || pathname === item.to),
  );
  return match?.id || null;
}

export function useNavGroupCollapse(groups, storageKey) {
  const { pathname } = useLocation();
  const activeGroupId = useMemo(() => findActiveGroupId(groups, pathname), [groups, pathname]);

  const readStored = () => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch {
      return {};
    }
  };

  const [collapsed, setCollapsed] = useState(readStored);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(collapsed));
  }, [collapsed, storageKey]);

  const isExpanded = (groupId) => {
    if (activeGroupId === groupId) return true;
    if (collapsed[groupId] === true) return false;
    if (collapsed[groupId] === false) return true;
    return groupId === groups[0]?.id;
  };

  const toggleGroup = (groupId) => {
    if (activeGroupId === groupId) return;
    setCollapsed((prev) => ({
      ...prev,
      [groupId]: isExpanded(groupId),
    }));
  };

  return { isExpanded, toggleGroup, activeGroupId };
}

export default function SidebarNavGroup({
  group,
  isExpanded,
  onToggle,
  isActiveGroup,
  children,
}) {
  const expanded = isExpanded(group.id);

  return (
    <div className={`nav-group ${expanded ? 'nav-group-expanded' : 'nav-group-collapsed'}`}>
      <button
        type="button"
        className={`nav-group-toggle ${isActiveGroup ? 'nav-group-toggle-active' : ''}`}
        onClick={() => onToggle(group.id)}
        aria-expanded={expanded}
        aria-controls={`nav-group-${group.id}`}
      >
        <ChevronDown
          className={`nav-group-chevron w-4 h-4 shrink-0 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
          aria-hidden
        />
        <span className="nav-group-toggle-label">{group.title}</span>
        {!expanded && (
          <span className="nav-group-count" aria-hidden>
            {group.items.length}
          </span>
        )}
      </button>

      <div
        id={`nav-group-${group.id}`}
        className="nav-group-panel"
        aria-hidden={!expanded}
      >
        <div className="nav-group-panel-inner space-y-0.5">
          {children}
        </div>
      </div>
    </div>
  );
}
