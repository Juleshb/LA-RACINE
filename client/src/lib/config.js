/**
 * Client runtime config (Vite env).
 *
 * VITE_API_URL — backend origin, e.g. https://ecolelaracine.online
 *                Leave empty in local dev to use Vite proxy (/api → :5001).
 * VITE_SOCKET_URL — optional Socket.IO origin (defaults to VITE_API_URL).
 */

function trimTrailingSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

/** Backend origin without trailing slash, or '' for same-origin. */
export function getApiOrigin() {
  return trimTrailingSlash(import.meta.env.VITE_API_URL || '');
}

/** Base path for REST calls, e.g. "/api" or "https://ecolelaracine.online/api". */
export function getApiBase() {
  const origin = getApiOrigin();
  return origin ? `${origin}/api` : '/api';
}

/** Socket.IO server URL (origin only). Undefined/empty = current page origin. */
export function getSocketUrl() {
  const explicit = trimTrailingSlash(import.meta.env.VITE_SOCKET_URL || '');
  if (explicit) return explicit;
  const apiOrigin = getApiOrigin();
  return apiOrigin || undefined;
}
