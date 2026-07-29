import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../../lib/api';
import { usePublicSite } from '../../hooks/usePublicSite';
import AppIcon from '../../components/icons/AppIcon';
import { supportT } from './supportChatI18n';
import { SchoolMapBlock, DEFAULT_MAP_URL } from './SchoolMapBlock';

export default function PublicContact() {
  const { school: profile, campuses: list = [], page } = useOutletContext();
  const { locale } = usePublicSite();
  const t = supportT(locale);
  const c = page('contact');
  const mapUrl = c.mapUrl || DEFAULT_MAP_URL;

  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', campusId: '' });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const data = await api.submitPublicContact(form);
      setResult({ type: 'success', text: data.message || t.messageSent });
      setForm({ name: '', email: '', subject: '', message: '', campusId: '' });
    } catch (err) {
      setResult({ type: 'error', text: err.message });
    } finally {
      setSending(false);
    }
  };

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
        <div className="ps-contact-grid">
          <div className="ps-contact-block">
            <h3>{c.officeTitle}</h3>
            {profile?.phone1 && (
              <a className="ps-meta-row" href={`tel:${profile.phone1}`}>
                <AppIcon name="phone" className="ps-icon" />
                <span>{profile.phone1}</span>
              </a>
            )}
            {profile?.phone2 && (
              <a className="ps-meta-row" href={`tel:${profile.phone2}`}>
                <AppIcon name="phone" className="ps-icon" />
                <span>{profile.phone2}</span>
              </a>
            )}
            {profile?.email && (
              <a className="ps-meta-row" href={`mailto:${profile.email}`}>
                <AppIcon name="email" className="ps-icon" />
                <span>{profile.email}</span>
              </a>
            )}
            {profile?.website && (
              <a
                className="ps-meta-row"
                href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noreferrer"
              >
                <AppIcon name="website" className="ps-icon" />
                <span>{profile.website}</span>
              </a>
            )}
            <p className="ps-meta-row" style={{ marginTop: '1rem' }}>
              <AppIcon name="mapOutline" className="ps-icon" />
              <span>{[profile?.city, profile?.district, profile?.province, profile?.country].filter(Boolean).join(', ')}</span>
            </p>
            <a
              className="ps-campus-map-link"
              href={mapUrl}
              target="_blank"
              rel="noreferrer"
            >
              <AppIcon name="directions" className="ps-icon" />
              {c.mapCta || 'Open in Google Maps'}
            </a>
            <div className="ps-cta-row">
              <Link to="/login" className="ps-btn ps-btn-primary">{c.ctaPortal}</Link>
            </div>
          </div>

          <div className="ps-contact-block">
            <h3>{c.campusesTitle}</h3>
            {list.map((campus) => (
              <div key={campus.id || campus.code} style={{ marginBottom: '1.25rem' }}>
                <strong className="ps-campus-name" style={{ color: 'var(--ps-ink)' }}>
                  <AppIcon name="school" className="ps-icon" />
                  <span>{campus.name}</span>
                </strong>
                {campus.phone && (
                  <a className="ps-meta-row" href={`tel:${campus.phone}`}>
                    <AppIcon name="phone" className="ps-icon" />
                    <span>{campus.phone}</span>
                  </a>
                )}
                {campus.email && (
                  <a className="ps-meta-row" href={`mailto:${campus.email}`}>
                    <AppIcon name="email" className="ps-icon" />
                    <span>{campus.email}</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="ps-contact-form-wrap">
          <h3 className="ps-contact-form-title">{t.sendMessage}</h3>
          <form className="ps-contact-form" onSubmit={handleSubmit}>
            {result && (
              <div className={`ps-contact-alert ${result.type === 'success' ? 'ps-contact-alert--success' : 'ps-contact-alert--error'}`}>
                {result.text}
              </div>
            )}
            <div className="ps-contact-form-grid">
              <div>
                <label className="ps-contact-label">{t.yourName} *</label>
                <input
                  className="ps-contact-input"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t.fullName}
                />
              </div>
              <div>
                <label className="ps-contact-label">{t.yourEmail} *</label>
                <input
                  className="ps-contact-input"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="ps-contact-label">{t.subject}</label>
                <input
                  className="ps-contact-input"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder={t.subjectPlaceholder}
                />
              </div>
              <div>
                <label className="ps-contact-label">{t.campus}</label>
                <select
                  className="ps-contact-input"
                  value={form.campusId}
                  onChange={(e) => setForm({ ...form, campusId: e.target.value })}
                >
                  <option value="">{t.generalInquiry}</option>
                  {list.map((campus) => (
                    <option key={campus.id} value={campus.id}>{campus.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="ps-contact-label">{t.message} *</label>
              <textarea
                className="ps-contact-input ps-contact-textarea"
                required
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder={t.writeMessage}
              />
            </div>
            <button type="submit" className="ps-btn ps-btn-primary" disabled={sending}>
              <AppIcon name="send" className="ps-icon" />
              {sending ? t.sending : t.sendMessage}
            </button>
          </form>
        </div>

        <div className="ps-contact-form-wrap">
          <h3 className="ps-contact-form-title">{t.contactHelpTitle}</h3>
          <p className="ps-contact-help">{t.contactHelpLead}</p>
          <button
            type="button"
            className="ps-btn ps-btn-primary"
            onClick={() => window.dispatchEvent(new Event('open-support-chat'))}
          >
            <AppIcon name="chat" className="ps-icon" />
            {t.openSupportChat}
          </button>
        </div>

        <SchoolMapBlock
          title={c.mapTitle || 'Our location'}
          lead={c.mapLead}
          cta={c.mapCta || 'Open in Google Maps'}
          mapUrl={mapUrl}
          embedUrl={c.mapEmbedUrl}
        />
      </section>
    </>
  );
}
