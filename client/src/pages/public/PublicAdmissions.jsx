import { Link, useOutletContext } from 'react-router-dom';
import PageHero from '../../components/public/PageHero';

export default function PublicAdmissions() {
  const { page } = useOutletContext();
  const c = page('admissions');

  return (
    <>
      <PageHero label={c.label} title={c.title} lead={c.lead} imageUrl={c.heroImageUrl} />

      <section className="ps-section">
        <div className="ps-steps">
          {(c.steps || []).map((step) => (
            <div key={step.title} className="ps-step">
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="ps-cta-row" style={{ marginTop: '2.5rem' }}>
          <Link to="/admissions/apply" className="ps-btn ps-btn-primary">
            {c.ctaApply || 'Apply online'}
          </Link>
          <Link to="/contact" className="ps-btn ps-btn-ghost">{c.ctaContact}</Link>
          <Link to="/login" className="ps-btn ps-btn-ghost">{c.ctaPortal}</Link>
        </div>
      </section>
    </>
  );
}
