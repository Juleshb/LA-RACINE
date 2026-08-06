import { Link, useOutletContext } from 'react-router-dom';
import AppIcon from '../../components/icons/AppIcon';
import { SchoolMapBlock, DEFAULT_MAP_URL } from './SchoolMapBlock';
import PageHero from '../../components/public/PageHero';

export default function PublicCampuses() {
  const { campuses = [], page } = useOutletContext();
  const c = page('locations');
  const mapUrl = c.mapUrl || DEFAULT_MAP_URL;

  return (
    <>
      <PageHero label={c.label} title={c.title} lead={c.lead} imageUrl={c.heroImageUrl} />

      <section className="ps-section">
        <div className="ps-campus-grid">
          {campuses.length === 0 ? (
            <p className="ps-section-lead">{c.empty}</p>
          ) : campuses.map((campus) => (
            <article key={campus.id || campus.code} className="ps-campus">
              <h3 className="ps-campus-name">
                <AppIcon name="school" className="ps-icon ps-icon--lg" />
                <span>{campus.name}</span>
              </h3>
              <p className="ps-meta-row">
                <AppIcon name="mapOutline" className="ps-icon" />
                <span>{[campus.city, campus.district, campus.province || 'Western'].filter(Boolean).join(', ')}</span>
              </p>
              {campus.address && (
                <p className="ps-meta-row">
                  <AppIcon name="map" className="ps-icon" />
                  <span>{campus.address}</span>
                </p>
              )}
              {campus.phone && (
                <p className="ps-meta-row">
                  <AppIcon name="phone" className="ps-icon" />
                  <a href={`tel:${campus.phone}`}>{campus.phone}</a>
                </p>
              )}
              {campus.email && (
                <p className="ps-meta-row">
                  <AppIcon name="email" className="ps-icon" />
                  <a href={`mailto:${campus.email}`}>{campus.email}</a>
                </p>
              )}
              <a
                className="ps-campus-map-link"
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
              >
                <AppIcon name="directions" className="ps-icon" />
                {c.mapCta || 'Open in Google Maps'}
              </a>
            </article>
          ))}
        </div>

        <SchoolMapBlock
          title={c.mapTitle || 'Find us on the map'}
          lead={c.mapLead || 'Open our school location in Google Maps for directions.'}
          cta={c.mapCta || 'Open in Google Maps'}
          mapUrl={mapUrl}
          embedUrl={c.mapEmbedUrl}
        />

        <div className="ps-cta-row" style={{ marginTop: '2rem' }}>
          <Link to="/contact" className="ps-btn ps-btn-primary">{c.ctaVisit}</Link>
          <Link to="/admissions" className="ps-btn ps-btn-ghost">{c.ctaAdmissions}</Link>
        </div>
      </section>
    </>
  );
}
