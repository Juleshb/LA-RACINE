import { useOutletContext } from 'react-router-dom';
import PageHero from '../../components/public/PageHero';
import { galleryAlbums } from '../../lib/galleryAlbums';

export default function PublicGallery() {
  const { page } = useOutletContext();
  const c = page('gallery');
  const albums = galleryAlbums(c.items);

  return (
    <>
      <PageHero label={c.label} title={c.title} lead={c.lead} imageUrl={c.heroImageUrl} />

      <section className="ps-section">
        {albums.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666' }}>No albums yet.</p>
        ) : (
          <div className="ps-gallery-grid">
            {albums.map((album, index) => {
              const card = (
                <>
                  <div className="ps-gallery-cover">
                    {album.coverUrl ? (
                      <img src={album.coverUrl} alt="" loading="lazy" />
                    ) : (
                      <div className="ps-gallery-cover-empty" />
                    )}
                  </div>
                  <div className="ps-gallery-meta">
                    <strong>{album.title || `Album ${index + 1}`}</strong>
                    {album.albumUrl ? <span>Open album</span> : null}
                  </div>
                </>
              );

              if (album.albumUrl) {
                return (
                  <a
                    key={`${album.title}-${index}`}
                    href={album.albumUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ps-gallery-item ps-gallery-album"
                  >
                  {card}
                </a>
              );
            }

            return (
              <div key={`${album.title}-${index}`} className="ps-gallery-item ps-gallery-album">
                {card}
              </div>
            );
            })}
          </div>
        )}
      </section>
    </>
  );
}
