import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { getApiOrigin } from '../../lib/config';

function resolveFileUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const origin = getApiOrigin();
  if (url.startsWith('/')) return `${origin}${url}`;
  return url;
}

export default function PublicCalendar() {
  const { page } = useOutletContext();
  const c = page('calendar') || {};
  const levels = useMemo(
    () => (Array.isArray(c.levels) ? c.levels.filter((l) => l?.id || l?.label) : []),
    [c.levels],
  );
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    if (!levels.length) return;
    const ids = levels.map((l) => l.id || l.label);
    if (!activeId || !ids.includes(activeId)) {
      setActiveId(ids[0]);
    }
  }, [levels, activeId]);

  const active = levels.find((l) => (l.id || l.label) === activeId) || levels[0] || null;
  const calendars = Array.isArray(active?.calendars) ? active.calendars : [];
  const withPdf = calendars.filter((item) => item?.fileUrl);
  const viewPdf = c.viewPdf || 'View PDF';

  return (
    <>
      <div className="ps-page-hero">
        <div className="ps-page-hero-inner">
          {c.academicYearLabel ? <p className="ps-calendar-year">{c.academicYearLabel}</p> : null}
          <p className="ps-section-label">{c.label}</p>
          <h1>{c.title}</h1>
          <p>{c.lead}</p>
        </div>
      </div>

      <section className="ps-section ps-calendar-section">
        {levels.length > 0 && (
          <div className="ps-calendar-tabs" role="tablist" aria-label={c.label || 'School calendar levels'}>
            {levels.map((level) => {
              const id = level.id || level.label;
              const selected = (active?.id || active?.label) === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`ps-calendar-tab${selected ? ' is-active' : ''}`}
                  onClick={() => setActiveId(id)}
                >
                  <span className="ps-calendar-tab-label">{level.label}</span>
                  {level.subtitle ? <span className="ps-calendar-tab-sub">{level.subtitle}</span> : null}
                </button>
              );
            })}
          </div>
        )}

        {active && (
          <div className="ps-calendar-panel" role="tabpanel">
            <div className="ps-calendar-panel-head">
              <h2>
                {active.sectionTitle || (
                  <>
                    {active.label} <em>Calendars</em>
                  </>
                )}
              </h2>
              {active.sectionLead ? <p>{active.sectionLead}</p> : null}
            </div>

            {withPdf.length === 0 ? (
              <p className="ps-calendar-empty">{c.emptyLevel}</p>
            ) : (
              <div className="ps-calendar-grid">
                {withPdf.map((item, index) => {
                  const href = resolveFileUrl(item.fileUrl);
                  return (
                    <article key={`${item.campusName}-${index}`} className="ps-calendar-card">
                      <div className="ps-calendar-card-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M8 2v3M16 2v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
                          <path d="M8 13h3M13 13h3M8 17h3" />
                        </svg>
                      </div>
                      <div className="ps-calendar-card-body">
                        <h3>{item.campusName}</h3>
                        {item.city ? <p className="ps-calendar-city">{item.city}</p> : null}
                      </div>
                      <a
                        className="ps-btn ps-btn-primary ps-calendar-pdf"
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {viewPdf}
                      </a>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {c.note ? <p className="ps-calendar-note">{c.note}</p> : null}
      </section>

      <section className="ps-calendar-help">
        <div className="ps-calendar-help-inner">
          <h2>{c.helpTitle}</h2>
          <p>{c.helpLead}</p>
          <div className="ps-cta-row">
            <Link to="/contact" className="ps-btn ps-btn-primary">{c.ctaContact || 'Contact us'}</Link>
            <Link to="/admissions/apply" className="ps-btn ps-btn-ghost">{c.ctaApply || 'Apply now'}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
