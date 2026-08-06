import { useOutletContext } from 'react-router-dom';
import PageHero from '../../components/public/PageHero';

export default function PublicEvents() {
  const { page } = useOutletContext();
  const c = page('events');
  const list = (c.items || [])
    .filter((item) => item.title && item.status !== 'draft')
    .map((item) => ({
      title: item.title || '',
      details: item.details || item.body || '',
      date: item.date || '',
      time: item.time || '',
      location: item.location || '',
      type: item.type || '',
    }))
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

  return (
    <>
      <PageHero label={c.label} title={c.title} lead={c.lead} imageUrl={c.heroImageUrl} />

      <section className="ps-section">
        <div className="ps-timeline">
          {list.map((item, index) => (
            <article key={`${item.title}-${index}`} className="ps-timeline-item">
              <div className="ps-timeline-date">
                <p>{item.date ? new Date(item.date).toLocaleDateString() : 'Date TBA'}</p>
                {item.time && <span>{item.time}</span>}
              </div>
              <div className="ps-timeline-content">
                <p className="ps-news-meta">
                  {item.type && <span>{item.type}</span>}
                  {item.location && <span>{item.location}</span>}
                </p>
                <h3>{item.title}</h3>
                {item.details && <p>{item.details}</p>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
