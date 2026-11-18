import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import Logo from '../../components/Logo';
import '../../styles/status-page.css';

const COPY = {
  en: {
    subscribe: 'Subscribe to updates',
    subscribed: 'You are subscribed. The current status was sent to your email. Another email arrives only when a service changes.',
    savedOnly: 'Your address is saved, but the email was not sent. The school mail login was refused, so no subscriber can receive updates until that login is corrected.',
    close: 'Close',
    email: 'Email',
    save: 'Subscribe',
    saving: 'Saving…',
    cancel: 'Cancel',
    subscribeLead: 'We email this address only when a service becomes slow, goes down, or recovers. Opening this page does not send a message.',
    operational: 'All systems operational',
    degraded: 'Some services are slow',
    outage: 'Some services are unavailable',
    active: (n) => `${n} active notice${n === 1 ? '' : 's'}`,
    none: 'No active incidents',
    uptime: 'Uptime over the past 90 days.',
    schedule: 'Checks run about every 5 minutes while the school server is on. Subscribers are emailed only when a service changes.',
    measured: (n) => `${n} day${n === 1 ? '' : 's'} measured`,
    unknown: 'Not measured yet',
    ago: '90 days ago',
    today: 'Today',
    updated: 'Updated',
    refresh: 'Refresh',
    back: 'Back to the school website',
    loading: 'Checking the school services…',
    error: 'The status page could not load the latest checks.',
    operationalLabel: 'Operational',
    degradedLabel: 'Degraded',
    downLabel: 'Outage',
    identified: 'Identified',
    monitoring: 'Monitoring',
    latency: (ms) => `${ms} ms`,
  },
  fr: {
    subscribe: 'Recevoir les mises à jour',
    subscribed: 'Vous êtes inscrit. L’état actuel a été envoyé à votre e-mail. Un autre message part seulement quand un service change.',
    savedOnly: 'Votre adresse est enregistrée, mais l’e-mail n’est pas parti. La connexion mail de l’école a été refusée.',
    close: 'Fermer',
    email: 'E-mail',
    save: 'S’inscrire',
    saving: 'Enregistrement…',
    cancel: 'Annuler',
    subscribeLead: 'Nous écrivons à cette adresse seulement lorsqu’un service ralentit, tombe en panne ou revient. Ouvrir cette page n’envoie pas de message.',
    operational: 'Tous les services fonctionnent',
    degraded: 'Certains services sont lents',
    outage: 'Certains services sont indisponibles',
    active: (n) => `${n} avis en cours`,
    none: 'Aucun incident en cours',
    uptime: 'Disponibilité des 90 derniers jours.',
    schedule: 'Les vérifications ont lieu environ toutes les 5 minutes tant que le serveur de l’école est allumé. Les inscrits reçoivent un e-mail seulement quand un service change.',
    measured: (n) => `${n} jour${n === 1 ? '' : 's'} mesuré${n === 1 ? '' : 's'}`,
    unknown: 'Pas encore mesuré',
    ago: 'Il y a 90 jours',
    today: 'Aujourd’hui',
    updated: 'Mis à jour',
    refresh: 'Actualiser',
    back: 'Retour au site de l’école',
    loading: 'Vérification des services de l’école…',
    error: 'La page d’état n’a pas pu charger les dernières vérifications.',
    operationalLabel: 'Opérationnel',
    degradedLabel: 'Ralenti',
    downLabel: 'Panne',
    identified: 'Identifié',
    monitoring: 'Sous surveillance',
    latency: (ms) => `${ms} ms`,
  },
};

function labelStatus(copy, status) {
  if (status === 'down') return copy.downLabel;
  if (status === 'degraded') return copy.degradedLabel;
  return copy.operationalLabel;
}

