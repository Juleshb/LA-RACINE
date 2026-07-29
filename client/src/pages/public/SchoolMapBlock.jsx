import AppIcon from '../../components/icons/AppIcon';

/** Google Maps short link for École La Racine */
export const DEFAULT_MAP_URL = 'https://maps.app.goo.gl/GGVeh9pcUptx14oG6';

/** Resolved pin for reliable iframe embed (short links do not embed well) */
export const DEFAULT_MAP_EMBED =
  'https://maps.google.com/maps?q=-1.6948639,29.2523412&z=17&output=embed';

export function SchoolMapBlock({ title, lead, cta, mapUrl = DEFAULT_MAP_URL, embedUrl }) {
  const href = mapUrl || DEFAULT_MAP_URL;
  const src = embedUrl || DEFAULT_MAP_EMBED;

  return (
    <div className="ps-map-block">
      <div className="ps-map-copy">
        <h2 className="ps-map-heading">
          <AppIcon name="map" className="ps-icon ps-icon--lg" />
          <span>{title}</span>
        </h2>
        {lead && <p>{lead}</p>}
        <a className="ps-btn ps-btn-primary" href={href} target="_blank" rel="noreferrer">
          <AppIcon name="directions" className="ps-icon" />
          {cta}
        </a>
      </div>
      <div className="ps-map-frame">
        <iframe
          title={title || 'School location map'}
          src={src}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
        <a className="ps-map-overlay-link" href={href} target="_blank" rel="noreferrer">
          <AppIcon name="externalLink" className="ps-icon" />
          {cta}
        </a>
      </div>
    </div>
  );
}
