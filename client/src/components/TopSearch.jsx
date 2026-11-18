import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCampus } from '../context/CampusContext';
import { translateAppNavItem, useTranslation } from '../context/LanguageContext';
import { getNavForRole, hasPermission, PERMISSIONS } from '../config/permissions';

const TYPE_LABEL = {
  en: {
    menu: 'Menu',
    student: 'Student',
    staff: 'Staff',
    parent: 'Parent',
    teacher: 'Teacher',
    class: 'Class',
    activity: 'Activity',
    transport: 'Transport',
    book: 'Library',
    article: 'Stock',
    receipt: 'Receipt',
    menus: 'Menus',
    people: 'People',
    services: 'Services',
    empty: 'No matches',
    placeholder: 'Search people, email, code, or a menu',
    hint: 'Search menus, people, and services',
    move: 'Move',
    open: 'Open',
    close: 'Close',
  },
  fr: {
    menu: 'Menu',
    student: 'Élève',
    staff: 'Personnel',
    parent: 'Parent',
    teacher: 'Enseignant',
    class: 'Classe',
    activity: 'Activité',
    transport: 'Transport',
    book: 'Bibliothèque',
    article: 'Stock',
    receipt: 'Reçu',
    menus: 'Menus',
    people: 'Personnes',
    services: 'Services',
    empty: 'Aucun résultat',
    placeholder: 'Chercher une personne, un e-mail, un code ou un menu',
    hint: 'Chercher un menu, une personne ou un service',
    move: 'Déplacer',
    open: 'Ouvrir',
    close: 'Fermer',
  },
};

const isMac = typeof navigator !== 'undefined'
  && /Mac|iPhone|iPad/.test(`${navigator.platform || ''} ${navigator.userAgent || ''}`);

function roleName(role) {
  return String(role || '').toLowerCase().replaceAll('_', ' ');
}

function canSeeResult(item, role, permissions) {
  const allow = (permission) => hasPermission(role, permission, permissions);
  if (item.type === 'menu') return true;
  if (item.type === 'student') return allow(PERMISSIONS.STUDENTS) || role === 'PARENT';
  if (item.type === 'staff' || item.type === 'parent') return allow(PERMISSIONS.USERS);
  if (item.type === 'teacher') return allow(PERMISSIONS.TEACHERS);
  if (item.type === 'class') return allow(PERMISSIONS.CLASSES);
  if (item.type === 'activity') return allow(PERMISSIONS.EXTRACURRICULAR);
  if (item.type === 'transport') return allow(PERMISSIONS.TRANSPORT);
  if (item.type === 'book') return allow(PERMISSIONS.LIBRARY);
  if (item.type === 'article') return allow(PERMISSIONS.INVENTORY) && role !== 'TEACHER';
  if (item.type === 'receipt') return allow(PERMISSIONS.FEES);
  return false;
}

