function trimTrailingSlash(url: string) {
  return String(url || '').replace(/\/+$/, '');
}

/** Backend origin without trailing slash, e.g. http://localhost:5001 */
export function getApiOrigin(): string {
  return trimTrailingSlash(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001');
}

/** REST base, e.g. http://localhost:5001/api */
export function getApiBase(): string {
  return `${getApiOrigin()}/api`;
}
