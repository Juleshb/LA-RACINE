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

export function normalizeHomeworkVideos(videos = []) {
  if (!Array.isArray(videos)) return [];
  const result = [];
  for (let i = 0; i < videos.length; i += 1) {
    const entry = videos[i];
    const youtubeId = parseYouTubeId(entry?.videoUrl || entry?.youtubeId);
    if (!youtubeId) continue;
    const title = String(entry?.title || '').trim() || 'Watch this';
    result.push({ title, youtubeId, sortOrder: i });
  }
  return result;
}
