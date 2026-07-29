import { useEffect, useState } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { api } from '../../lib/api';
import useFullscreen from '../../hooks/useFullscreen';

export default function InAppViewer({ homeworkId, attachment, onClose }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { ref, active, toggle } = useFullscreen();

  useEffect(() => {
    let objectUrl = '';
    setLoading(true);
    setError('');
    api.getHomeworkFileUrl(homeworkId, attachment.id)
      .then((blobUrl) => {
        objectUrl = blobUrl;
        setUrl(blobUrl);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [homeworkId, attachment.id]);

  const isPdf = attachment.mimeType === 'application/pdf';
  const isImage = attachment.mimeType?.startsWith('image/');

  return (
    <div className="in-app-viewer-overlay" role="dialog" aria-modal="true">
      <div ref={ref} className={`in-app-viewer-panel ${active ? 'fullscreen-wrap-active' : ''}`}>
        <header className="in-app-viewer-header">
          <h2 className="in-app-viewer-title">{attachment.fileName}</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={toggle} className="in-app-viewer-close" aria-label={active ? 'Exit full screen' : 'Full screen'}>
              {active ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button type="button" onClick={onClose} className="in-app-viewer-close" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>
        <div className="in-app-viewer-body">
          {loading && <p className="text-center text-gray-500 py-12">Loading…</p>}
          {error && <p className="text-center text-red-600 py-12">{error}</p>}
          {!loading && !error && url && isImage && (
            <img src={url} alt={attachment.fileName} className="in-app-viewer-image" />
          )}
          {!loading && !error && url && isPdf && (
            <iframe title={attachment.fileName} src={url} className="in-app-viewer-frame" />
          )}
        </div>
      </div>
    </div>
  );
}
