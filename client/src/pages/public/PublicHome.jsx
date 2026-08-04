import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { getYouTubeEmbedUrl, parseYouTubeId } from '../../lib/youtube';
import ProgramCard from '../../components/public/ProgramCard';
import { enrichProgramCard } from './programUtils';

function formatDate(value, locale) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  try {
    return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : locale === 'rw' ? 'rw-RW' : locale === 'sw' ? 'sw-TZ' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

function newsImage(item) {
  if (!item) return '';
  if (Array.isArray(item.images) && item.images.length) {
    const first = item.images[0];
    return typeof first === 'string' ? first : (first?.url || first?.imageUrl || '');
  }
  return item.imageUrl || '';
}

function galleryImage(item) {
  if (!item) return '';
  return item.body || item.imageUrl || item.url || '';
}

/**
 * Landing page — all copy, slides, stats, programs, testimonials, and CTAs
 * come from Website CMS (`home` slug). News cards + gallery images come from
 * their own CMS pages (`news`, `gallery`).
 */
export default function PublicHome() {
  const { school, campuses, page, locale } = useOutletContext();
  const c = page('home') || {};
  const news = page('news') || {};
  const gallery = page('gallery') || {};
  const academics = page('academics') || {};

  const brand = (school?.name || 'École La RACINE').replace(/\s*school\s*$/i, '').trim();
  const videoId = parseYouTubeId(c.heroVideoUrl || '');
  const posterUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    : c.heroImageUrl;
  const embedUrl = useMemo(() => {
    if (!videoId) return '';
    return getYouTubeEmbedUrl(videoId, { autoplay: true, muted: true, background: true });
  }, [videoId]);

  const slides = useMemo(() => {
    const fromCms = Array.isArray(c.heroSlides) ? c.heroSlides.filter((s) => s?.title || s?.body) : [];
    if (fromCms.length) return fromCms;
    if (!c.heroTitle && !c.heroLine && !c.heroImageUrl) return [];
    return [
      {
        eyebrow: c.heroEyebrow || c.promiseTitle || '',
        title: c.heroTitle || '',
        body: c.heroLine || '',
        ctaPrimary: c.heroCtaPrimary || '',
        ctaPrimaryTo: '/admissions/apply',
        ctaSecondary: c.heroCtaSecondary || '',
        ctaSecondaryTo: '/locations',
        imageUrl: c.heroImageUrl || '',
      },
    ];
  }, [c]);

  const [slide, setSlide] = useState(0);
  useEffect(() => {
    setSlide(0);
  }, [slides.length, locale]);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const id = window.setInterval(() => {
      setSlide((s) => (s + 1) % slides.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, [slides.length]);

  const active = slides[slide] || slides[0] || {};
  const campusCount = campuses?.length || c.stats?.campuses || '';

  const programs = useMemo(() => {
    const cards = Array.isArray(c.programs) ? c.programs.filter((p) => p?.title) : [];
    const academicsPrograms = Array.isArray(academics.programs) ? academics.programs : [];
    return cards.map((card) => enrichProgramCard(card, academicsPrograms));
  }, [c.programs, academics.programs]);
  const whyItems = (Array.isArray(c.whyChoose) && c.whyChoose.length
    ? c.whyChoose
    : (c.values || [])).filter((item) => item?.title);
  const voices = Array.isArray(c.testimonials) ? c.testimonials.filter((t) => t?.quote) : [];
  const newsItems = Array.isArray(news.items) ? news.items.slice(0, 6) : [];
  const galleryItems = Array.isArray(gallery.items) ? gallery.items.slice(0, 8) : [];
  const stats = c.stats || {};

  return (
    <>
      <section className="ps-hero">
        <div className="ps-hero-media" aria-hidden="true">
          {(active.imageUrl || posterUrl || c.heroImageUrl) && (
            <img
              className="ps-hero-poster"
              src={active.imageUrl || posterUrl || c.heroImageUrl}
              alt=""
              fetchPriority="high"
            />
          )}
          {slide === 0 && embedUrl && (
            <iframe
              className="ps-hero-video"
              src={embedUrl}
              title={brand}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              tabIndex={-1}
            />
          )}
        </div>
        <div className="ps-hero-content">
          {active.eyebrow && <p className="ps-hero-eyebrow">{active.eyebrow}</p>}
          <p className="ps-hero-brand">{brand}</p>
          {active.title && <h1 className="ps-hero-title">{active.title}</h1>}
          {(active.body || c.heroLine) && (
            <p className="ps-hero-line">{active.body || c.heroLine}</p>
          )}
          <div className="ps-hero-actions">
            {(active.ctaPrimary || c.heroCtaPrimary) && (
              <Link to={active.ctaPrimaryTo || '/admissions/apply'} className="ps-btn ps-btn-primary">
                {active.ctaPrimary || c.heroCtaPrimary}
              </Link>
            )}
            {(active.ctaSecondary || c.heroCtaSecondary) && (
              <Link to={active.ctaSecondaryTo || '/locations'} className="ps-btn ps-btn-light">
                {active.ctaSecondary || c.heroCtaSecondary}
              </Link>
            )}
          </div>
          {slides.length > 1 && (
            <div className="ps-hero-dots" role="tablist" aria-label="Hero slides">
              {slides.map((s, i) => (
                <button
                  key={s.title || i}
                  type="button"
                  role="tab"
                  aria-selected={i === slide}
                  className={`ps-hero-dot ${i === slide ? 'is-active' : ''}`}
                  onClick={() => setSlide(i)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {(stats.campuses || stats.students || stats.languages || stats.focus || campusCount) && (
        <section className="ps-stats" aria-label="School at a glance">
          <div className="ps-stats-inner">
            <div className="ps-stat">
              <strong>{stats.campuses ?? campusCount}</strong>
              <span>{c.statCampusesLabel}</span>
            </div>
            <div className="ps-stat">
              <strong>{stats.students}</strong>
              <span>{c.statStudentsLabel}</span>
            </div>
            <div className="ps-stat">
              <strong>{stats.languages}</strong>
              <span>{c.statLanguagesLabel}</span>
            </div>
            <div className="ps-stat">
              <strong>{stats.focus}</strong>
              <span>{c.statFocusLabel}</span>
            </div>
          </div>
        </section>
      )}

      {(c.programsTitle || programs.length > 0) && (
        <section className="ps-section ps-programs">
          <div className="ps-section-head">
            {c.programsLabel && <p className="ps-section-label">{c.programsLabel}</p>}
            {c.programsTitle && <h2>{c.programsTitle}</h2>}
            {c.programsLead && <p className="ps-section-lead">{c.programsLead}</p>}
          </div>
          {programs.length > 0 && (
            <div className="ps-program-grid">
              {programs.map((item, index) => (
                <ProgramCard
                  key={item.slug || item.title || index}
                  program={item}
                  index={index}
                  exploreLabel={c.programsExplore || 'Explore program'}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {!!newsItems.length && (
        <section className="ps-section ps-home-news">
          <div className="ps-section-head ps-section-head-row">
            <div>
              {c.newsLabel && <p className="ps-section-label">{c.newsLabel}</p>}
              {c.newsTitle && <h2>{c.newsTitle}</h2>}
              {(c.newsLead || news.lead) && (
                <p className="ps-section-lead">{c.newsLead || news.lead}</p>
              )}
            </div>
            {c.newsAll && (
              <Link to="/news" className="ps-btn ps-btn-ghost">{c.newsAll}</Link>
            )}
          </div>
          <div className="ps-home-news-grid">
            {newsItems.map((item, index) => {
              const img = newsImage(item);
              return (
                <Link key={`${item.title}-${index}`} to={`/news/${index}`} className="ps-home-news-card">
                  <div className="ps-home-news-media">
                    {img ? <img src={img} alt="" /> : <div className="ps-home-news-placeholder" />}
                  </div>
                  <div className="ps-home-news-body">
                    <div className="ps-home-news-meta">
                      {item.category && <span>{item.category}</span>}
                      {item.publishedAt && <time>{formatDate(item.publishedAt, locale)}</time>}
                    </div>
                    <h3>{item.title}</h3>
                    {item.summary && <p>{item.summary}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {(c.whyTitle || whyItems.length > 0) && (
        <section className="ps-why">
          <div className="ps-why-inner">
            {(c.whoImageUrl || c.whyImageUrl) && (
              <div className="ps-why-visual">
                <img src={c.whoImageUrl || c.whyImageUrl} alt={c.whoImageAlt || ''} />
                {c.whyCaption && <p className="ps-why-caption">{c.whyCaption}</p>}
              </div>
            )}
            <div className="ps-why-copy">
              {(c.whyLabel || c.promiseLabel) && (
                <p className="ps-section-label">{c.whyLabel || c.promiseLabel}</p>
              )}
              {(c.whyTitle || c.promiseTitle) && <h2>{c.whyTitle || c.promiseTitle}</h2>}
              {(c.whyLead || c.promiseLead) && (
                <p className="ps-section-lead">{c.whyLead || c.promiseLead}</p>
              )}
              {whyItems.length > 0 && (
                <div className="ps-why-grid">
                  {whyItems.map((item) => (
                    <article key={item.title} className="ps-why-item">
                      <h3>{item.title}</h3>
                      {item.body && <p>{item.body}</p>}
                    </article>
                  ))}
                </div>
              )}
              <div className="ps-cta-row">
                {c.whoCtaStory && (
                  <Link to="/about" className="ps-btn ps-btn-primary">{c.whoCtaStory}</Link>
                )}
                {(c.whoCtaAcademics || c.heroCtaSecondary) && (
                  <Link to="/locations" className="ps-btn ps-btn-ghost">
                    {c.whoCtaAcademics || c.heroCtaSecondary}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {!!galleryItems.length && (
        <section className="ps-section ps-home-gallery">
          <div className="ps-section-head">
            {c.galleryLabel && <p className="ps-section-label">{c.galleryLabel}</p>}
            {c.galleryTitle && <h2>{c.galleryTitle}</h2>}
            {(c.galleryLead || gallery.lead) && (
              <p className="ps-section-lead">{c.galleryLead || gallery.lead}</p>
            )}
          </div>
          <div className="ps-home-gallery-track">
            {galleryItems.map((item, index) => {
              const src = galleryImage(item);
              if (!src) return null;
              return (
                <figure key={item.title || src || index} className="ps-home-gallery-item">
                  <img src={src} alt={item.title || ''} />
                  {item.title && <figcaption>{item.title}</figcaption>}
                </figure>
              );
            })}
          </div>
          {c.galleryAll && (
            <div className="ps-cta-row" style={{ marginTop: '1.75rem' }}>
              <Link to="/gallery" className="ps-btn ps-btn-ghost">{c.galleryAll}</Link>
            </div>
          )}
        </section>
      )}

      {!!voices.length && (
        <section className="ps-voices">
          <div className="ps-section">
            <div className="ps-section-head">
              {c.voicesLabel && <p className="ps-section-label">{c.voicesLabel}</p>}
              {c.voicesTitle && <h2>{c.voicesTitle}</h2>}
              {c.voicesLead && <p className="ps-section-lead">{c.voicesLead}</p>}
            </div>
            <div className="ps-voices-grid">
              {voices.map((item) => (
                <blockquote key={`${item.name}-${item.quote?.slice(0, 24)}`} className="ps-voice">
                  <p>{item.quote}</p>
                  <footer>
                    {item.name && <strong>{item.name}</strong>}
                    {item.role && <span>{item.role}</span>}
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      )}

      {(c.nextTitle || c.nextLead) && (
        <section className="ps-trust">
          <div className="ps-trust-inner">
            {c.nextLabel && <p className="ps-trust-label">{c.nextLabel}</p>}
            {c.nextTitle && <h2>{c.nextTitle}</h2>}
            {c.nextLead && <p>{c.nextLead}</p>}
            <div className="ps-cta-row">
              {(c.nextCtaAdmissions || c.heroCtaPrimary) && (
                <Link to="/admissions/apply" className="ps-btn ps-btn-primary">
                  {c.nextCtaAdmissions || c.heroCtaPrimary}
                </Link>
              )}
              {c.nextCtaContact && (
                <Link to="/contact" className="ps-btn ps-btn-light">{c.nextCtaContact}</Link>
              )}
              {c.nextCtaPortal && (
                <Link to="/login" className="ps-btn ps-btn-ghost ps-btn-on-dark">{c.nextCtaPortal}</Link>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
