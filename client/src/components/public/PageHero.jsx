/**
 * Public site page intro (“hello”) section with optional photo.
 */
export default function PageHero({ label, title, lead, imageUrl, children }) {
  const hasImage = Boolean(imageUrl);

  return (
    <div className={`ps-page-hero ${hasImage ? 'has-photo' : ''}`}>
      <div className="ps-page-hero-inner">
        <div className="ps-page-hero-copy">
          {children}
          {label ? <p className="ps-section-label">{label}</p> : null}
          {title ? <h1>{title}</h1> : null}
          {lead ? <p>{lead}</p> : null}
        </div>
        {hasImage ? (
          <div className="ps-page-hero-media">
            <img src={imageUrl} alt="" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
