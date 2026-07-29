import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import AppIcon from '../icons/AppIcon';
import PdfPageReader from './PdfPageReader';

export default function ReadingViewer({
  url,
  isPdf,
  isImage,
  title = 'Read',
  fullscreenLabel = 'Full screen',
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!url) return null;

  const overlay = open && createPortal(
    <div className="reading-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <header className="reading-overlay-header">
        <p className="reading-overlay-title">{title}</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="reading-overlay-exit"
          aria-label="Exit full screen"
        >
          <AppIcon name="exitFullscreen" className="w-5 h-5" />
          <span>Exit full screen</span>
        </button>
      </header>
      <div className="reading-overlay-body reading-overlay-body-pages">
        {isPdf && <PdfPageReader url={url} title={title} compact />}
        {isImage && (
          <img src={url} alt="" className="reading-overlay-image" />
        )}
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      <div className="reading-viewer-inline">
        {isPdf && (
          <PdfPageReader url={url} title={title} />
        )}
        {isImage && (
          <img src={url} alt="" className="student-inline-image" />
        )}
        {(isPdf || isImage) && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="reading-fullscreen-btn"
            aria-label={fullscreenLabel}
          >
            <AppIcon name="fullscreen" className="w-4 h-4" />
            <span>Full screen</span>
          </button>
        )}
      </div>
      {overlay}
    </>
  );
}
