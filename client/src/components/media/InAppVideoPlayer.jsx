import { useEffect } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import EmbeddedYouTube from './EmbeddedYouTube';
import useFullscreen from '../../hooks/useFullscreen';

export default function InAppVideoPlayer({ title = 'Watch lesson', youtubeId, videoUrl, onClose }) {
  const { ref, active, toggle } = useFullscreen();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="in-app-viewer-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div ref={ref} className={`in-app-viewer-panel in-app-video-panel ${active ? 'fullscreen-wrap-active' : ''}`}>
        <header className="in-app-viewer-header">
          <h2 className="in-app-viewer-title">{title}</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={toggle} className="in-app-viewer-close" aria-label={active ? 'Exit full screen' : 'Full screen'}>
              {active ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button type="button" onClick={onClose} className="in-app-viewer-close" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>
        <div className="in-app-video-body">
          <EmbeddedYouTube
            youtubeId={youtubeId}
            videoUrl={videoUrl}
            title={title}
            autoplay
          />
        </div>
      </div>
    </div>
  );
}
