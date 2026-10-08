import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { clearInstallPrompt, waitForInstallPrompt } from '../lib/portalInstall';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function deviceKind() {
  const ua = window.navigator.userAgent || '';
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iPad|iPhone|iPod/.test(ua) || iPadOs) return 'iphone';
  if (/Android|Mobile/i.test(ua)) return 'android';
  return 'computer';
}

export default function InstallPortalApp({ className = '' }) {
  const { t } = useTranslation();
  const [installed, setInstalled] = useState(() => isStandalone());
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const onDone = () => {
      setInstalled(true);
      setGuideOpen(false);
    };
    window.addEventListener('portal-install-done', onDone);
    return () => window.removeEventListener('portal-install-done', onDone);
  }, []);

  if (installed) return null;

  const kind = deviceKind();

  const install = async () => {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.ready;
      } catch {
        /* The browser install window can still open without a ready worker. */
      }
    }
    const promptEvent = await waitForInstallPrompt();
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        clearInstallPrompt();
        if (choice?.outcome === 'accepted') {
          setInstalled(true);
          return;
        }
      } catch {
        clearInstallPrompt();
      }
    }
    if (kind === 'iphone') setGuideOpen(true);
  };

  const guides = ['iphone'];

  return (
    <div className={`portal-install ${className}`.trim()}>
      <button type="button" className="portal-install-btn" onClick={install}>
        <img src="/icons/apple-touch-icon.png" alt="" className="portal-install-mark" />
        {t('app.installApp')}
      </button>
      {guideOpen && createPortal(
        <div className="portal-install-scrim" role="presentation" onClick={() => setGuideOpen(false)}>
          <div
            className="portal-install-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="portal-install-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="portal-install-dialog-close"
              onClick={() => setGuideOpen(false)}
              aria-label={t('app.closeMenu')}
            >
              <X className="w-4 h-4" />
            </button>
            <h2 id="portal-install-title">{t('app.installGuideTitle')}</h2>
            <p className="portal-install-lead">{t('app.installGuideManual')}</p>
            <div className="portal-install-preview">
              <img src="/icons/apple-touch-icon.png" alt="École La RACINE" />
              <p>{t('app.installIconCaption')}</p>
            </div>
            {guides.map((item) => (
              <section key={item} className="portal-install-device">
                <h3>{t(`app.install${item[0].toUpperCase()}${item.slice(1)}Title`)}</h3>
                <ol>
                  <li>{t(`app.install${item[0].toUpperCase()}${item.slice(1)}1`)}</li>
                  <li>{t(`app.install${item[0].toUpperCase()}${item.slice(1)}2`)}</li>
                  <li>{t(`app.install${item[0].toUpperCase()}${item.slice(1)}3`)}</li>
                </ol>
              </section>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
