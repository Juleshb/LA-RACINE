import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  GraduationCap,
  Home,
  Image,
  LayoutDashboard,
  Loader2,
  MapPin,
  Megaphone,
  MessageSquare,
  Navigation,
  Newspaper,
  RefreshCw,
  Save,
  School,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { useCampus } from '../context/CampusContext';
import { useTranslation } from '../context/LanguageContext';

const LOCALES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'sw', label: 'Kiswahili', short: 'SW' },
  { code: 'rw', label: 'Ikinyarwanda', short: 'RW' },
];

const PAGE_GROUPS = [
  {
    titleKey: 'pages.website.groupOverview',
    items: [{ slug: 'dashboard', labelKey: 'pages.website.dashboard', icon: LayoutDashboard }],
  },
  {
    titleKey: 'pages.website.groupCorePages',
    items: [
      { slug: 'nav', labelKey: 'pages.website.pageNav', icon: Navigation },
      { slug: 'home', labelKey: 'pages.website.pageHome', icon: Home },
      { slug: 'about', labelKey: 'pages.website.pageAbout', icon: School },
      { slug: 'academics', labelKey: 'pages.website.pageAcademics', icon: GraduationCap },
      { slug: 'locations', labelKey: 'pages.website.pageCampuses', icon: MapPin },
      { slug: 'admissions', labelKey: 'pages.website.pageAdmissions', icon: BookOpen },
      { slug: 'contact', labelKey: 'pages.website.pageContact', icon: MessageSquare },
    ],
  },
  {
    titleKey: 'pages.website.groupPublishing',
    items: [
      { slug: 'announcements', labelKey: 'pages.website.pageAnnouncements', icon: Megaphone },
      { slug: 'news', labelKey: 'pages.website.pageNews', icon: Newspaper },
      { slug: 'events', labelKey: 'pages.website.pageEvents', icon: CalendarDays },
      { slug: 'gallery', labelKey: 'pages.website.pageGallery', icon: Image },
    ],
  },
];

const PAGE_LABEL_KEYS = {
  nav: 'pages.website.pageNav',
  home: 'pages.website.pageHome',
  about: 'pages.website.pageAbout',
  academics: 'pages.website.pageAcademics',
  locations: 'pages.website.pageCampuses',
  admissions: 'pages.website.pageAdmissions',
  contact: 'pages.website.pageContact',
  announcements: 'pages.website.pageAnnouncements',
  news: 'pages.website.pageNews',
  events: 'pages.website.pageEvents',
  gallery: 'pages.website.pageGallery',
};

const PAGES = PAGE_GROUPS.flatMap((g) => g.items).filter((p) => p.slug !== 'dashboard');

