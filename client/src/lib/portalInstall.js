export function getInstallPrompt() {
  return typeof window !== 'undefined' && window.__getPortalInstallPrompt
    ? window.__getPortalInstallPrompt()
    : null;
}

export function clearInstallPrompt() {
  if (typeof window !== 'undefined' && window.__clearPortalInstallPrompt) {
    window.__clearPortalInstallPrompt();
  }
}

export function waitForInstallPrompt(timeout = 2500) {
  const existing = getInstallPrompt();
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const finish = () => {
      window.removeEventListener('portal-install-ready', onReady);
      clearTimeout(timer);
      resolve(getInstallPrompt());
    };
    const onReady = () => finish();
    const timer = setTimeout(finish, timeout);
    window.addEventListener('portal-install-ready', onReady);
  });
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
