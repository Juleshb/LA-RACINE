import { useMemo } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import EmbeddedYouTube from '../../components/media/EmbeddedYouTube';
import { parseYouTubeId } from '../../lib/youtube';

export default function PublicAnnouncements() {
  const { announcementIndex } = useParams();
  const { page } = useOutletContext();
  const c = page('announcements');

  const list = useMemo(() => {
    const items = Array.isArray(c.items) ? c.items : [];
    return items
      .filter((item) => item && item.title && item.status !== 'draft')
      .map((item) => ({
        title: item.title || '',
        summary: item.summary || item.content || item.body || '',
        content: item.content || item.body || '',
        images: Array.isArray(item.images) ? item.images : [],
        documentImageUrl: item.documentImageUrl || '',
        documentUrl: item.documentUrl || '',
        documentLabel: item.documentLabel || 'Document',
        videoUrl: item.videoUrl || '',
        linkUrl: item.linkUrl || '',
        linkLabel: item.linkLabel || 'Open link',
        publishedAt: item.publishedAt || item.date || '',
      }))
      .sort((a, b) => {
        const ad = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const bd = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        if (!ad && !bd) return 0;
        if (!ad) return 1;
        if (!bd) return -1;
        return bd - ad;
      });
  }, [c.items]);

  const index = announcementIndex !== undefined ? parseInt(announcementIndex, 10) : NaN;
  const item = Number.isFinite(index) ? list[index] : null;

  if (item && announcementIndex !== undefined) {
    const images = item.images || [];
    const thumbnail = images[0] || item.documentImageUrl || '';
    const youtubeId = item.videoUrl ? parseYouTubeId(item.videoUrl) : null;

    return (
      <>
        <div className="ps-page-hero">
          <div className="ps-page-hero-inner">
            <Link to="/announcements" className="ps-back-link">
              ← All Announcements
            </Link>
            <h1>{item.title}</h1>
            {(item.publishedAt || item.videoUrl) && (
              <p className="ps-news-meta" style={{ justifyContent: 'center' }}>
                {item.publishedAt && (
                  <span className="ps-news-date">
                    {new Date(item.publishedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <section className="ps-section ps-article-detail">
          {(thumbnail || images.length > 0) && (
            <div className="ps-article-hero-img">
              {thumbnail ? <img src={thumbnail} alt={item.title} /> : null}
            </div>
          )}

          {item.summary && <p className="ps-article-lead">{item.summary}</p>}
          {item.content && <div className="ps-article-content">{item.content}</div>}

          {images.length > 1 && (
            <div className="ps-article-gallery">
              {images.map((img, i) => (
                <img key={i} src={img} alt={`${item.title} ${i + 1}`} loading="lazy" />
              ))}
            </div>
          )}

          {item.videoUrl && (
            <div style={{ marginTop: '2rem' }}>
              {youtubeId ? (
                <EmbeddedYouTube youtubeId={youtubeId} title={item.title} />
              ) : (
                <a className="ps-btn ps-btn-primary" href={item.videoUrl} target="_blank" rel="noreferrer">
                  Watch video
                </a>
              )}
            </div>
          )}

          {(item.documentUrl || item.linkUrl) && (
            <div style={{ marginTop: '2rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {item.documentUrl && (
                <a
                  className="ps-btn ps-btn-light"
                  href={item.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.documentLabel || 'Document'}
                </a>
              )}

              {item.linkUrl && (
                <a className="ps-btn ps-btn-primary" href={item.linkUrl} target="_blank" rel="noreferrer">
                  {item.linkLabel || 'Open link'}
                </a>
              )}
            </div>
          )}

          <div style={{ marginTop: '2.5rem' }}>
            <Link to="/announcements" className="ps-news-readmore" style={{ display: 'inline-flex' }}>
              ← Back to Announcements
            </Link>
          </div>
        </section>
      </>
    );
  }

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
        {list.length === 0 && (
          <p style={{ textAlign: 'center', color: '#666' }}>No announcements yet.</p>
        )}

        <div className="ps-news-list">
          {list.map((item, index) => {
            const images = item.images || [];
            const thumbnail = images[0] || item.documentImageUrl || '';
            return (
              <Link
                key={`${item.title}-${index}`}
                to={`/announcements/${index}`}
                className="ps-news-article"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                {thumbnail && (
                  <div className="ps-news-article-img">
                    <img src={thumbnail} alt={item.title} loading="lazy" />
                  </div>
                )}
                <div className="ps-news-article-body">
                  <p className="ps-news-meta">
                    {item.publishedAt && (
                      <span className="ps-news-date">
                        {new Date(item.publishedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </p>
                  <h2 className="ps-news-article-title">{item.title}</h2>
                  {item.summary && <p className="ps-news-article-summary">{item.summary}</p>}
                  <span className="ps-news-readmore">
                    View announcement
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="9 6 15 12 9 18" />
                    </svg>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}

