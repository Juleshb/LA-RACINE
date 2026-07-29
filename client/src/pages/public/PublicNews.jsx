import { useOutletContext, Link } from 'react-router-dom';

export default function PublicNews() {
  const { page } = useOutletContext();
  const c = page('news');
  const list = (c.items || [])
    .map((item) => ({
      title: item.title || '',
      summary: item.summary || item.body || '',
      content: item.content || item.body || '',
      imageUrl: (Array.isArray(item.images) && item.images[0]) || item.imageUrl || '',
      images: Array.isArray(item.images) ? item.images : item.imageUrl ? [item.imageUrl] : [],
      publishedAt: item.publishedAt || '',
      category: item.category || '',
    }))
    .filter((item) => item.title)
    .sort((a, b) => {
      if (!a.publishedAt && !b.publishedAt) return 0;
      if (!a.publishedAt) return 1;
      if (!b.publishedAt) return -1;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });


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
          <p style={{ textAlign: 'center', color: '#666' }}>No news articles yet.</p>
        )}

        <div className="ps-news-list">
          {list.map((item, index) => (
            <Link
              key={`${item.title}-${index}`}
              to={`/news/${index}`}
              className="ps-news-article"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              {item.imageUrl && (
                <div className="ps-news-article-img">
                  <img src={item.imageUrl} alt={item.title} loading="lazy" />
                </div>
              )}
              <div className="ps-news-article-body">
                <p className="ps-news-meta">
                  {item.category && <span>{item.category}</span>}
                  {item.publishedAt && (
                    <span className="ps-news-date">{new Date(item.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  )}
                </p>
                <h2 className="ps-news-article-title">{item.title}</h2>
                <p className="ps-news-article-summary">{item.summary}</p>
                <span className="ps-news-readmore">
                  Read more
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
