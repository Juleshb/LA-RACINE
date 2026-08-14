/**
 * Public site page intro. With a photo, the image covers the full wall
 * behind the copy instead of sitting in a framed box.
 */
export default function PageHero({ label, title, lead, imageUrl, children }) {
  const hasImage = Boolean(imageUrl);

  return (
    <div className={`ps-page-hero ${hasImage ? 'has-photo' : ''}`}>
      {hasImage && (
        <div className="ps-page-hero-wall" aria-hidden="true">
          <img src={imageUrl} alt="" />
        </div>
      )}
      <div className="ps-page-hero-inner">
        <div className="ps-page-hero-copy">
          {children}
          {label ? <p className="ps-section-label">{label}</p> : null}
          {title ? <h1>{title}</h1> : null}
          {lead ? <p>{lead}</p> : null}
        </div>
      </div>
    </div>
  );
}
