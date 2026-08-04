import { Link } from 'react-router-dom';

function slugify(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Rich program card used on Home + Academics listing.
 * Whole card is clickable; optional featured emphasis.
 */
export default function ProgramCard({ program, index = 0, exploreLabel = 'Explore program', featured = false }) {
  if (!program?.title) return null;

  const slug = program.slug || slugify(program.title);
  const to = program.to || `/academics/${slug}`;
  const points = (program.points || program.approachHighlights || []).filter(Boolean).slice(0, 4);
  const facts = (program.cardFacts || program.features || []).filter(Boolean).slice(0, 3);
  const cta = program.cta || exploreLabel;

  return (
    <article className={`ps-program-card ${featured || index === 1 ? 'is-featured' : ''}`}>
      <Link to={to} className="ps-program-card-link">
        <div className="ps-program-card-media">
          {program.imageUrl ? (
            <img src={program.imageUrl} alt="" loading="lazy" />
          ) : (
            <div className="ps-program-card-media-fallback" aria-hidden="true" />
          )}
          <div className="ps-program-card-media-shade" aria-hidden="true" />
          {program.tag && <span className="ps-program-card-tag">{program.tag}</span>}
          {program.ages && <span className="ps-program-card-ages">{program.ages}</span>}
          {(featured || index === 1) && program.badge && (
            <span className="ps-program-card-badge">{program.badge}</span>
          )}
        </div>

        <div className="ps-program-card-body">
          <div className="ps-program-card-top">
            <h3>{program.title}</h3>
            {program.levelLine && <p className="ps-program-card-level">{program.levelLine}</p>}
          </div>

          {program.body && <p className="ps-program-card-copy">{program.body}</p>}

          {!!facts.length && (
            <div className="ps-program-card-facts">
              {facts.map((fact) => (
                <span key={fact}>{fact}</span>
              ))}
            </div>
          )}

          {!!points.length && (
            <ul className="ps-program-card-points">
              {points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          )}

          <span className="ps-program-card-cta">
            {cta}
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <path fill="currentColor" d="M7.3 4.7a1 1 0 0 1 1.4 0L13 9.05a1.3 1.3 0 0 1 0 1.9l-4.3 4.35a1 1 0 1 1-1.4-1.42L10.88 10 7.3 6.12a1 1 0 0 1 0-1.42Z" />
            </svg>
          </span>
        </div>
      </Link>
    </article>
  );
}

export { slugify };
