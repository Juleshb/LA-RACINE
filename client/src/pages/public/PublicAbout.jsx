import { Link, useOutletContext } from 'react-router-dom';

export default function PublicAbout() {
  const { school, motto, page } = useOutletContext();
  const c = page('about');

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
        <div className="ps-split">
          <div>
            <p className="ps-section-label">{c.missionLabel}</p>
            <h2>{c.missionTitle}</h2>
            <p className="ps-section-lead">{c.missionLead}</p>
          </div>
          <div className="ps-list">
            <div className="ps-list-item">
              <h3>{c.whereTitle}</h3>
              <p>
                {[school?.city, school?.district, school?.province, school?.country]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="ps-list-item">
              <h3>{c.valuesTitle}</h3>
              <p>{motto}</p>
            </div>
            <div className="ps-list-item">
              <h3>{c.familiesTitle}</h3>
              <p>{c.familiesBody}</p>
            </div>
          </div>
        </div>
        <div className="ps-cta-row">
          <Link to="/locations" className="ps-btn ps-btn-primary">{c.ctaCampuses}</Link>
          <Link to="/admissions" className="ps-btn ps-btn-ghost">{c.ctaAdmissions}</Link>
        </div>
      </section>
    </>
  );
}
