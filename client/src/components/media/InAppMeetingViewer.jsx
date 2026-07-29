import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getMeetingEmbedUrl, normalizeMeetingUrl } from '../../lib/meetingLinks';
import { useTranslation } from '../../context/LanguageContext';

const ZOOM_IFRAME_ALLOW = 'camera *; microphone *; fullscreen *; display-capture *; autoplay *; clipboard-write *; speaker-selection *';

export default function InAppMeetingViewer({
  open,
  onClose,
  title = 'Live class',
  meetingUrl,
}) {
  const { t } = useTranslation();
  const normalizedUrl = normalizeMeetingUrl(meetingUrl);
  const embedUrl = getMeetingEmbedUrl(normalizedUrl, 'ZOOM');

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !normalizedUrl || !embedUrl) return null;

  const overlay = createPortal(
    <div className="meeting-viewer-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <header className="meeting-viewer-header">
        <div className="meeting-viewer-brand">
          <img src="/logo.png" alt="École La RACINE" className="meeting-viewer-logo" />
          <div className="min-w-0">
            <p className="meeting-viewer-school">École La RACINE</p>
            <h2 className="meeting-viewer-title">{title}</h2>
          </div>
        </div>
        <button type="button" onClick={onClose} className="meeting-viewer-close" aria-label={t('common.leave')}>
          <X className="w-5 h-5" />
          <span className="hidden sm:inline">{t('common.leave')}</span>
        </button>
      </header>

      <div className="meeting-viewer-body">
        <iframe
          title={title}
          src={embedUrl}
          className="meeting-viewer-frame"
          allow={ZOOM_IFRAME_ALLOW}
          allowFullScreen
        />
      </div>
    </div>,
    document.body,
  );

  return overlay;
}
