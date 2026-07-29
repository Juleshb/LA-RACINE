import { useOutletContext } from 'react-router-dom';

export default function PublicGallery() {
  const { page } = useOutletContext();
  const c = page('gallery');

  const images = (c.items || []).map((item) => {
    if (typeof item === 'string') return { url: item, caption: '' };
    return { url: item.url || item.imageUrl || item.body || '', caption: item.caption || item.title || '' };
  }).filter((img) => img.url);

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
        {images.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666' }}>No images in the gallery yet.</p>
        ) : (
          <div className="ps-gallery-grid">
            {images.map((img, index) => (
              <figure key={index} className="ps-gallery-item">
                <img src={img.url} alt={img.caption || `Gallery ${index + 1}`} loading="lazy" />
                {img.caption && <figcaption>{img.caption}</figcaption>}
              </figure>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
