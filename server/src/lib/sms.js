/**
 * BulkSMS (https://api.bulksms.com/v1) client for parent notifications.
 * Auth: HTTP Basic with Token ID + Token Secret.
 */

const BULKSMS_BASE = 'https://api.bulksms.com/v1';
const MAX_SMS_CHARS = 320;

export function isSmsEnabled() {
  return String(process.env.SMS_ENABLED || '').toLowerCase() === 'true';
}

export function isSmsConfigured() {
  return Boolean(
    isSmsEnabled()
    && process.env.BULKSMS_TOKEN_ID?.trim()
    && process.env.BULKSMS_TOKEN_SECRET?.trim(),
  );
}

export function getSmsSkipReason() {
  if (!isSmsEnabled()) return 'SMS is disabled (set SMS_ENABLED=true)';
  if (!process.env.BULKSMS_TOKEN_ID?.trim() || !process.env.BULKSMS_TOKEN_SECRET?.trim()) {
    return 'BulkSMS credentials missing (BULKSMS_TOKEN_ID / BULKSMS_TOKEN_SECRET)';
  }
  return null;
}

/**
 * Normalize Rwanda (and common local) phone numbers to E.164 (+250…).
 * Returns null if the number cannot be normalized.
 */
export function normalizeRwandaPhone(raw) {
  if (raw == null) return null;
  let digits = String(raw).trim().replace(/[^\d+]/g, '');
  if (!digits) return null;

  if (digits.startsWith('+')) {
    digits = `+${digits.slice(1).replace(/\D/g, '')}`;
  } else {
    digits = digits.replace(/\D/g, '');
  }

  if (digits.startsWith('+')) {
    const n = digits.slice(1);
    if (n.startsWith('250') && n.length === 12) return `+${n}`;
    if (n.length >= 10 && n.length <= 15) return `+${n}`;
    return null;
  }

  // Local Rwanda mobile: 07XXXXXXXX → +2507XXXXXXXX
  if (/^07\d{8}$/.test(digits)) return `+250${digits.slice(1)}`;
  // Without leading 0: 7XXXXXXXX
  if (/^7\d{8}$/.test(digits)) return `+250${digits}`;
  // Already with country code, no plus
  if (/^2507\d{8}$/.test(digits)) return `+${digits}`;
  // Generic international without +
  if (/^\d{10,15}$/.test(digits)) return `+${digits}`;

  return null;
}

export function dedupePhones(phones = []) {
  const seen = new Set();
  const out = [];
  for (const raw of phones) {
    const normalized = normalizeRwandaPhone(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

/** Build a short SMS body with school prefix. */
export function buildBroadcastSmsBody(title, body, { maxChars = MAX_SMS_CHARS } = {}) {
  const prefix = 'La RACINE: ';
  const titlePart = String(title || '').trim();
  const bodyPart = String(body || '').trim().replace(/\s+/g, ' ');
  let text = titlePart
    ? `${prefix}${titlePart}\n${bodyPart}`
    : `${prefix}${bodyPart}`;
  text = text.trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}

function authHeader() {
  const id = process.env.BULKSMS_TOKEN_ID.trim();
  const secret = process.env.BULKSMS_TOKEN_SECRET.trim();
  const token = Buffer.from(`${id}:${secret}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

/**
 * Send one SMS via BulkSMS.
 * @returns {{ ok: boolean, to: string, status?: string, error?: string }}
 */
export async function sendSms({ to, body }) {
  const normalized = normalizeRwandaPhone(to);
  if (!normalized) {
    return { ok: false, to: String(to || ''), error: 'Invalid phone number' };
  }
  if (!isSmsConfigured()) {
    return { ok: false, to: normalized, error: getSmsSkipReason() || 'SMS not configured' };
  }

  const payload = {
    to: normalized,
    body: String(body || '').slice(0, MAX_SMS_CHARS),
  };
  const sender = process.env.BULKSMS_SENDER_ID?.trim();
  if (sender) payload.from = sender;

  try {
    const res = await fetch(`${BULKSMS_BASE}/messages`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = data?.detail || data?.title || data?.error || res.statusText;
      return { ok: false, to: normalized, error: String(detail || `HTTP ${res.status}`) };
    }

    const first = Array.isArray(data) ? data[0] : data;
    return {
      ok: true,
      to: normalized,
      status: first?.status?.type || first?.type || 'ACCEPTED',
      id: first?.id || null,
    };
  } catch (err) {
    return { ok: false, to: normalized, error: err.message || 'SMS request failed' };
  }
}

/**
 * Send the same body to many recipients in one BulkSMS request.
 * @returns {{ requested: number, sent: number, failed: number, skipped: number, error?: string, results: object[] }}
 */
export async function sendBulkSms({ recipients = [], body }) {
  const phones = dedupePhones(recipients);
  if (!phones.length) {
    return { requested: 0, sent: 0, failed: 0, skipped: 0, error: 'No valid phone numbers', results: [] };
  }

  if (!isSmsConfigured()) {
    return {
      requested: phones.length,
      sent: 0,
      failed: 0,
      skipped: phones.length,
      error: getSmsSkipReason() || 'SMS not configured',
      results: [],
    };
  }

  const text = String(body || '').slice(0, MAX_SMS_CHARS);
  const sender = process.env.BULKSMS_SENDER_ID?.trim();
  const submissions = phones.map((to) => {
    const item = { to, body: text };
    if (sender) item.from = sender;
    return item;
  });

  try {
    const res = await fetch(`${BULKSMS_BASE}/messages`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submissions),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = data?.detail || data?.title || data?.error || res.statusText;
      return {
        requested: phones.length,
        sent: 0,
        failed: phones.length,
        skipped: 0,
        error: String(detail || `HTTP ${res.status}`),
        results: phones.map((to) => ({ ok: false, to, error: String(detail || 'Rejected') })),
      };
    }

    const list = Array.isArray(data) ? data : (data ? [data] : []);
    const results = [];
    let sent = 0;
    let failed = 0;

    phones.forEach((to, index) => {
      const item = list[index] || list[0] || null;
      const statusType = item?.status?.type || '';
      const rejected = /FAIL|REJECT/i.test(statusType);
      if (rejected) {
        failed += 1;
        results.push({
          ok: false,
          to,
          error: item?.status?.subtype || statusType || 'Rejected',
        });
      } else {
        sent += 1;
        results.push({
          ok: true,
          to,
          status: statusType || 'ACCEPTED',
          id: item?.id || null,
        });
      }
    });

    return { requested: phones.length, sent, failed, skipped: 0, results };
  } catch (err) {
    return {
      requested: phones.length,
      sent: 0,
      failed: phones.length,
      skipped: 0,
      error: err.message || 'SMS request failed',
      results: phones.map((to) => ({ ok: false, to, error: err.message })),
    };
  }
}
