import prisma from './prisma.js';
import {
  DEFAULT_WEBSITE_LOCALE,
  WEBSITE_LOCALE_CODES,
  WEBSITE_PAGE_SLUGS,
  normalizeLocale,
} from './websiteLocales.js';
import { getAllDefaultRows, getDefaultPageData, getPageLabel } from './websiteDefaults.js';

export async function ensureWebsiteDefaults() {
  const existing = await prisma.websiteContent.findMany({
    select: { slug: true, locale: true },
  });
  const have = new Set(existing.map((r) => `${r.slug}::${r.locale}`));
  const missing = getAllDefaultRows().filter((row) => !have.has(`${row.slug}::${row.locale}`));
  if (missing.length === 0) return { created: 0 };

  await prisma.websiteContent.createMany({ data: missing });
  return { created: missing.length };
}

export async function getWebsitePagesForLocale(localeInput) {
  await ensureWebsiteDefaults();
  const locale = normalizeLocale(localeInput);

  const rows = await prisma.websiteContent.findMany({
    where: {
      slug: { in: WEBSITE_PAGE_SLUGS },
      locale: { in: [locale, DEFAULT_WEBSITE_LOCALE] },
    },
  });

  const byKey = new Map(rows.map((r) => [`${r.slug}::${r.locale}`, r]));
  const pages = {};

  // Slugs that have items arrays (news, events, gallery, announcements) — if empty, try any locale
  const itemSlugs = ['news', 'events', 'gallery', 'announcements'];

  for (const slug of WEBSITE_PAGE_SLUGS) {
    const defaultData = getDefaultPageData(slug, locale);
    const preferred = byKey.get(`${slug}::${locale}`);
    const fallback = byKey.get(`${slug}::${DEFAULT_WEBSITE_LOCALE}`);
    let chosen = preferred?.data || fallback?.data || defaultData;

    // If this is a content slug with items and items are empty, look in any locale
    if (itemSlugs.includes(slug)) {
      const hasItems = Array.isArray(chosen?.items) && chosen.items.length > 0;
      if (!hasItems) {
        const anyRow = await prisma.websiteContent.findFirst({
          where: { slug },
          orderBy: { updatedAt: 'desc' },
        });
        if (anyRow?.data?.items?.length > 0) {
          chosen = anyRow.data;
        }
      }
    }

    pages[slug] = mergePageData(defaultData, chosen);
  }

  return { locale, pages };
}

export async function listWebsiteAdminContent() {
  await ensureWebsiteDefaults();
  const rows = await prisma.websiteContent.findMany({
    orderBy: [{ slug: 'asc' }, { locale: 'asc' }],
  });
  return rows;
}

export async function getWebsiteAdminPage(slug, localeInput) {
  await ensureWebsiteDefaults();
  if (!WEBSITE_PAGE_SLUGS.includes(slug)) {
    const err = new Error('Unknown page');
    err.status = 404;
    throw err;
  }
  const locale = normalizeLocale(localeInput);
  let row = await prisma.websiteContent.findUnique({
    where: { slug_locale: { slug, locale } },
  });
  if (!row) {
    row = await prisma.websiteContent.create({
      data: {
        slug,
        locale,
        label: getPageLabel(slug),
        data: getDefaultPageData(slug, locale),
      },
    });
  }
  return {
    ...row,
    data: mergePageData(getDefaultPageData(slug, locale), row.data),
  };
}

export async function saveWebsiteAdminPage(slug, localeInput, data, updatedBy) {
  if (!WEBSITE_PAGE_SLUGS.includes(slug)) {
    const err = new Error('Unknown page');
    err.status = 404;
    throw err;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    const err = new Error('Content data must be an object');
    err.status = 400;
    throw err;
  }
  const locale = normalizeLocale(localeInput);
  return prisma.websiteContent.upsert({
    where: { slug_locale: { slug, locale } },
    create: {
      slug,
      locale,
      label: getPageLabel(slug),
      data,
      updatedBy: updatedBy || null,
    },
    update: {
      data,
      label: getPageLabel(slug),
      updatedBy: updatedBy || null,
    },
  });
}

export async function resetWebsiteAdminPage(slug, localeInput, updatedBy) {
  const locale = normalizeLocale(localeInput);
  const data = getDefaultPageData(slug, locale);
  return saveWebsiteAdminPage(slug, locale, data, updatedBy);
}

export async function copyWebsiteFromLocale(slug, fromLocaleInput, toLocaleInput, updatedBy) {
  const fromLocale = normalizeLocale(fromLocaleInput);
  const toLocale = normalizeLocale(toLocaleInput);
  if (fromLocale === toLocale) {
    const err = new Error('Source and target language must differ');
    err.status = 400;
    throw err;
  }
  const source = await getWebsiteAdminPage(slug, fromLocale);
  return saveWebsiteAdminPage(slug, toLocale, structuredClone(source.data), updatedBy);
}

export function getWebsiteMeta() {
  return {
    locales: WEBSITE_LOCALE_CODES.map((code) => ({
      code,
      label: ({ en: 'English', fr: 'French', sw: 'Kiswahili', rw: 'Kinyarwanda' })[code],
      native: ({ en: 'English', fr: 'Français', sw: 'Kiswahili', rw: 'Ikinyarwanda' })[code],
    })),
    pages: WEBSITE_PAGE_SLUGS.map((slug) => ({
      slug,
      label: getPageLabel(slug),
    })),
  };
}

