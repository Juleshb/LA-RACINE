import { useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { getYouTubeEmbedUrl, parseYouTubeId } from '../../lib/youtube';
import FullscreenWrap from './FullscreenWrap';
import AppIcon from '../icons/AppIcon';

export default function EmbeddedYouTube({ youtubeId, videoUrl, title, autoplay = false }) {
  const id = youtubeId || parseYouTubeId(videoUrl);
  const [started, setStarted] = useState(autoplay);

  const embedUrl = useMemo(() => {
    if (!id || !started) return '';
    return getYouTubeEmbedUrl(id, { autoplay: true, muted: false });
  }, [id, started]);

  if (!id) return null;

  const posterUrl = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  const playLabel = title && title !== 'Watch this' ? `Play: ${title}` : 'Play video';

  return (
    <FullscreenWrap className="embedded-youtube embedded-youtube-safe" label="Watch video full screen">
      {title && <p className="embedded-youtube-sr">{title}</p>}
      <div className="embedded-youtube-crop">
        {!started ? (
          <button
            type="button"
            className="embedded-youtube-poster"
            onClick={() => setStarted(true)}
            aria-label={playLabel}
          >
            <img src={posterUrl} alt="" className="embedded-youtube-poster-img" />
            <span className="embedded-youtube-play-btn">
              <Play className="w-10 h-10 fill-white text-white" />
            </span>
            <span className="embedded-youtube-play-label">
              <AppIcon name="volume" className="w-5 h-5 inline-block align-text-bottom" />
              {' '}
              Tap to play
            </span>
          </button>
        ) : (
          <iframe
            title={title || 'Lesson video'}
            src={embedUrl}
            className="embedded-youtube-frame"
            allow="accelerometer; autoplay; encrypted-media; gyroscope"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>
      {started && (
        <>
          <div className="embedded-youtube-shield embedded-youtube-shield-top" aria-hidden />
          <div className="embedded-youtube-shield embedded-youtube-shield-tl" aria-hidden />
          <div className="embedded-youtube-shield embedded-youtube-shield-tr" aria-hidden />
        </>
      )}
    </FullscreenWrap>
  );
}
