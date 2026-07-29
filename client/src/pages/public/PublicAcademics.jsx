import { Link, useOutletContext } from 'react-router-dom';

export default function PublicAcademics() {
  const { page } = useOutletContext();
  const c = page('academics');

  return (
    <>
      <div className="ps-page-hero">
        <div className="ps-page-hero-inner">
          <p className="ps-section-label">{c.label}</p>
          <h1>{c.title}</h1>
          <p>{c.lead}</p>
        </div>
      </div>

      <section className="ps-section">
        <div className="ps-list">
          {(c.programs || []).map((item) => (
            <div key={item.title} className="ps-list-item">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
        <div className="ps-cta-row" style={{ marginTop: '2.5rem' }}>
          <Link to="/admissions" className="ps-btn ps-btn-primary">{c.ctaPlacement}</Link>
          <Link to="/login" className="ps-btn ps-btn-ghost">{c.ctaPortal}</Link>
        </div>
      </section>
    </>
  );
}
