/** Extract a YouTube video ID from common URL formats. */
export function parseYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0];
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  }

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (parsed.pathname === '/watch') {
      const id = parsed.searchParams.get('v');
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    const embedMatch = parsed.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];
    const shortsMatch = parsed.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];
  }

  return null;
}

/** Privacy-friendly embed URL — minimal branding, loop instead of end-screen suggestions. */
export function getYouTubeEmbedUrl(youtubeId, {
  autoplay = false,
  muted = false,
  controls = true,
  background = false,
} = {}) {
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    mute: muted || background ? '1' : '0',
    rel: '0',
    modestbranding: '1',
    controls: background || !controls ? '0' : '1',
    iv_load_policy: '3',
    cc_load_policy: '0',
    playsinline: '1',
    disablekb: '1',
    fs: background ? '0' : '0',
    loop: '1',
    playlist: youtubeId,
    color: 'white',
  });
  if (background) {
    params.set('showinfo', '0');
  }
  if (typeof window !== 'undefined') {
    params.set('origin', window.location.origin);
    params.set('widget_referrer', window.location.origin);
  }
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?${params.toString()}`;
}

export function isValidYouTubeUrl(url) {
  return Boolean(parseYouTubeId(url));
}