export default function StatusPage() {
  const [language, setLanguage] = useState('en');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [params, setParams] = useSearchParams();
  const copy = COPY[language];
  const confirmed = params.get('subscription_confirmed') === 'true';
  const mailed = params.get('mailed') !== '0';

  const load = () => {
    setError('');
    api.getPublicStatus()
      .then(setReport)
      .catch((err) => setError(err.message || copy.error));
  };

  useEffect(() => { load(); }, []);

  const subscribe = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const result = await api.subscribeStatus(email);
      setOpen(false);
      setEmail('');
      setParams({ subscription_confirmed: 'true', mailed: result?.mailed ? '1' : '0' });
    } catch (err) {
      setFormError(err.message || copy.error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="status-page">
      <header className="status-top">
        <Logo size="sm" showSubtitle={false} />
        <div className="status-top-actions">
          <div className="status-lang" role="group" aria-label="Language">
            <button type="button" className={language === 'en' ? 'is-on' : ''} onClick={() => setLanguage('en')}>EN</button>
            <button type="button" className={language === 'fr' ? 'is-on' : ''} onClick={() => setLanguage('fr')}>FR</button>
          </div>
          <button type="button" className="status-subscribe" onClick={() => setOpen(true)}>{copy.subscribe}</button>
        </div>
      </header>

      {confirmed && (
        <p className={`status-confirmed${mailed ? '' : ' is-warning'}`} role="status">
          {mailed ? copy.subscribed : copy.savedOnly}
          <button type="button" onClick={() => setParams({})} aria-label={copy.close}>×</button>
        </p>
      )}

      {!report && <p className="status-loading">{error || copy.loading}</p>}

      {report && (
        <>
          <section className={`status-banner is-${report.overall}`}>
            <strong>{report.overall === 'operational' ? copy.operational : report.overall === 'outage' ? copy.outage : copy.degraded}</strong>
            <span>{copy.updated} {new Date(report.updatedAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en')}</span>
            <button type="button" onClick={load}>{copy.refresh}</button>
          </section>

          <section className="status-incidents">
            <h2>{report.incidents.length ? copy.active(report.incidents.length) : copy.none}</h2>
            {report.incidents.map((incident) => (
              <article key={incident.id}>
                <span className={`status-dot is-${incident.state === 'identified' ? 'down' : 'degraded'}`} />
                <div>
                  <h3>{language === 'fr' ? incident.fr : incident.en}</h3>
                  <p>{language === 'fr' ? incident.detailFr : incident.detailEn}</p>
                </div>
                <time>{incident.state === 'identified' ? copy.identified : copy.monitoring}</time>
              </article>
            ))}
          </section>

          <p className="status-uptime-label">{copy.uptime}</p>
          <p className="status-schedule">{copy.schedule}</p>
          {report.groups.map((group) => (
            <section key={group.id} className="status-group">
              <h2>{language === 'fr' ? group.fr : group.en}</h2>
              {group.components.map((component) => (
                <article key={component.id} className="status-component">
                  <div className="status-component-head">
                    <h3>{language === 'fr' ? component.fr : component.en}</h3>
                    <span className={`status-pill is-${component.status}`}>
                      {labelStatus(copy, component.status)}
                      {component.latencyMs != null && component.status !== 'down' ? ` · ${copy.latency(component.latencyMs)}` : ''}
                    </span>
                  </div>
                  <div className="status-bars" aria-hidden>
                    {component.days.map((day) => (
                      <i key={day.day} className={`is-${day.status}`} title={`${day.day} · ${day.status === 'unknown' ? copy.unknown : labelStatus(copy, day.status)}`} />
                    ))}
                  </div>
                  <div className="status-scale">
                    <span>{copy.ago}</span>
                    <span>{component.uptime == null ? '—' : `${component.uptime}%`} · {copy.measured(component.recordedDays)}</span>
                    <span>{copy.today}</span>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </>
      )}

      <footer className="status-foot">
        <Link to="/">{copy.back}</Link>
      </footer>

      {open && (
        <div className="status-modal" role="presentation" onClick={() => setOpen(false)}>
          <form className="status-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()} onSubmit={subscribe}>
            <h2>{copy.subscribe}</h2>
            <p>{copy.subscribeLead}</p>
            <label>
              {copy.email}
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            {formError && <p className="status-form-error">{formError}</p>}
            <div>
              <button type="button" className="status-cancel" onClick={() => setOpen(false)}>{copy.cancel}</button>
              <button type="submit" className="status-subscribe" disabled={saving}>{saving ? copy.saving : copy.save}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