function StatCard({ icon: Icon, label, value, hint, tone = 'brand' }) {
  const tones = {
    brand: 'from-brand-50 to-white border-brand-100 text-brand-700',
    amber: 'from-amber-50 to-white border-amber-100 text-amber-700',
    sky: 'from-sky-50 to-white border-sky-100 text-sky-700',
    rose: 'from-rose-50 to-white border-rose-100 text-rose-700',
    slate: 'from-slate-50 to-white border-slate-200 text-slate-700',
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 ${tones[tone] || tones.brand}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
        </div>
        <div className="rounded-xl bg-white/80 p-2 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function WebsiteDashboard({ stats, loading, onOpenPage, campusBase }) {
  const { t } = useTranslation();
  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const o = stats.overview || {};
  const contact = stats.contact || {};

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-600 to-emerald-700 p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">Website CMS</p>
            <h2 className="mt-1 text-2xl font-semibold">{t('pages.website.overviewTitle')}</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              {t('pages.website.overviewSubtitle')}
            </p>
          </div>
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm font-medium hover:bg-white/25"
          >
            <ExternalLink className="h-4 w-4" />
            {t('pages.website.openPublicSite')}
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Globe} label={t('pages.website.statLanguages')} value={`${o.localesTotal || 0}`} hint="EN · FR · SW · RW" tone="sky" />
        <StatCard icon={FileText} label={t('pages.website.statCmsPages')} value={`${o.pagesTotal || 0}`} hint={`${o.contentRows || 0}/${o.expectedRows || 0} locale rows`} />
        <StatCard icon={Newspaper} label={t('pages.website.statNews')} value={`${o.newsTotal || 0}`} hint="Across primary locale" />
        <StatCard icon={Image} label={t('pages.website.statGallery')} value={`${o.galleryImages || 0}`} hint="Public gallery items" tone="slate" />
        <StatCard
          icon={Megaphone}
          label={t('pages.website.statAnnouncements')}
          value={`${o.announcementsPublished || 0}`}
          hint={`${o.announcementsDraft || 0} draft`}
          tone="amber"
        />
        <StatCard
          icon={CalendarDays}
          label={t('pages.website.statEventsLive')}
          value={`${o.eventsPublished || 0}`}
          hint={`${o.eventsDraft || 0} draft`}
          tone="amber"
        />
        <StatCard icon={MessageSquare} label={t('pages.website.statContactMessages')} value={`${contact.total || 0}`} hint={`${contact.open || 0} open`} tone="rose" />
        <StatCard
          icon={BarChart3}
          label={t('pages.website.statLastUpdate')}
          value={o.lastContentUpdate ? new Date(o.lastContentUpdate).toLocaleDateString() : '—'}
          hint={o.lastContentUpdate ? new Date(o.lastContentUpdate).toLocaleTimeString() : t('pages.website.noUpdatesYet')}
          tone="slate"
        />
      </div>

      <div className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-gray-900">{t('pages.website.allLanguages')}</h3>
          <p className="text-xs text-gray-500">{t('pages.website.clickLanguageHint')}</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {(stats.languageSummary || LOCALES.map((l) => ({
            code: l.code,
            native: l.label,
            pagesReady: 0,
            pagesTotal: PAGES.length,
          }))).map((lang) => {
            const pct = lang.pagesTotal ? Math.round((lang.pagesReady / lang.pagesTotal) * 100) : 0;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => onOpenPage('home', lang.code)}
                className="rounded-xl border border-gray-200 bg-white p-3 text-left hover:border-brand-300 hover:bg-brand-50/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{lang.native || lang.label}</p>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                    {String(lang.code).toUpperCase()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {lang.pagesReady}/{lang.pagesTotal} pages ready
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900">Page coverage</h3>
            <p className="text-xs text-gray-500">Locales ready / total</p>
          </div>
          <div className="space-y-2">
            {(stats.pageCoverage || []).map((page) => {
              const pct = page.localesTotal ? Math.round((page.localesReady / page.localesTotal) * 100) : 0;
              return (
                <button
                  key={page.slug}
                  type="button"
                  onClick={() => onOpenPage(page.slug)}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-gray-900">{page.label}</p>
                      <span className="text-xs text-gray-500">
                        {page.localesReady}/{page.localesTotal}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {page.itemCount > 0 ? `${page.itemCount} items · ` : ''}
                      {page.updatedAt ? `Updated ${new Date(page.updatedAt).toLocaleString()}` : 'Not updated yet'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-900">Contact inbox</h3>
              <Link to={`${campusBase}/communication`} className="text-xs font-medium text-brand-700 hover:underline">
                Open inbox
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl bg-amber-50 p-3 text-center">
                <p className="text-lg font-bold text-amber-800">{contact.open || 0}</p>
                <p className="text-[11px] text-amber-700">Open</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 text-center">
                <p className="text-lg font-bold text-emerald-800">{contact.replied || 0}</p>
                <p className="text-[11px] text-emerald-700">Replied</p>
              </div>
              <div className="rounded-xl bg-slate-100 p-3 text-center">
                <p className="text-lg font-bold text-slate-800">{contact.closed || 0}</p>
                <p className="text-[11px] text-slate-600">Closed</p>
              </div>
            </div>
            <div className="space-y-2">
              {(contact.recent || []).length === 0 ? (
                <p className="text-sm text-gray-500">No contact messages yet.</p>
              ) : (
                contact.recent.map((item) => (
                  <div key={item.id} className="rounded-xl border border-gray-100 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
                      <span className="text-[10px] uppercase tracking-wide text-gray-500">{item.status}</span>
                    </div>
                    <p className="truncate text-xs text-gray-500">{item.subject || item.email}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="mb-3 text-base font-semibold text-gray-900">Recently updated</h3>
            <div className="space-y-2">
              {(stats.recentlyUpdated || []).length === 0 ? (
                <p className="text-sm text-gray-500">No recent edits.</p>
              ) : (
                stats.recentlyUpdated.map((row, idx) => (
                  <button
                    key={`${row.slug}-${row.locale}-${idx}`}
                    type="button"
                    onClick={() => onOpenPage(row.slug, row.locale)}
                    className="flex w-full items-start justify-between gap-2 rounded-xl border border-gray-100 px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{row.label}</p>
                      <p className="text-xs text-gray-500">
                        {String(row.locale || '').toUpperCase()}
                        {row.updatedBy ? ` · ${row.updatedBy}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-gray-400">
                      {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '—'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 text-base font-semibold text-gray-900">Quick publish actions</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { slug: 'announcements', label: 'Add announcement', icon: Megaphone },
            { slug: 'news', label: 'Write news', icon: Newspaper },
            { slug: 'events', label: 'Schedule event', icon: CalendarDays },
            { slug: 'gallery', label: 'Upload gallery', icon: Image },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.slug}
                type="button"
                onClick={() => onOpenPage(action.slug)}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 text-left hover:border-brand-300 hover:bg-brand-50/40"
              >
                <span className="rounded-lg bg-brand-50 p-2 text-brand-700">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium text-gray-900">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function labelize(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/Url$/, ' URL')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isLongText(key, value) {
  if (typeof value !== 'string') return false;
  if (/Lead|Line|Body|empty|copyright/i.test(key)) return true;
  return value.length > 90;
}

function ListEditor({ items, onChange }) {
  const updateItem = (index, field, value) => {
    const next = items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    onChange(next);
  };

  const addItem = () => onChange([...(items || []), { title: '', body: '' }]);
  const removeItem = (index) => onChange(items.filter((_, i) => i !== index));

  return (
    <div className="space-y-4">
      {(items || []).map((item, index) => (
        <div key={index} className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-700">Item {index + 1}</p>
            <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => removeItem(index)}>
              Remove
            </button>
          </div>
          <div>
            <label className="label">Title</label>
            <input className="input" value={item.title || ''} onChange={(e) => updateItem(index, 'title', e.target.value)} />
          </div>
          <div>
            <label className="label">Body</label>
            <textarea
              className="input min-h-[88px]"
              value={item.body || ''}
              onChange={(e) => updateItem(index, 'body', e.target.value)}
            />
          </div>
        </div>
      ))}
      <button type="button" className="btn-secondary text-sm" onClick={addItem}>
        Add item
      </button>
    </div>
  );
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-3xl m-0 sm:m-4 min-h-screen sm:min-h-0 sm:rounded-2xl bg-white border-0 sm:border sm:border-gray-200 shadow-2xl overflow-hidden">
        <div className="sticky top-0 z-10 p-4 border-b border-gray-100 flex items-center justify-between gap-2 bg-white/95 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>Close</button>
        </div>
        <div className="p-4 pb-8">
          {children}
        </div>
      </div>
    </div>
  );
}

function normalizeNewsItem(item) {
  // Support legacy single imageUrl and new images array
  let images = [];
  if (Array.isArray(item?.images) && item.images.length > 0) {
    images = item.images;
  } else if (item?.imageUrl) {
    images = [item.imageUrl];
  }
  return {
    title: item?.title || '',
    summary: item?.summary || item?.summaryText || item?.body || '',
    content: item?.content || item?.body || '',
    images,
    publishedAt: item?.publishedAt || item?.date || '',
    category: item?.category || '',
  };
}

function NewsEditor({ data, onChange }) {
  const items = Array.isArray(data.items) ? data.items : [];

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('view'); // 'view' | 'edit'
  const [activeIndex, setActiveIndex] = useState(null); // null => new item
  const [draft, setDraft] = useState(null);

  const pageTitle = data?.title || '';
  const pageLead = data?.lead || '';

  const openView = (index) => {
    setActiveIndex(index);
    setDraft(normalizeNewsItem(items[index]));
    setModalMode('view');
    setModalOpen(true);
  };

  const openEdit = (index) => {
    setActiveIndex(index);
    setDraft(normalizeNewsItem(items[index]));
    setModalMode('edit');
    setModalOpen(true);
  };

  const openAdd = () => {
    setActiveIndex(null);
    setDraft({
      title: '',
      summary: '',
      content: '',
      images: [],
      publishedAt: '',
      category: '',
    });
    setModalMode('edit');
    setModalOpen(true);
  };

  const removeItem = (index) => {
    const next = items.filter((_, i) => i !== index);
    onChange({ ...data, items: next });
  };

  const saveDraft = () => {
    if (!draft) return;
    const nextItem = {
      title: String(draft.title || '').trim(),
      summary: String(draft.summary || ''),
      content: String(draft.content || ''),
      images: Array.isArray(draft.images) ? draft.images.filter(Boolean) : [],
      publishedAt: String(draft.publishedAt || ''),
      category: String(draft.category || ''),
    };

    if (activeIndex === null) {
      const next = [...items, nextItem];
      onChange({ ...data, items: next });
    } else {
      const next = items.map((it, i) => (i === activeIndex ? nextItem : it));
      onChange({ ...data, items: next });
    }

    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Label</label>
            <input
              className="input"
              value={data.label || ''}
              onChange={(e) => onChange({ ...data, label: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              value={pageTitle}
              onChange={(e) => onChange({ ...data, title: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="label">Lead text</label>
          <textarea
            className="input min-h-[96px]"
            value={pageLead}
            onChange={(e) => onChange({ ...data, lead: e.target.value })}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Articles</h3>
          <button type="button" className="btn-secondary text-sm" onClick={openAdd}>
            Add article
          </button>
        </div>

        {items.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 rounded-xl border border-gray-200 bg-white">
            No articles yet. Click “Add article”.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item, index) => {
              const n = normalizeNewsItem(item);
              return (
                <div
                  key={`${n.title}-${index}`}
                  className="relative rounded-xl border border-gray-200 bg-white overflow-hidden"
                >
                  {n.images.length > 0 && (
                    <div className="relative">
                      <img
                        src={n.images[0]}
                        alt={n.title || 'News image'}
                        className="w-full aspect-[16/10] object-cover"
                        loading="lazy"
                      />
                      {n.images.length > 1 && (
                        <div className="absolute bottom-2 right-2 flex items-center gap-1">
                          {n.images.slice(1, 4).map((img, i) => (
                            <img
                              key={i}
                              src={img}
                              alt=""
                              className="w-8 h-8 rounded object-cover border-2 border-white shadow-sm"
                            />
                          ))}
                          {n.images.length > 4 && (
                            <span className="bg-black/60 text-white text-xs font-bold rounded px-1.5 py-0.5">
                              +{n.images.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-gray-500">
                          {n.category && <span>{n.category}</span>}
                          {n.category && n.publishedAt && <span> · </span>}
                          {n.publishedAt && <span>{new Date(n.publishedAt).toLocaleDateString()}</span>}
                        </p>
                        <h4 className="font-semibold text-gray-900 mt-1">
                          {n.title || '(Untitled)'}
                        </h4>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => removeItem(index)}
                      >
                        Remove
                      </button>
                    </div>
                    {n.summary && <p className="text-sm text-gray-600">{n.summary}</p>}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button type="button" className="btn-secondary text-sm" onClick={() => openView(index)}>
                        View
                      </button>
                      <button type="button" className="btn-secondary text-sm" onClick={() => openEdit(index)}>
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={modalMode === 'view' ? 'News article' : 'Edit news article'}
        onClose={() => setModalOpen(false)}
      >
        {draft && (
          <>
            {modalMode === 'view' ? (
              <div className="space-y-4">
                {draft.images?.length > 0 && (
                  <div className={`grid gap-2 ${draft.images.length === 1 ? '' : 'grid-cols-2 sm:grid-cols-3'}`}>
                    {draft.images.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`${draft.title || 'News'} image ${i + 1}`}
                        className={`w-full object-cover rounded-xl border border-gray-100 ${draft.images.length === 1 ? 'aspect-[16/10]' : 'aspect-square'}`}
                      />
                    ))}
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">
                    {draft.category && <span>{draft.category}</span>}
                    {draft.category && draft.publishedAt && <span> · </span>}
                    {draft.publishedAt && <span>{new Date(draft.publishedAt).toLocaleDateString()}</span>}
                  </p>
                  <h3 className="text-xl font-semibold text-gray-900">{draft.title || '(Untitled)'}</h3>
                </div>
                {draft.summary && <p className="text-gray-700 whitespace-pre-wrap">{draft.summary}</p>}
                {draft.content && <div className="text-gray-700 whitespace-pre-wrap">{draft.content}</div>}
                <div className="flex justify-end pt-2">
                  <button type="button" className="btn-primary text-sm" onClick={() => setModalMode('edit')}>
                    Edit this article
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Title</label>
                    <input
                      className="input"
                      value={draft.title || ''}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Category</label>
                    <input
                      className="input"
                      value={draft.category || ''}
                      onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Published date</label>
                    <input
                      className="input"
                      type="date"
                      value={draft.publishedAt || ''}
                      onChange={(e) => setDraft({ ...draft, publishedAt: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="label mb-2 block">Images ({(draft.images || []).length})</label>
                  {(draft.images || []).length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                      {(draft.images || []).map((url, i) => (
                        <div key={i} className="relative group">
                          <img
                            src={url}
                            alt={`Image ${i + 1}`}
                            className="w-full aspect-square object-cover rounded-lg border border-gray-100"
                          />
                          <button
                            type="button"
                            className="absolute top-1 right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              const next = (draft.images || []).filter((_, idx) => idx !== i);
                              setDraft({ ...draft, images: next });
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      className="input flex-1"
                      placeholder="Paste image URL and press Enter"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const url = e.target.value.trim();
                          if (!url) return;
                          setDraft({ ...draft, images: [...(draft.images || []), url] });
                          e.target.value = '';
                        }
                      }}
                    />
                    <label className="btn-secondary text-sm cursor-pointer inline-flex items-center gap-1.5">
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          const urls = await Promise.all(files.map(fileToDataUrl));
                          setDraft({ ...draft, images: [...(draft.images || []), ...urls] });
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="label">Summary</label>
                  <textarea
                    className="input min-h-[92px]"
                    value={draft.summary || ''}
                    onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Full content</label>
                  <textarea
                    className="input min-h-[140px]"
                    value={draft.content || ''}
                    onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                  />
                </div>

                <div className="flex flex-wrap gap-2 justify-end pt-2">
                  <button type="button" className="btn-secondary text-sm" onClick={() => setModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn-primary text-sm" onClick={saveDraft}>
                    Save article
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}

function EventsEditor({ data, onChange }) {
  const { t } = useTranslation();
  const items = data.items || [];
  const [modalOpen, setModalOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(null);
  const [draft, setDraft] = useState(null);

  const openEdit = (index) => {
    setActiveIndex(index);
    setDraft({ ...items[index] });
    setModalOpen(true);
  };

  const openAdd = () => {
    setActiveIndex(null);
    setDraft({ title: '', details: '', date: '', time: '', location: '', type: '', status: 'draft' });
    setModalOpen(true);
  };

  const saveDraft = () => {
    if (!draft) return;
    if (activeIndex === null) {
      onChange({ ...data, items: [...items, draft] });
    } else {
      const next = items.map((it, i) => (i === activeIndex ? draft : it));
      onChange({ ...data, items: next });
    }
    setModalOpen(false);
  };

  const removeItem = (index) => {
    onChange({ ...data, items: items.filter((_, i) => i !== index) });
  };

  const toggleStatus = (index) => {
    const item = items[index];
    const newStatus = item.status === 'published' ? 'draft' : 'published';
    const next = items.map((it, i) => (i === index ? { ...it, status: newStatus } : it));
    onChange({ ...data, items: next });
  };

  // Sort: published first, then by date descending
  const sorted = items
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .sort((a, b) => {
      if (a.date && b.date) return b.date.localeCompare(a.date);
      return 0;
    });

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Label</label>
            <input className="input" value={data.label || ''} onChange={(e) => onChange({ ...data, label: e.target.value })} />
          </div>
          <div>
            <label className="label">Title</label>
            <input className="input" value={data.title || ''} onChange={(e) => onChange({ ...data, title: e.target.value })} />
          </div>
        </div>
        <div className="mt-3">
          <label className="label">Lead text</label>
          <textarea className="input min-h-[96px]" value={data.lead || ''} onChange={(e) => onChange({ ...data, lead: e.target.value })} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Events timeline</h3>
          <button type="button" className="btn-secondary text-sm" onClick={openAdd}>{t('pages.website.addEvent')}</button>
        </div>

        {sorted.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 rounded-xl border border-gray-200 bg-white">
            {t('pages.website.noEventsYet')}
          </div>
        ) : (
          <div className="space-y-0 border-l-2 border-gray-200 ml-3">
            {sorted.map((item) => {
              const idx = item.originalIndex;
              const isPublished = item.status === 'published';
              return (
                <div key={`${item.title}-${idx}`} className="relative pl-6 pb-5">
                  {/* Timeline dot */}
                  <div className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 ${isPublished ? 'bg-green-500 border-green-500' : 'bg-gray-300 border-gray-300'}`} />
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${isPublished ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {isPublished ? t('pages.website.published') : t('pages.website.draft')}
                          </span>
                          {item.type && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{item.type}</span>}
                        </div>
                        <h4 className="font-semibold text-gray-900">{item.title || '(Untitled)'}</h4>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                          {item.date && <span>📅 {new Date(item.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>}
                          {item.time && <span>🕐 {item.time}</span>}
                          {item.location && <span>📍 {item.location}</span>}
                        </div>
                        {item.details && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{item.details}</p>}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${isPublished ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}
                          onClick={() => toggleStatus(idx)}
                        >
                          {isPublished ? t('pages.website.unpublish') : t('pages.website.publish')}
                        </button>
                        <button type="button" className="btn-secondary text-xs" onClick={() => openEdit(idx)}>{t('ui.edit')}</button>
                        <button type="button" className="text-xs text-red-600 hover:underline px-1" onClick={() => removeItem(idx)}>{t('ui.remove')}</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={activeIndex === null ? t('pages.website.addEvent') : t('pages.website.editEvent')}
        onClose={() => setModalOpen(false)}
      >
        {draft && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="label">Event title</label>
                <input className="input" value={draft.title || ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Type</label>
                <input className="input" value={draft.type || ''} placeholder="e.g. Academic, Sports, Cultural" onChange={(e) => setDraft({ ...draft, type: e.target.value })} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={draft.status || 'draft'} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div>
                <label className="label">Date</label>
                <input className="input" type="date" value={draft.date || ''} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              </div>
              <div>
                <label className="label">Time</label>
                <input className="input" type="time" value={draft.time || ''} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Location</label>
                <input className="input" value={draft.location || ''} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Details</label>
              <textarea className="input min-h-[120px]" value={draft.details || ''} onChange={(e) => setDraft({ ...draft, details: e.target.value })} />
            </div>
            <div className="flex flex-wrap gap-2 justify-end pt-2">
              <button type="button" className="btn-secondary text-sm" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="button" className="btn-primary text-sm" onClick={saveDraft}>Save event</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function normalizeAnnouncementItem(item) {
  const images = Array.isArray(item?.images) && item.images.length > 0 ? item.images : [];
  const documentImageUrl = item?.documentImageUrl || '';

  return {
    title: item?.title || '',
    summary: item?.summary || item?.body || item?.content || '',
    content: item?.content || item?.body || '',
    images,
    documentImageUrl,
    documentUrl: item?.documentUrl || '',
    documentLabel: item?.documentLabel || 'Document',
    videoUrl: item?.videoUrl || '',
    linkUrl: item?.linkUrl || '',
    linkLabel: item?.linkLabel || 'Open link',
    publishedAt: item?.publishedAt || item?.date || '',
    status: item?.status || 'published',
  };
}

function AnnouncementEditor({ data, onChange }) {
  const items = Array.isArray(data.items) ? data.items : [];
  const [modalOpen, setModalOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(null);
  const [draft, setDraft] = useState(null);

  const sorted = items
    .map((item, idx) => ({ item, originalIndex: idx }))
    .sort((a, b) => {
      const aDate = a.item?.publishedAt || a.item?.date || '';
      const bDate = b.item?.publishedAt || b.item?.date || '';
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

  const openEdit = (originalIndex) => {
    setActiveIndex(originalIndex);
    setDraft(normalizeAnnouncementItem(items[originalIndex] || {}));
    setModalOpen(true);
  };

  const openAdd = () => {
    setActiveIndex(null);
    setDraft({
      title: '',
      summary: '',
      content: '',
      images: [],
      documentImageUrl: '',
      documentUrl: '',
      documentLabel: 'Document',
      videoUrl: '',
      linkUrl: '',
      linkLabel: 'Open link',
      publishedAt: '',
      status: 'published',
    });
    setModalOpen(true);
  };

  const saveDraft = () => {
    if (!draft) return;
    const nextItem = {
      title: String(draft.title || '').trim(),
      summary: String(draft.summary || ''),
      content: String(draft.content || ''),
      images: Array.isArray(draft.images) ? draft.images.filter(Boolean) : [],
      documentImageUrl: String(draft.documentImageUrl || ''),
      documentUrl: String(draft.documentUrl || ''),
      documentLabel: String(draft.documentLabel || 'Document'),
      videoUrl: String(draft.videoUrl || ''),
      linkUrl: String(draft.linkUrl || ''),
      linkLabel: String(draft.linkLabel || 'Open link'),
      publishedAt: String(draft.publishedAt || ''),
      status: draft.status === 'draft' ? 'draft' : 'published',
    };

    if (activeIndex === null) {
      onChange({ ...data, items: [...items, nextItem] });
    } else {
      const next = items.map((it, i) => (i === activeIndex ? nextItem : it));
      onChange({ ...data, items: next });
    }
    setModalOpen(false);
  };

  const removeItem = (index) => {
    onChange({ ...data, items: items.filter((_, i) => i !== index) });
  };

  const toggleStatus = (index) => {
    const it = items[index];
    if (!it) return;
    const newStatus = it.status === 'published' ? 'draft' : 'published';
    const next = items.map((x, i) => (i === index ? { ...x, status: newStatus } : x));
    onChange({ ...data, items: next });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Label</label>
            <input className="input" value={data.label || ''} onChange={(e) => onChange({ ...data, label: e.target.value })} />
          </div>
          <div>
            <label className="label">Title</label>
            <input className="input" value={data.title || ''} onChange={(e) => onChange({ ...data, title: e.target.value })} />
          </div>
        </div>
        <div className="mt-3">
          <label className="label">Lead text</label>
          <textarea className="input min-h-[96px]" value={data.lead || ''} onChange={(e) => onChange({ ...data, lead: e.target.value })} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Announcements</h3>
          <button type="button" className="btn-secondary text-sm" onClick={openAdd}>Add announcement</button>
        </div>

        {sorted.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 rounded-xl border border-gray-200 bg-white">
            No announcements yet. Click “Add announcement”.
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map(({ originalIndex }) => {
              const n = normalizeAnnouncementItem(items[originalIndex]);
              const isPublished = n.status === 'published';
              return (
                <div key={`${n.title}-${originalIndex}`} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="p-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-[220px] flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${isPublished ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {isPublished ? 'Published' : 'Draft'}
                        </span>
                        {n.publishedAt && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {new Date(n.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <h4 className="font-semibold text-gray-900">{n.title || '(Untitled)'}</h4>
                      {n.summary && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{n.summary}</p>}
                      {n.videoUrl && <p className="text-xs text-gray-500 mt-2">Video: {n.videoUrl}</p>}
                      {n.linkUrl && <p className="text-xs text-gray-500 mt-1">Link: {n.linkUrl}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        type="button"
                        className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${isPublished ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}
                        onClick={() => toggleStatus(originalIndex)}
                      >
                        {isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                      <button type="button" className="btn-secondary text-xs" onClick={() => openEdit(originalIndex)}>Edit</button>
                      <button type="button" className="text-xs text-red-600 hover:underline px-1" onClick={() => removeItem(originalIndex)}>Remove</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={activeIndex === null ? 'Add announcement' : 'Edit announcement'}
        onClose={() => setModalOpen(false)}
      >
        {draft && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Title</label>
                <input className="input" value={draft.title || ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={draft.status || 'published'} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
              <div>
                <label className="label">Published at</label>
                <input className="input" type="date" value={draft.publishedAt || ''} onChange={(e) => setDraft({ ...draft, publishedAt: e.target.value })} />
              </div>
              <div>
                <label className="label">Document label</label>
                <input className="input" value={draft.documentLabel || 'Document'} onChange={(e) => setDraft({ ...draft, documentLabel: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="label">Summary</label>
              <textarea className="input min-h-[92px]" value={draft.summary || ''} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
            </div>

            <div>
              <label className="label">Full announcement content</label>
              <textarea className="input min-h-[120px]" value={draft.content || ''} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">Video URL (YouTube)</label>
                  <input className="input" placeholder="https://www.youtube.com/watch?v=..." value={draft.videoUrl || ''} onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value })} />
                </div>
                <div>
                  <label className="label">External link URL</label>
                  <input className="input" placeholder="https://..." value={draft.linkUrl || ''} onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="label">External link label</label>
                  <input className="input" value={draft.linkLabel || 'Open link'} onChange={(e) => setDraft({ ...draft, linkLabel: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">Document image (thumbnail)</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label className="btn-secondary text-sm cursor-pointer inline-flex items-center gap-2">
                      📷 Upload image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const url = await fileToDataUrl(file);
                          setDraft({ ...draft, documentImageUrl: url });
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <input
                      className="input flex-1"
                      placeholder="Or paste image URL"
                      value={draft.documentImageUrl || ''}
                      onChange={(e) => setDraft({ ...draft, documentImageUrl: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Document file (PDF/Doc) URL or upload</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label className="btn-secondary text-sm cursor-pointer inline-flex items-center gap-2">
                      📎 Upload file
                      <input
                        type="file"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const url = await fileToDataUrl(file);
                          setDraft({ ...draft, documentUrl: url });
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <input
                      className="input flex-1"
                      placeholder="Or paste file URL"
                      value={draft.documentUrl || ''}
                      onChange={(e) => setDraft({ ...draft, documentUrl: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="label">Announcement images</label>
              <div className="mb-3 p-4 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 text-center">
                <p className="text-sm text-gray-500 mb-2">Upload images or paste image URLs</p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
                  <label className="btn-primary text-sm cursor-pointer inline-flex items-center gap-1.5">
                    📷 Upload images
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length === 0) return;
                        const newItems = await Promise.all(
                          files.map(async (file) => ({
                            url: await fileToDataUrl(file),
                            caption: file.name.replace(/\.[^.]+$/, ''),
                          }))
                        );
                        setDraft({ ...draft, images: [...(draft.images || []), ...newItems.map((x) => x.url)] });
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <input
                    className="input max-w-xs"
                    placeholder="Paste image URL + Enter"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const url = e.target.value.trim();
                        if (!url) return;
                        setDraft({ ...draft, images: [...(draft.images || []), url] });
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
              </div>

              {Array.isArray(draft.images) && draft.images.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {draft.images.map((imgUrl, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-white">
                      {imgUrl && (
                        <img src={imgUrl} alt={`Announcement image ${idx + 1}`} className="w-full aspect-square object-cover" loading="lazy" />
                      )}
                      <button
                        type="button"
                        className="absolute top-1.5 right-1.5 bg-red-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                        onClick={() => setDraft({ ...draft, images: draft.images.filter((_, i) => i !== idx) })}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-sm text-gray-500 rounded-xl border border-gray-200 bg-white text-center">
                  No images yet. Upload or paste URLs above.
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 justify-end pt-2">
              <button type="button" className="btn-secondary text-sm" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary text-sm" onClick={saveDraft}>
                Save announcement
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function GalleryEditor({ data, onChange }) {
  const images = Array.isArray(data.items) ? data.items : [];

  const removeImage = (index) => {
    onChange({ ...data, items: images.filter((_, i) => i !== index) });
  };

  const updateCaption = (index, caption) => {
    const next = images.map((img, i) => (i === index ? { ...img, caption } : img));
    onChange({ ...data, items: next });
  };

  const addImages = (newImages) => {
    onChange({ ...data, items: [...images, ...newImages] });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Label</label>
            <input className="input" value={data.label || ''} onChange={(e) => onChange({ ...data, label: e.target.value })} />
          </div>
          <div>
            <label className="label">Title</label>
            <input className="input" value={data.title || ''} onChange={(e) => onChange({ ...data, title: e.target.value })} />
          </div>
        </div>
        <div className="mt-3">
          <label className="label">Lead text</label>
          <textarea className="input min-h-[80px]" value={data.lead || ''} onChange={(e) => onChange({ ...data, lead: e.target.value })} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Images ({images.length})</h3>
        </div>

        {/* Upload area */}
        <div className="mb-4 p-4 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 text-center">
          <p className="text-sm text-gray-500 mb-2">Upload images or paste URLs</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
            <label className="btn-primary text-sm cursor-pointer inline-flex items-center gap-1.5">
              📷 Upload images
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  const newItems = await Promise.all(
                    files.map(async (file) => ({
                      url: await fileToDataUrl(file),
                      caption: file.name.replace(/\.[^.]+$/, ''),
                    }))
                  );
                  addImages(newItems);
                  e.target.value = '';
                }}
              />
            </label>
            <input
              className="input max-w-xs"
              placeholder="Paste image URL + Enter"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const url = e.target.value.trim();
                  if (!url) return;
                  addImages([{ url, caption: '' }]);
                  e.target.value = '';
                }
              }}
            />
          </div>
        </div>

        {images.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 rounded-xl border border-gray-200 bg-white text-center">
            No images yet. Upload or paste URLs above.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((img, index) => {
              const url = typeof img === 'string' ? img : img.url || img.imageUrl || '';
              const caption = typeof img === 'string' ? '' : img.caption || '';
              return (
                <div key={index} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-white">
                  {url && (
                    <img
                      src={url}
                      alt={caption || `Gallery ${index + 1}`}
                      className="w-full aspect-square object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="p-2">
                    <input
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1"
                      placeholder="Caption"
                      value={caption}
                      onChange={(e) => updateCaption(index, e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="absolute top-1.5 right-1.5 bg-red-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                    onClick={() => removeImage(index)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldEditor({ data, onChange }) {
  const entries = useMemo(() => Object.entries(data || {}), [data]);

  const setField = (key, value) => onChange({ ...data, [key]: value });

  return (
    <div className="space-y-5">
      {entries.map(([key, value]) => {
        if (Array.isArray(value)) {
          return (
            <div key={key}>
              <label className="label mb-2 block">{labelize(key)}</label>
              <ListEditor items={value} onChange={(next) => setField(key, next)} />
            </div>
          );
        }

        if (typeof value === 'string' || value == null) {
          const long = isLongText(key, value || '');
          return (
            <div key={key}>
              <label className="label">{labelize(key)}</label>
              {long ? (
                <textarea
                  className="input min-h-[96px]"
                  value={value || ''}
                  onChange={(e) => setField(key, e.target.value)}
                />
              ) : (
                <input
                  className="input"
                  value={value || ''}
                  onChange={(e) => setField(key, e.target.value)}
                />
              )}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

export default function WebsiteCms() {
  const { campusId } = useCampus();
  const { t } = useTranslation();
  const campusBase = campusId ? `/campus/${campusId}` : '/app';

  const [view, setView] = useState('dashboard'); // dashboard | editor
  const [slug, setSlug] = useState('home');
  const [locale, setLocale] = useState('en');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [copyFromLocale, setCopyFromLocale] = useState('en');

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const result = await api.getWebsiteStats();
      setStats(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (view !== 'editor') return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const row = await api.getWebsitePage(slug, locale);
      setData(row.data || {});
      setUpdatedAt(row.updatedAt || null);
      setDirty(false);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [slug, locale, view]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (copyFromLocale === locale) {
      const fallback = LOCALES.find((l) => l.code !== locale)?.code || 'en';
      setCopyFromLocale(fallback);
    }
  }, [locale, copyFromLocale]);

  const confirmLeaveIfDirty = () => {
    if (!dirty) return true;
    return window.confirm(t('pages.website.confirmLeave'));
  };

  const openPage = (nextSlug, nextLocale) => {
    if (!confirmLeaveIfDirty()) return;
    if (nextLocale) setLocale(nextLocale);
    setSlug(nextSlug);
    setView('editor');
    setMessage('');
    setError('');
  };

  const switchLocale = (nextLocale) => {
    if (nextLocale === locale) return;
    if (!confirmLeaveIfDirty()) return;
    setLocale(nextLocale);
    setMessage('');
    setError('');
  };

  const setEditorData = (next) => {
    setData(next);
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const row = await api.saveWebsitePage(slug, locale, data);
      setData(row.data);
      setUpdatedAt(row.updatedAt);
      setDirty(false);
      setMessage(t('pages.website.msgSaved', { locale: LOCALES.find((l) => l.code === locale)?.label || locale }));
      loadStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm(t('pages.website.confirmReset'))) return;
    setSaving(true);
    setError('');
    try {
      const row = await api.resetWebsitePage(slug, locale);
      setData(row.data);
      setUpdatedAt(row.updatedAt);
      setDirty(false);
      setMessage(t('pages.website.msgReset'));
      loadStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyFromSelectedLanguage = async () => {
    if (!copyFromLocale || copyFromLocale === locale) return;
    const fromLabel = LOCALES.find((l) => l.code === copyFromLocale)?.label || copyFromLocale;
    const toLabel = LOCALES.find((l) => l.code === locale)?.label || locale;
    if (!window.confirm(t('pages.website.confirmCopy', { from: fromLabel, to: toLabel }))) return;
    setSaving(true);
    setError('');
    try {
      const row = await api.copyWebsitePage(slug, locale, copyFromLocale);
      setData(row.data);
      setUpdatedAt(row.updatedAt);
      setDirty(true);
      setMessage(t('pages.website.msgCopied', { from: fromLabel }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const prepareAllLanguages = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await Promise.all(LOCALES.map((item) => api.getWebsitePage(slug, item.code)));
      await loadStats();
      setMessage(t('pages.website.msgAllLanguagesReady'));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const pageLabel = PAGE_LABEL_KEYS[slug] ? t(PAGE_LABEL_KEYS[slug]) : slug;
  const localeLabel = LOCALES.find((l) => l.code === locale)?.label || locale;
  const previewPath = slug === 'nav' || slug === 'home' ? '/' : slug === 'locations' ? '/locations' : `/${slug}`;
  const isNews = slug === 'news';
  const isEvents = slug === 'events';
  const isAnnouncements = slug === 'announcements';
  const isGallery = slug === 'gallery';
  const currentPageCoverage = (stats?.pageCoverage || []).find((p) => p.slug === slug);
  const localeStatus = Object.fromEntries(
    (currentPageCoverage?.locales || []).map((item) => [item.code, item]),
  );

  return (
    <div>
      <PageHeader
        title={t('pages.website.title')}
        description={t('pages.website.description')}
        action={(
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn-secondary text-sm ${view === 'dashboard' ? 'ring-2 ring-brand-200' : ''}`}
              onClick={() => {
                if (!confirmLeaveIfDirty()) return;
                setView('dashboard');
                loadStats();
              }}
            >
              {t('pages.website.dashboard')}
            </button>
            <a href="/" target="_blank" rel="noreferrer" className="btn-secondary text-sm inline-flex items-center gap-1.5">
              <ExternalLink className="w-4 h-4" />
              {t('pages.website.openSite')}
            </a>
          </div>
        )}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="card h-fit lg:sticky lg:top-4 space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('pages.website.workingLanguage')}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {LOCALES.map((item) => {
                const status = localeStatus[item.code];
                const active = locale === item.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      if (view === 'dashboard') {
                        openPage(slug || 'home', item.code);
                        return;
                      }
                      switchLocale(item.code);
                    }}
                    className={`rounded-xl border px-2.5 py-2 text-left transition ${
                      active
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-brand-300'
                    }`}
                    title={item.label}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold">{item.short}</span>
                      {view === 'editor' && status?.ready && (
                        <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white' : 'bg-emerald-500'}`} />
                      )}
                    </div>
                    <p className={`mt-0.5 truncate text-[11px] ${active ? 'text-white/85' : 'text-gray-500'}`}>
                      {item.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('pages.website.sections')}</p>
            <div className="space-y-4">
              {PAGE_GROUPS.map((group) => (
                <div key={group.titleKey}>
                  <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t(group.titleKey)}</p>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon || FileText;
                      const active = item.slug === 'dashboard' ? view === 'dashboard' : view === 'editor' && slug === item.slug;
                      return (
                        <button
                          key={item.slug}
                          type="button"
                          onClick={() => {
                            if (item.slug === 'dashboard') {
                              if (!confirmLeaveIfDirty()) return;
                              setView('dashboard');
                              loadStats();
                              return;
                            }
                            openPage(item.slug, locale);
                          }}
                          className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                            active
                              ? 'bg-brand-600 text-white shadow-sm'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0 opacity-80" />
                          <span className="truncate">{t(item.labelKey)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          {view === 'dashboard' ? (
            <WebsiteDashboard
              stats={stats}
              loading={statsLoading}
              onOpenPage={openPage}
              campusBase={campusBase}
            />
          ) : (
            <div className="card">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-900">{pageLabel}</h2>
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                      {localeLabel}
                    </span>
                    {dirty && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        {t('pages.website.unsavedChanges')}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {t('pages.website.editingIn', { locale: localeLabel })}
                    {updatedAt ? t('pages.website.lastSaved', { date: new Date(updatedAt).toLocaleString() }) : ''}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a href={`${previewPath}?lang=${locale}`} target="_blank" rel="noreferrer" className="btn-secondary text-sm inline-flex items-center gap-1.5">
                    <ExternalLink className="w-4 h-4" />
                    {t('ui.preview')}
                  </a>
                  <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1.5" onClick={prepareAllLanguages} disabled={saving}>
                    <Globe className="w-4 h-4" />
                    {t('pages.website.prepareAllLanguages')}
                  </button>
                  <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1.5" onClick={reset} disabled={saving}>
                    <RefreshCw className="w-4 h-4" />
                    {t('pages.website.reset')}
                  </button>
                  <button type="button" className="btn-primary text-sm inline-flex items-center gap-1.5" onClick={save} disabled={saving || loading || !data}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {t('pages.website.saveLocale', { short: LOCALES.find((l) => l.code === locale)?.short })}
                  </button>
                </div>
              </div>

              <div className="mb-5 rounded-2xl border border-gray-100 bg-gray-50/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {LOCALES.map((item) => {
                      const status = localeStatus[item.code];
                      const active = locale === item.code;
                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => switchLocale(item.code)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                            active
                              ? 'border-gray-900 bg-gray-900 text-white'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                          }`}
                        >
                          <span className="text-[10px] font-bold opacity-70">{item.short}</span>
                          {item.label}
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              status?.ready ? (active ? 'bg-emerald-300' : 'bg-emerald-500') : (active ? 'bg-white/50' : 'bg-gray-300')
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs font-medium text-gray-500">{t('pages.website.copyFrom')}</label>
                    <select
                      className="input !w-auto !py-1.5 text-sm"
                      value={copyFromLocale}
                      onChange={(e) => setCopyFromLocale(e.target.value)}
                    >
                      {LOCALES.filter((l) => l.code !== locale).map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-secondary text-sm inline-flex items-center gap-1.5"
                      onClick={copyFromSelectedLanguage}
                      disabled={saving || copyFromLocale === locale}
                    >
                      <Copy className="w-4 h-4" />
                      {t('pages.website.copyInto', { short: LOCALES.find((l) => l.code === locale)?.short })}
                    </button>
                  </div>
                </div>
              </div>

              {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">{error}</div>}
              {message && <div className="mb-4 p-3 rounded-lg bg-brand-50 border border-brand-100 text-brand-800 text-sm">{message}</div>}

              {loading || !data ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-7 h-7 animate-spin text-brand-600" />
                </div>
              ) : isNews ? (
                <NewsEditor data={data} onChange={setEditorData} />
              ) : isEvents ? (
                <EventsEditor data={data} onChange={setEditorData} />
              ) : isAnnouncements ? (
                <AnnouncementEditor data={data} onChange={setEditorData} />
              ) : isGallery ? (
                <GalleryEditor data={data} onChange={setEditorData} />
              ) : (
                <FieldEditor data={data} onChange={setEditorData} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
