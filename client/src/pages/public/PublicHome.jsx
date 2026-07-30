import { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { getYouTubeEmbedUrl, parseYouTubeId } from '../../lib/youtube';

const DEFAULT_HERO_VIDEO = 'https://youtu.be/MAf3va2bK5w';

const TOOLS = [
  { to: '/admissions', labelKey: 'heroCtaPrimary', fallback: 'Admissions' },
  { to: '/locations', labelKey: 'heroCtaSecondary', fallback: 'Campuses' },
  { to: '/academics', labelKey: 'whoCtaAcademics', fallback: 'Academics' },
  { to: '/login', labelKey: 'nextCtaPortal', fallback: 'Family portal' },
];

export default function PublicHome() {
  const { school, page } = useOutletContext();
  const c = page('home');
  const brand = (school?.name || 'École La RACINE').replace(/\s*school\s*$/i, '').trim();
  const videoId = parseYouTubeId(c.heroVideoUrl || DEFAULT_HERO_VIDEO);
  const posterUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    : c.heroImageUrl;
  const embedUrl = useMemo(() => {
    if (!videoId) return '';
    return getYouTubeEmbedUrl(videoId, { autoplay: true, muted: true, background: true });
  }, [videoId]);

  return (
    <>
      <section className="ps-hero">
        <div className="ps-hero-media" aria-hidden="true">
          <img className="ps-hero-poster" src={posterUrl || c.heroImageUrl} alt="" fetchPriority="high" />
          {embedUrl && (
            <iframe
              className="ps-hero-video"
              src={embedUrl}
              title="École La RACINE"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              tabIndex={-1}
            />
          )}
        </div>
        <div className="ps-hero-content">
          <p className="ps-hero-eyebrow">{c.promiseTitle || 'Discipline · Intelligence · Innovation'}</p>
          <h1 className="ps-hero-brand">{brand}</h1>
          <p className="ps-hero-line">{c.heroLine}</p>
          <div className="ps-hero-actions">
            <Link to="/admissions/apply" className="ps-btn ps-btn-primary">{c.heroCtaPrimary}</Link>
            <Link to="/locations" className="ps-btn ps-btn-light">{c.heroCtaSecondary}</Link>
          </div>
        </div>
      </section>

      <section className="ps-tools-wrap">
        <div className="ps-tools">
          <div className="ps-tools-copy">
            <p className="ps-section-label">{c.whoLabel || 'Explore'}</p>
            <h2>{c.whoTitle}</h2>
            <p>{c.whoLead}</p>
          </div>
          <div className="ps-tools-grid">
            {TOOLS.map((tool) => (
              <Link key={tool.to} to={tool.to} className="ps-tool">
                <span>{c[tool.labelKey] || tool.fallback}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="ps-features-wrap">
        <div className="ps-section">
          <p className="ps-section-label">{c.promiseLabel}</p>
          <h2 className="ps-features-title">{c.promiseTitle}</h2>
          <p className="ps-section-lead">{c.promiseLead}</p>
          <div className="ps-features">
            {(c.values || []).map((item, index) => (
              <article key={item.title} className="ps-feature">
                <span className="ps-feature-num">{String(index + 1).padStart(2, '0')}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ps-section">
        <div className="ps-split ps-split-story">
          <div>
            <p className="ps-section-label">{c.whoLabel}</p>
            <h2>{c.whoTitle}</h2>
            <p className="ps-section-lead">{c.whoLead}</p>
            <div className="ps-cta-row">
              <Link to="/about" className="ps-btn ps-btn-primary">{c.whoCtaStory}</Link>
              <Link to="/academics" className="ps-btn ps-btn-ghost">{c.whoCtaAcademics}</Link>
            </div>
          </div>
          <div className="ps-photo-frame">
            <img className="ps-photo" src={c.whoImageUrl} alt={c.whoImageAlt || ''} />
          </div>
        </div>
      </section>

      <section className="ps-trust">
        <div className="ps-trust-inner">
          <p className="ps-trust-label">{c.nextLabel}</p>
          <h2>{c.nextTitle}</h2>
          <p>{c.nextLead}</p>
          <div className="ps-cta-row">
            <Link to="/admissions" className="ps-btn ps-btn-primary">{c.nextCtaAdmissions}</Link>
            <Link to="/contact" className="ps-btn ps-btn-light">{c.nextCtaContact}</Link>
            <Link to="/login" className="ps-btn ps-btn-ghost ps-btn-on-dark">{c.nextCtaPortal}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
