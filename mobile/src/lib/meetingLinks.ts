/** Meeting URL helpers — mirrors client/src/lib/meetingLinks.js for Zoom in-app join. */

export function normalizeMeetingUrl(raw?: string | null): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export type ZoomMeetingInfo = {
  meetingId: string;
  pwd: string | null;
  embedUrl: string;
  joinUrl: string;
};

export function parseZoomMeeting(url?: string | null): ZoomMeetingInfo | null {
  try {
    const parsed = new URL(normalizeMeetingUrl(url));
    const match = parsed.pathname.match(/\/j\/(\d+)/);
    if (!match) return null;
    const meetingId = match[1];
    const pwd = parsed.searchParams.get('pwd');
    const host =
      parsed.hostname === 'zoom.us' ||
      parsed.hostname === 'zoom.com' ||
      /\.zoom\.(us|com)$/i.test(parsed.hostname)
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

export function getMeetingEmbedUrl(url?: string | null, provider?: string | null): string | null {
  const normalized = normalizeMeetingUrl(url);
  if (!normalized) return null;
  if (provider === 'ZOOM' || /zoom\.(us|com)/i.test(normalized)) {
    const zoom = parseZoomMeeting(normalized);
    return zoom?.embedUrl || normalized;
  }
  return normalized;
}

export function canEmbedInApp(provider?: string | null, url?: string | null): boolean {
  if (provider === 'ZOOM') return true;
  if (provider === 'GOOGLE_MEET') return false;
  return Boolean(parseZoomMeeting(url));
}

export function detectMeetingProvider(url?: string | null, provider?: string | null): 'ZOOM' | 'GOOGLE_MEET' | 'OTHER' {
  if (provider === 'ZOOM' || provider === 'GOOGLE_MEET') return provider;
  const normalized = normalizeMeetingUrl(url);
  if (/zoom\.(us|com)/i.test(normalized)) return 'ZOOM';
  if (/meet\.google\.com/i.test(normalized)) return 'GOOGLE_MEET';
  return 'OTHER';
}

export const PROVIDER_LABELS = {
  GOOGLE_MEET: 'Google Meet',
  ZOOM: 'Zoom',
  OTHER: 'Meeting',
} as const;
