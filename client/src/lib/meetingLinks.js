export function normalizeMeetingUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function parseZoomMeeting(url) {
  try {
    const parsed = new URL(normalizeMeetingUrl(url));
    const match = parsed.pathname.match(/\/j\/(\d+)/);
    if (!match) return null;
    const meetingId = match[1];
    const pwd = parsed.searchParams.get('pwd');
    const host = parsed.hostname === 'zoom.us' || parsed.hostname === 'zoom.com' || /\.zoom\.(us|com)$/i.test(parsed.hostname)
      ? parsed.hostname
      : 'zoom.us';
    const embed = new URL(`https://${host}/wc/join/${meetingId}`);
    if (pwd) embed.searchParams.set('pwd', pwd);
    embed.searchParams.set('prefer', '1');
    return { meetingId, pwd, embedUrl: embed.toString(), joinUrl: parsed.toString() };
  } catch {
    return null;
  }
}

export function openZoomWithMedia(url) {
  const zoom = parseZoomMeeting(url);
  const target = zoom?.embedUrl || normalizeMeetingUrl(url);
  if (!target) return null;
  return window.open(
    target,
    'laracine-zoom',
    'popup=yes,width=1280,height=800,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes',
  );
}

/** Best URL for in-app iframe embed (Zoom web client when possible). */
export function getMeetingEmbedUrl(url, provider) {
  const normalized = normalizeMeetingUrl(url);
  if (!normalized) return null;

  if (provider === 'ZOOM') {
    const zoom = parseZoomMeeting(normalized);
    return zoom?.embedUrl || normalized;
  }

  return normalized;
}

export function canEmbedInApp(provider) {
  return provider === 'ZOOM';
}

export function openMeetingInNewTab(url) {
  const normalized = normalizeMeetingUrl(url);
  if (!normalized) return false;
  window.open(normalized, '_blank', 'noopener,noreferrer');
  return true;
}

/** Minutes before start when students can join (matches server starting_soon window). */
export const JOIN_WINDOW_MINUTES = 15;

export function getMinutesUntilJoin(session, now = new Date()) {
  const start = new Date(session.scheduledAt);
  const joinOpensAt = new Date(start.getTime() - JOIN_WINDOW_MINUTES * 60 * 1000);
  if (now >= joinOpensAt) return 0;
  return Math.ceil((joinOpensAt - now) / 60000);
}

export function formatMinutesUntilJoin(minutes) {
  if (minutes <= 0) return 'Join opens soon';
  if (minutes < 60) {
    return minutes === 1 ? '1 minute to join' : `${minutes} minutes to join`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h to join`;
  return `${hours}h ${mins}m to join`;
}

export const PROVIDER_LABELS = {
  GOOGLE_MEET: 'Google Meet',
  ZOOM: 'Zoom',
};
