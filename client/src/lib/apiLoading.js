let pending = 0;
const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener(pending));
}

export function beginApiLoad() {
  pending += 1;
  notify();
}

export function endApiLoad() {
  pending = Math.max(0, pending - 1);
  notify();
}

export function subscribeApiLoading(listener) {
  listeners.add(listener);
  listener(pending);
  return () => listeners.delete(listener);
}

export async function trackedFetch(url, init, { silent = false } = {}) {
  if (silent) return fetch(url, init);
  beginApiLoad();
  try {
    return await fetch(url, init);
  } finally {
    endApiLoad();
  }
}
