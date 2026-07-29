const MEET_HOSTS = ['meet.google.com', 'google.com'];
const ZOOM_HOSTS = ['zoom.us', 'zoom.com'];

export function normalizeMeetingUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function detectMeetingProvider(url) {
  try {
    const host = new URL(normalizeMeetingUrl(url)).hostname.toLowerCase();
    if (MEET_HOSTS.some((h) => host === h || host.endsWith(`.${h}`) || host.includes('meet.google'))) {
      return 'GOOGLE_MEET';
    }
    if (ZOOM_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
      return 'ZOOM';
    }
  } catch {
    /* invalid url */
  }
  return null;
}

export function validateMeetingUrl(url, provider) {
  const normalized = normalizeMeetingUrl(url);
  if (!normalized) {
    return { ok: false, error: 'Meeting link is required' };
  }

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return { ok: false, error: 'Meeting link must be a valid URL' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, error: 'Meeting link must start with https://' };
  }

  const detected = detectMeetingProvider(normalized);
  if (provider === 'GOOGLE_MEET' && detected !== 'GOOGLE_MEET') {
    return { ok: false, error: 'Please paste a Google Meet link (meet.google.com)' };
  }
  if (provider === 'ZOOM' && detected !== 'ZOOM') {
    return { ok: false, error: 'Please paste a Zoom link (zoom.us)' };
  }
  if (!detected) {
    return { ok: false, error: 'Link must be a Google Meet or Zoom meeting URL' };
  }

  return { ok: true, url: normalized, provider: detected };
}

export function getSessionStatus(session, now = new Date()) {
  const start = new Date(session.scheduledAt);
  const end = new Date(start.getTime() + (session.durationMinutes || 45) * 60 * 1000);
  if (now < start) {
    const mins = Math.round((start - now) / 60000);
    if (mins <= 15) return { key: 'starting_soon', label: 'Starting soon' };
    return { key: 'upcoming', label: 'Upcoming' };
  }
  if (now <= end) return { key: 'live', label: 'Live now' };
  return { key: 'ended', label: 'Ended' };
}