function countItems(data) {
  return Array.isArray(data?.items) ? data.items.length : 0;
}

function countPublished(data) {
  if (!Array.isArray(data?.items)) return 0;
  return data.items.filter((item) => item && item.status !== 'draft').length;
}

function countDrafts(data) {
  if (!Array.isArray(data?.items)) return 0;
  return data.items.filter((item) => item && item.status === 'draft').length;
}

export async function getWebsiteStats() {
  await ensureWebsiteDefaults();

  const [rows, contactTotal, contactOpen, contactReplied, contactClosed, recentContacts] = await Promise.all([
    prisma.websiteContent.findMany({
      where: { slug: { in: WEBSITE_PAGE_SLUGS } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.contactInquiry.count(),
    prisma.contactInquiry.count({ where: { status: 'OPEN' } }),
    prisma.contactInquiry.count({ where: { status: 'REPLIED' } }),
    prisma.contactInquiry.count({ where: { status: 'CLOSED' } }),
    prisma.contactInquiry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        subject: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const bySlugLocale = new Map(rows.map((r) => [`${r.slug}::${r.locale}`, r]));

  const pickPage = (slug) => {
    for (const locale of [DEFAULT_WEBSITE_LOCALE, ...WEBSITE_LOCALE_CODES.filter((c) => c !== DEFAULT_WEBSITE_LOCALE)]) {
      const row = bySlugLocale.get(`${slug}::${locale}`);
      if (row?.data) return row;
    }
    return null;
  };

  const news = pickPage('news');
  const events = pickPage('events');
  const announcements = pickPage('announcements');
  const gallery = pickPage('gallery');

  const pageCoverage = WEBSITE_PAGE_SLUGS.map((slug) => {
    const locales = WEBSITE_LOCALE_CODES.map((locale) => {
      const row = bySlugLocale.get(`${slug}::${locale}`);
      return {
        code: locale,
        ready: Boolean(row),
        itemCount: countItems(row?.data),
        updatedAt: row?.updatedAt || null,
        updatedBy: row?.updatedBy || null,
      };
    });
    const localeRows = locales.filter((l) => l.ready);
    const latest = [...localeRows].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0] || null;
    return {
      slug,
      label: getPageLabel(slug),
      localesReady: localeRows.length,
      localesTotal: WEBSITE_LOCALE_CODES.length,
      itemCount: latest?.itemCount || 0,
      updatedAt: latest?.updatedAt || null,
      updatedBy: latest?.updatedBy || null,
      locales,
    };
  });

  const languageSummary = WEBSITE_LOCALE_CODES.map((code) => {
    const localeRows = rows.filter((r) => r.locale === code);
    const latest = localeRows.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0] || null;
    return {
      code,
      label: ({ en: 'English', fr: 'French', sw: 'Kiswahili', rw: 'Kinyarwanda' })[code],
      native: ({ en: 'English', fr: 'Français', sw: 'Kiswahili', rw: 'Ikinyarwanda' })[code],
      pagesReady: localeRows.length,
      pagesTotal: WEBSITE_PAGE_SLUGS.length,
      updatedAt: latest?.updatedAt || null,
    };
  });

  const recentlyUpdated = rows.slice(0, 8).map((row) => ({
    slug: row.slug,
    label: getPageLabel(row.slug),
    locale: row.locale,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy || null,
  }));

  return {
    overview: {
      pagesTotal: WEBSITE_PAGE_SLUGS.length,
      localesTotal: WEBSITE_LOCALE_CODES.length,
      contentRows: rows.length,
      expectedRows: WEBSITE_PAGE_SLUGS.length * WEBSITE_LOCALE_CODES.length,
      newsTotal: countItems(news?.data),
      eventsPublished: countPublished(events?.data),
      eventsDraft: countDrafts(events?.data),
      announcementsPublished: countPublished(announcements?.data),
      announcementsDraft: countDrafts(announcements?.data),
      galleryImages: countItems(gallery?.data),
      lastContentUpdate: rows[0]?.updatedAt || null,
    },
    contact: {
      total: contactTotal,
      open: contactOpen,
      replied: contactReplied,
      closed: contactClosed,
      recent: recentContacts,
    },
    languageSummary,
    pageCoverage,
    recentlyUpdated,
    ...getWebsiteMeta(),
  };
}

function deepMergeObjects(base, overlay) {
  if (!base || typeof base !== 'object' || Array.isArray(base)) return overlay;
  if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) return overlay ?? base;
  const out = { ...base, ...overlay };
  for (const key of Object.keys(overlay)) {
    const b = base[key];
    const o = overlay[key];
    if (
      b
      && o
      && typeof b === 'object'
      && typeof o === 'object'
      && !Array.isArray(b)
      && !Array.isArray(o)
    ) {
      out[key] = deepMergeObjects(b, o);
    }
  }
  return out;
}

function mergePageData(defaultData, currentData) {
  if (!defaultData || typeof defaultData !== 'object' || Array.isArray(defaultData)) return currentData;
  if (!currentData || typeof currentData !== 'object' || Array.isArray(currentData)) return defaultData;
  return deepMergeObjects(defaultData, currentData);
}
