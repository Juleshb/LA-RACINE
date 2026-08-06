import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import AppIcon from '../../components/icons/AppIcon';
import { PublicSiteProvider, usePublicSite } from '../../hooks/usePublicSite';
import SupportChatWidget from './SupportChatWidget';
import '../../styles/public-site.css';

const DEFAULT_SOCIALS = [
  { id: 'whatsapp', label: 'WhatsApp', url: 'https://whatsapp.com/channel/0029VbCh7bC84OmJQtxceY38' },
  { id: 'x', label: 'X', url: 'https://x.com/LaRacine64' },
  { id: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@ecole.la.racine' },
  { id: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/share/196zUK2Wip/' },
  { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/ecolelaracine_gisenyi' },
  { id: 'youtube', label: 'YouTube', url: 'https://youtu.be/MAf3va2bK5w' },
];

const GROUP_FALLBACKS = {
  en: {
    school: 'School',
    life: 'School life',
    announcements: 'Announcements',
    news: 'News',
    events: 'Events',
    gallery: 'Gallery',
  },
  fr: {
    school: 'École',
    life: 'Vie scolaire',
    announcements: 'Annonces',
    news: 'Actualités',
    events: 'Événements',
    gallery: 'Galerie',
  },
  sw: {
    school: 'Shule',
    life: 'Maisha ya shule',
    announcements: 'Matangazo',
    news: 'Habari',
    events: 'Matukio',
    gallery: 'Picha',
  },
  rw: {
    school: 'Ishuri',
    life: 'Ubuzima bw’ishuri',
    announcements: 'Amatangazo',
    news: 'Amakuru',
    events: 'Ibikorwa',
    gallery: 'Amafoto',
  },
};

function labelFor(nav, locale, key, fallbackKey = key) {
  const group = GROUP_FALLBACKS[locale] || GROUP_FALLBACKS.en;
  return nav[key] || group[fallbackKey] || key;
}

function DesktopDropdown({ id, label, items, openId, setOpenId, pathname }) {
  const open = openId === id;
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpenId(null);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpenId]);

  const childActive = items.some((item) => pathname === item.to);

  return (
    <div
      className={`ps-dd ${open ? 'is-open' : ''} ${childActive ? 'is-active' : ''}`}
      ref={panelRef}
      onMouseEnter={() => setOpenId(id)}
      onMouseLeave={() => setOpenId(null)}
    >
      <button
        type="button"
        className="ps-dd-trigger"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpenId(open ? null : id)}
      >
        <span>{label}</span>
        <AppIcon name="chevronDown" className="ps-dd-chevron" />
      </button>
      <div className="ps-dd-panel" role="menu">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            role="menuitem"
            className={({ isActive }) => `ps-dd-link ${isActive ? 'active' : ''}`}
            onClick={() => setOpenId(null)}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function MobileGroup({ title, items, open, onToggle }) {
  return (
    <div className={`ps-mobile-group ${open ? 'is-open' : ''}`}>
      <button type="button" className="ps-mobile-group-btn" onClick={onToggle} aria-expanded={open}>
        <span>{title}</span>
        <AppIcon name="chevronDown" className="ps-dd-chevron" />
      </button>
      {open && (
        <div className="ps-mobile-group-links">
          {items.map((item) => (
            <Link key={item.to} to={item.to}>{item.label}</Link>
          ))}
        </div>
      )}
    </div>
  );
}

function PublicShell() {
  const { school, motto, campuses, page, locale, setLocale, locales } = usePublicSite();
  const nav = page('nav');
  const home = page('home');
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(null);
  const [mobileGroup, setMobileGroup] = useState(null);
  const [enrollOpen, setEnrollOpen] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setDesktopOpen(null);
    setMobileGroup(null);
    window.scrollTo(0, 0);
  }, [location.pathname, locale]);

  const brandName = (school?.name || 'École La RACINE')
    .replace(/\s*school\s*$/i, '')
    .trim() || 'La Racine';
  const onHero = location.pathname === '/';
  const navTone = scrolled || open || !onHero ? 'ps-nav-scrolled' : 'ps-nav-over-hero';

  const schoolItems = [
    { key: 'about', to: '/about' },
    { key: 'academics', to: '/academics' },
    { key: 'calendar', to: '/calendar' },
    { key: 'locations', to: '/locations' },
  ].map((item) => ({ ...item, label: labelFor(nav, locale, item.key) }));

  const lifeItems = [
    { key: 'announcements', to: '/announcements' },
    { key: 'news', to: '/news' },
    { key: 'events', to: '/events' },
    { key: 'gallery', to: '/gallery' },
  ].map((item) => ({ ...item, label: labelFor(nav, locale, item.key) }));

  const admissionsLabel = labelFor(nav, locale, 'admissions');
  const contactLabel = labelFor(nav, locale, 'contact');
  const schoolGroupLabel = labelFor(nav, locale, 'menuSchool', 'school');
  const lifeGroupLabel = labelFor(nav, locale, 'menuLife', 'life');
  const showEnroll = enrollOpen && location.pathname !== '/admissions/apply';

  return (
    <div className="public-site" lang={locale}>
      <header className={`ps-nav ${navTone}`}>
        <div className="ps-nav-inner">
          <Link to="/" className="ps-brand">
            <img src="/logo.png" alt={school?.name || 'École La RACINE'} />
            <div>
              <div className="ps-brand-name">{brandName}</div>
            </div>
          </Link>

          <nav className="ps-nav-links" aria-label="Main">
            <DesktopDropdown
              id="school"
              label={schoolGroupLabel}
              items={schoolItems}
              openId={desktopOpen}
              setOpenId={setDesktopOpen}
              pathname={location.pathname}
            />
            <DesktopDropdown
              id="life"
              label={lifeGroupLabel}
              items={lifeItems}
              openId={desktopOpen}
              setOpenId={setDesktopOpen}
              pathname={location.pathname}
            />
            <NavLink to="/admissions" className={({ isActive }) => (isActive ? 'active' : '')}>
              {admissionsLabel}
            </NavLink>
            <NavLink to="/contact" className={({ isActive }) => (isActive ? 'active' : '')}>
              {contactLabel}
            </NavLink>
          </nav>

          <div className="ps-nav-actions">
            <label className="ps-lang ps-nav-desktop-only">
              <span className="sr-only">Language</span>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                aria-label="Website language"
              >
                {(locales || []).map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.native || item.label || item.code}
                  </option>
                ))}
              </select>
            </label>
            <Link to="/login" className="ps-btn ps-btn-ghost ps-nav-desktop-only">{nav.portal || 'Portal'}</Link>
            <Link to="/admissions/apply" className="ps-btn ps-btn-primary ps-nav-desktop-only">{nav.apply || 'Apply'}</Link>
            <button
              type="button"
              className="ps-menu-btn"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <AppIcon name="close" className="w-6 h-6" /> : <AppIcon name="menu" className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="ps-mobile-menu">
            <label className="ps-mobile-lang">
              <span>Language</span>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                aria-label="Website language"
              >
                {(locales || []).map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.native || item.label || item.code}
                  </option>
                ))}
              </select>
            </label>
            <MobileGroup
              title={schoolGroupLabel}
              items={schoolItems}
              open={mobileGroup === 'school'}
              onToggle={() => setMobileGroup((v) => (v === 'school' ? null : 'school'))}
            />
            <MobileGroup
              title={lifeGroupLabel}
              items={lifeItems}
              open={mobileGroup === 'life'}
              onToggle={() => setMobileGroup((v) => (v === 'life' ? null : 'life'))}
            />
            <Link to="/admissions">{admissionsLabel}</Link>
            <Link to="/contact">{contactLabel}</Link>
            <div className="ps-mobile-quick-actions">
              <Link to="/login" className="ps-btn ps-btn-ghost">{nav.mobilePortal || nav.portal || 'Portal'}</Link>
              <Link to="/admissions/apply" className="ps-btn ps-btn-primary">{nav.apply || 'Apply'}</Link>
            </div>
          </div>
        )}
      </header>

      <main>
        <Outlet context={{ school, motto, campuses, page, locale }} />
      </main>

      <footer className="ps-footer">
        <div className="ps-footer-inner">
          <div>
            <h4>{school?.name || 'École La RACINE'}</h4>
            <p>{motto}</p>
            <p style={{ marginTop: '0.75rem' }}>
              {[school?.city, school?.district, school?.country].filter(Boolean).join(', ')}
            </p>
            <div className="ps-footer-social">
              <p className="ps-footer-social-label">{nav.footerFollow || 'Follow us'}</p>
              <div className="ps-footer-social-links" aria-label={nav.footerFollow || 'Follow us'}>
                {(nav.socials?.length ? nav.socials : DEFAULT_SOCIALS).map((item) => (
                  <a
                    key={item.id || item.url}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ps-footer-social-link"
                    aria-label={item.label}
                    title={item.label}
                  >
                    <AppIcon name={item.id} className="ps-icon ps-icon--lg" />
                  </a>
                ))}
              </div>
            </div>
          </div>
          <div>
            <h4>{schoolGroupLabel}</h4>
            {schoolItems.map((item) => (
              <p key={item.to}><Link to={item.to}>{item.label}</Link></p>
            ))}
            <p><Link to="/admissions">{admissionsLabel}</Link></p>
          </div>
          <div>
            <h4>{lifeGroupLabel}</h4>
            {lifeItems.map((item) => (
              <p key={item.to}><Link to={item.to}>{item.label}</Link></p>
            ))}
            <p><Link to="/contact">{contactLabel}</Link></p>
            <p style={{ marginTop: '0.75rem' }}>
              <Link to="/login">{nav.footerPortal || 'Open school portal'}</Link>
            </p>
          </div>
        </div>
        <div className="ps-footer-bottom">
          © {new Date().getFullYear()} {school?.name || 'École La RACINE'}. {nav.copyrightSuffix || 'All rights reserved.'}
        </div>
      </footer>

      {showEnroll && (home.enrollTitle || home.enrollBody || home.enrollCta) && (
        <aside className="ps-enroll" aria-label="Admissions">
          <button type="button" className="ps-enroll-close" aria-label="Dismiss" onClick={() => setEnrollOpen(false)}>
            <AppIcon name="close" className="w-4 h-4" />
          </button>
          {home.enrollTitle && <p className="ps-enroll-kicker">{home.enrollTitle}</p>}
          {home.enrollBody && <p className="ps-enroll-body">{home.enrollBody}</p>}
          {home.enrollCta && (
            <Link to="/admissions/apply" className="ps-btn ps-btn-primary">{home.enrollCta}</Link>
          )}
        </aside>
      )}

      <SupportChatWidget />
    </div>
  );
}

export default function PublicLayout() {
  return (
    <PublicSiteProvider>
      <PublicShell />
    </PublicSiteProvider>
  );
}
