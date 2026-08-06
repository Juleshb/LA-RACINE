import { Link, useOutletContext } from 'react-router-dom';
import ProgramCard from '../../components/public/ProgramCard';
import PageHero from '../../components/public/PageHero';

export default function PublicAcademics() {
  const { page } = useOutletContext();
  const c = page('academics') || {};
  const programs = Array.isArray(c.programs) ? c.programs.filter((p) => p?.title) : [];

  return (
    <>
      <PageHero label={c.label} title={c.title} lead={c.lead} imageUrl={c.heroImageUrl} />

      <section className="ps-section">
        <div className="ps-program-grid ps-program-grid-rich">
          {programs.map((item, index) => (
            <ProgramCard
              key={item.slug || item.title || index}
              program={item}
              index={index}
              exploreLabel={c.exploreLabel || 'Explore program'}
              featured={index === 1}
            />
          ))}
        </div>
        <div className="ps-cta-row" style={{ marginTop: '2.5rem' }}>
          <Link to="/admissions/apply" className="ps-btn ps-btn-primary">{c.ctaPlacement}</Link>
          <Link to="/login" className="ps-btn ps-btn-ghost">{c.ctaPortal}</Link>
        </div>
      </section>
    </>
  );
}
