import { useEffect, useState } from 'react';
import { subscribeApiLoading } from '../lib/apiLoading';
import { useTranslationOptional } from '../context/LanguageContext';

const SHOW_DELAY_MS = 220;

export default function ApiLoader() {
  const { t } = useTranslationOptional();
  const [pending, setPending] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribeApiLoading(setPending), []);

  useEffect(() => {
    if (pending <= 0) {
      setVisible(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  if (!visible || pending <= 0) return null;

  return (
    <div className="api-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="api-loader-bar" aria-hidden />
      <div className="api-loader-scrim">
        <div className="api-loader-card">
          <span className="api-loader-mark" aria-hidden>
            <span className="api-loader-ring" />
            <img src="/logo.png" alt="" className="api-loader-logo" />
          </span>
          <p className="api-loader-title">{t('ui.loading')}</p>
          <p className="api-loader-sub">{t('ui.loadingData')}</p>
        </div>
      </div>
    </div>
  );
}
