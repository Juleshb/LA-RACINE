import { useOutletContext } from 'react-router-dom';
import PageHero from '../../components/public/PageHero';

export default function PublicGallery() {
  const { page } = useOutletContext();
  const c = page('gallery');

  const images = (c.items || []).map((item) => {
    if (typeof item === 'string') return { url: item, caption: '' };
    return { url: item.url || item.imageUrl || item.body || '', caption: item.caption || item.title || '' };
  }).filter((img) => img.url);

  return (
    <>
      <PageHero label={c.label} title={c.title} lead={c.lead} imageUrl={c.heroImageUrl} />

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