export default function TopSearch() {
  const { user, permissions } = useAuth();
  const { campusId } = useCampus();
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const copy = language === 'fr' ? TYPE_LABEL.fr : TYPE_LABEL.en;
  const inputRef = useRef(null);
  const previousFocus = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState([]);
  const [active, setActive] = useState(0);
  const shortcut = isMac ? '⌘K' : 'Ctrl K';

  const menus = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!user || needle.length < 1) return [];
    return getNavForRole(user.role, campusId, permissions)
      .map((item) => {
        const translated = translateAppNavItem(item, user.role, t);
        return { ...translated, english: item.label };
      })
      .filter((item) => `${item.label} ${item.english} ${item.to}`.toLowerCase().includes(needle))
      .slice(0, 6)
      .map((item) => ({
        type: 'menu',
        id: item.to,
        title: item.label,
        detail: copy.menu,
        to: item.to,
      }));
  }, [query, user, campusId, permissions, t, copy.menu]);

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) {
      setRemote([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api.searchPortal(needle)
        .then((data) => { if (!cancelled) setRemote(data?.results || []); })
        .catch(() => { if (!cancelled) setRemote([]); });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const results = useMemo(() => {
    const visible = remote.filter((item) => canSeeResult(item, user?.role, permissions));
    const people = visible.filter((item) => ['student', 'staff', 'parent', 'teacher'].includes(item.type));
    const services = visible.filter((item) => !['student', 'staff', 'parent', 'teacher'].includes(item.type));
    return [
      ...menus,
      ...people,
      ...services,
    ];
  }, [menus, remote, user?.role, permissions]);

  useEffect(() => { setActive(0); }, [query]);

  const closeSpotlight = () => {
    setOpen(false);
    setQuery('');
    const node = previousFocus.current;
    if (node instanceof HTMLElement) node.focus();
  };

  const openSpotlight = () => {
    previousFocus.current = document.activeElement;
    setQuery('');
    setRemote([]);
    setOpen(true);
  };

  useEffect(() => {
    const onKey = (event) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      const command = event.metaKey || event.ctrlKey;
      if (!(command && key === 'k')) return;
      event.preventDefault();
      if (open) closeSpotlight();
      else openSpotlight();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`spotlight-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, results.length]);

  const destination = (item) => {
    if (item.to) return item.to;
    const base = `/campus/${campusId}`;
    const allow = (permission) => hasPermission(user?.role, permission, permissions);
    if (item.type === 'student' && allow(PERMISSIONS.STUDENTS)) return `${base}/students/${item.id}`;
    if (item.type === 'student' && allow(PERMISSIONS.FEES)) return `${base}/fees`;
    if (item.type === 'receipt' && allow(PERMISSIONS.FEES)) return `${base}/fees/${item.id}`;
    if ((item.type === 'staff' || item.type === 'parent') && allow(PERMISSIONS.USERS)) return `${base}/users`;
    if (item.type === 'teacher' && allow(PERMISSIONS.TEACHERS)) return `${base}/teachers`;
    if (item.type === 'class' && allow(PERMISSIONS.CLASSES)) return `${base}/classes`;
    if (item.type === 'activity' && allow(PERMISSIONS.EXTRACURRICULAR)) return `${base}/extracurricular`;
    if (item.type === 'transport' && allow(PERMISSIONS.TRANSPORT)) return `${base}/transport`;
    if (item.type === 'book' && allow(PERMISSIONS.LIBRARY)) return `${base}/library`;
    if (item.type === 'article' && allow(PERMISSIONS.INVENTORY) && user?.role !== 'TEACHER') return `${base}/inventory/articles`;
    return base;
  };

  const choose = (item) => {
    if (!item) return;
    setOpen(false);
    setQuery('');
    navigate(destination(item));
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSpotlight();
      return;
    }
    if (!results.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(results[active]);
    }
  };

  const groups = [
    { id: 'menus', label: copy.menus, items: results.filter((item) => item.type === 'menu') },
    { id: 'people', label: copy.people, items: results.filter((item) => ['student', 'staff', 'parent', 'teacher'].includes(item.type)) },
    { id: 'services', label: copy.services, items: results.filter((item) => !['menu', 'student', 'staff', 'parent', 'teacher'].includes(item.type)) },
  ].filter((group) => group.items.length);

  let cursor = -1;

  return (
    <div className="top-search">
      <button type="button" className="top-search-trigger" onClick={openSpotlight}>
        <Search className="top-search-icon" aria-hidden />
        <span>{copy.placeholder}</span>
        <kbd>{shortcut}</kbd>
      </button>
      {open && createPortal(
        <div className="spotlight-backdrop" onMouseDown={closeSpotlight}>
          <div
            className="spotlight"
            role="dialog"
            aria-modal="true"
            aria-label={copy.placeholder}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="spotlight-field">
              <Search aria-hidden />
              <input
                ref={inputRef}
                value={query}
                placeholder={copy.placeholder}
                aria-label={copy.placeholder}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
              />
              <kbd>esc</kbd>
            </div>
            <div className="spotlight-results" role="listbox">
              {!query.trim() && <p className="top-search-empty">{copy.hint}</p>}
              {query.trim() && !groups.length && <p className="top-search-empty">{copy.empty}</p>}
              {groups.map((group) => (
                <div key={group.id}>
                  <p className="top-search-group">{group.label}</p>
                  {group.items.map((item) => {
                    cursor += 1;
                    const index = cursor;
                    const kind = copy[item.type] || item.type;
                    const extra = item.role ? roleName(item.role) : '';
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        id={`spotlight-option-${index}`}
                        type="button"
                        role="option"
                        aria-selected={index === active}
                        className={`top-search-item${index === active ? ' is-active' : ''}`}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => choose(item)}
                      >
                        <span className="top-search-kind">{kind}</span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>{[extra, item.detail].filter(Boolean).join(' · ')}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="spotlight-foot">
              <span>↑↓ {copy.move}</span>
              <span>↩ {copy.open}</span>
              <span>esc {copy.close}</span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
