import { useParams, useOutletContext, Link } from 'react-router-dom';

export default function PublicNewsArticle() {
  const { articleIndex } = useParams();
  const { page } = useOutletContext();
  const c = page('news');
  const list = (c.items || []).filter((item) => item.title);
  const index = parseInt(articleIndex, 10);
  const item = list[index];

  if (!item) {
    return (
      <section className="ps-section" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <h2>Article not found</h2>
        <Link to="/news" className="ps-news-readmore" style={{ marginTop: '1rem', display: 'inline-flex' }}>
          ← Back to News
        </Link>
      </section>
    );
  }

  const images = Array.isArray(item.images) ? item.images : item.imageUrl ? [item.imageUrl] : [];
  const title = item.title || '';
  const category = item.category || '';
  const publishedAt = item.publishedAt || item.date || '';
  const summary = item.summary || item.body || '';
  const content = item.content || item.body || '';

  return (
    <>
      <div className="ps-page-hero">
        <div className="ps-page-hero-inner">
          <Link to="/news" className="ps-back-link">← All News</Link>
          <h1>{title}</h1>
          <p className="ps-news-meta" style={{ justifyContent: 'center' }}>
            {category && <span>{category}</span>}
            {publishedAt && (
              <span className="ps-news-date">
                {new Date(publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            )}
          </p>
        </div>
      </div>

      <section className="ps-section ps-article-detail">
        {images.length > 0 && (
          <div className="ps-article-hero-img">
            <img src={images[0]} alt={title} />
          </div>
        )}

        {summary && <p className="ps-article-lead">{summary}</p>}
        {content && <div className="ps-article-content">{content}</div>}

        {images.length > 1 && (
          <div className="ps-article-gallery">
            {images.map((img, i) => (
              <img key={i} src={img} alt={`${title} ${i + 1}`} loading="lazy" />
            ))}
          </div>
        )}

        <div style={{ marginTop: '2.5rem' }}>
          <Link to="/news" className="ps-news-readmore">← Back to News</Link>
        </div>
      </section>
    </>
  );
}
