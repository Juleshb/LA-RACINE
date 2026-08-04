import { Link, Navigate, useOutletContext, useParams } from 'react-router-dom';
import { findProgram, slugify } from './programUtils';

/**
 * Program detail page — rich overview for Nursery / Primary / etc.
 * Content from Website CMS → Academics → programs[].
 */
export default function PublicProgramDetail() {
  const { programSlug } = useParams();
  const { page } = useOutletContext();
  const academics = page('academics') || {};
  const home = page('home') || {};
  const program = findProgram(academics, home, programSlug);
  const allPrograms = Array.isArray(academics.programs) ? academics.programs : [];

  if (!program) {
    return <Navigate to="/academics" replace />;
  }

  const highlights = program.approachHighlights || program.points || [];
  const offerings = Array.isArray(program.offerings) ? program.offerings : [];
  const features = Array.isArray(program.features) ? program.features : [];
  const facts = Array.isArray(program.detailFacts) ? program.detailFacts : (program.cardFacts || []);
  const heroImage = program.approachImageUrl || program.imageUrl || academics.heroImageUrl;
  const related = allPrograms
    .filter((p) => (p.slug || slugify(p.title)) !== (program.slug || slugify(program.title)))
    .slice(0, 2);

  return (
    <>
      <section className="ps-program-detail-hero">
        <div className="ps-program-detail-hero-media" aria-hidden="true">
          {heroImage && <img src={heroImage} alt="" />}
        </div>
        <div className="ps-program-detail-hero-inner">
          <p className="ps-section-label ps-program-detail-crumb">
            <Link to="/academics" className="ps-crumb">{academics.label || 'Academics'}</Link>
            <span aria-hidden="true"> / </span>
            {program.tag || program.title}
          </p>
          {program.ages && <p className="ps-program-detail-ages">{program.ages}</p>}
          <h1>{program.detailTitle || program.title}</h1>
          <p className="ps-program-detail-lead">{program.detailLead || program.body}</p>
          <div className="ps-hero-actions">
            <Link to="/admissions/apply" className="ps-btn ps-btn-primary">
              {program.ctaEnroll || academics.ctaPlacement || 'Apply now'}
            </Link>
            <Link to="/contact" className="ps-btn ps-btn-light">
              {program.ctaVisit || 'Schedule a visit'}
            </Link>
          </div>
        </div>
      </section>

      {!!facts.length && (
        <section className="ps-program-factstrip" aria-label="Program facts">
          <div className="ps-program-factstrip-inner">
            {facts.map((fact) => (
              <div key={fact.label || fact} className="ps-program-fact">
                <strong>{fact.value || fact}</strong>
                {fact.label && <span>{fact.label}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="ps-section ps-program-approach">
        <div className="ps-program-approach-grid">
          <div>
            <p className="ps-section-label">{program.heroEyebrow || program.tag || 'Program'}</p>
            <h2>{program.approachTitle || program.title}</h2>
            <p className="ps-section-lead">{program.approachBody || program.body}</p>
            {!!highlights.length && (
              <ul className="ps-program-pills">
                {highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            <div className="ps-cta-row" style={{ marginTop: '1.5rem' }}>
              <Link to="/admissions/apply" className="ps-btn ps-btn-primary">
                {program.ctaEnroll || 'Apply now'}
              </Link>
              <Link to="/locations" className="ps-btn ps-btn-ghost">
                {academics.ctaCampuses || 'Our campuses'}
              </Link>
            </div>
          </div>
          {heroImage && (
            <div className="ps-program-approach-media">
              <img src={heroImage} alt={program.title || ''} />
              {program.levelLine && <p className="ps-program-approach-caption">{program.levelLine}</p>}
            </div>
          )}
        </div>
      </section>

      {(program.offeringsTitle || offerings.length > 0) && (
        <section className="ps-section ps-program-offerings">
          <div className="ps-section-head">
            {program.offeringsTitle && <h2>{program.offeringsTitle}</h2>}
            {program.offeringsLead && <p className="ps-section-lead">{program.offeringsLead}</p>}
          </div>
          <div className="ps-program-offer-grid">
            {offerings.map((item, index) => (
              <article key={item.title || index} className="ps-program-offer-card">
                {item.imageUrl && (
                  <div className="ps-program-offer-media">
                    <img src={item.imageUrl} alt="" loading="lazy" />
                  </div>
                )}
                <div className="ps-program-offer-body">
                  {item.tag && <p className="ps-program-offer-tag">{item.tag}</p>}
                  <h3>{item.title}</h3>
                  {item.body && <p>{item.body}</p>}
                  {!!item.points?.length && (
                    <ul>
                      {item.points.filter(Boolean).map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  )}
                  {item.cta && (
                    <Link to={item.to || '/admissions/apply'} className="ps-program-card-cta">
                      {item.cta}
                      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                        <path fill="currentColor" d="M7.3 4.7a1 1 0 0 1 1.4 0L13 9.05a1.3 1.3 0 0 1 0 1.9l-4.3 4.35a1 1 0 1 1-1.4-1.42L10.88 10 7.3 6.12a1 1 0 0 1 0-1.42Z" />
                      </svg>
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!!related.length && (
        <section className="ps-section">
          <div className="ps-section-head">
            <p className="ps-section-label">{academics.relatedLabel || 'Keep exploring'}</p>
            <h2>{academics.relatedTitle || 'Other programs'}</h2>
          </div>
          <div className="ps-program-grid">
            {related.map((item, index) => {
              const slug = item.slug || slugify(item.title);
              return (
                <article key={slug} className="ps-program-card">
                  <Link to={`/academics/${slug}`} className="ps-program-card-link">
                    <div className="ps-program-card-media">
                      {item.imageUrl && <img src={item.imageUrl} alt="" loading="lazy" />}
                      <div className="ps-program-card-media-shade" aria-hidden="true" />
                      {item.tag && <span className="ps-program-card-tag">{item.tag}</span>}
                    </div>
                    <div className="ps-program-card-body">
                      <h3>{item.title}</h3>
                      {item.body && <p className="ps-program-card-copy">{item.body}</p>}
                      <span className="ps-program-card-cta">
                        {item.cta || academics.exploreLabel || 'Explore'}
                        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                          <path fill="currentColor" d="M7.3 4.7a1 1 0 0 1 1.4 0L13 9.05a1.3 1.3 0 0 1 0 1.9l-4.3 4.35a1 1 0 1 1-1.4-1.42L10.88 10 7.3 6.12a1 1 0 0 1 0-1.42Z" />
                        </svg>
                      </span>
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {(program.readyTitle || program.readyLead) && (
        <section className="ps-trust ps-program-ready">
          <div className="ps-trust-inner">
            {program.readyTitle && <h2>{program.readyTitle}</h2>}
            {program.readyLead && <p>{program.readyLead}</p>}
            {!!features.length && (
              <ul className="ps-program-features">
                {features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
            <div className="ps-cta-row">
              <Link to="/admissions/apply" className="ps-btn ps-btn-primary">
                {program.ctaEnroll || 'Enroll now'}
              </Link>
              <Link to="/contact" className="ps-btn ps-btn-light">
                {program.ctaVisit || 'Schedule a visit'}
              </Link>
              <Link to="/academics" className="ps-btn ps-btn-ghost ps-btn-on-dark">
                {academics.backToPrograms || 'All programs'}
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
