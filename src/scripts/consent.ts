const MEASUREMENT_ID = 'G-0SFK86LPGH';
const STORAGE_KEY = 'cookieConsent';
const denied = {
  analytics_storage: 'denied', ad_storage: 'denied',
  ad_user_data: 'denied', ad_personalization: 'denied',
};

export function initConsent(base: string, reload = () => window.location.reload()): void {
  const banner = document.getElementById('cookie-consent');
  const accept = document.getElementById('cookie-accept');
  const reject = document.getElementById('cookie-reject');
  if (!banner || !accept || !reject) return;

  const analyticsWindow = window as unknown as Record<string, any>;
  const queue = analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
  function gtag() { queue.push(arguments); }
  const send = gtag as (...args: unknown[]) => void;
  analyticsWindow.gtag = send;
  send('consent', 'default', denied);
  analyticsWindow[`ga-disable-${MEASUREMENT_ID}`] = true;
  let loaded = false;

  function stored(): string | null {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }
  function save(value: string): void {
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* Choice still applies to this page. */ }
  }
  function show(): void {
    banner!.classList.add('show');
    accept!.focus();
  }
  function grant(): void {
    analyticsWindow[`ga-disable-${MEASUREMENT_ID}`] = false;
    send('consent', 'update', { ...denied, analytics_storage: 'granted' });
    if (loaded) return;
    loaded = true;
    send('js', new Date());
    send('config', MEASUREMENT_ID, {
      cookie_domain: 'none', cookie_path: base, cookie_flags: 'SameSite=Lax;Secure',
      allow_google_signals: false, allow_ad_personalization_signals: false,
      page_location: window.location.origin + window.location.pathname,
      page_referrer: document.referrer ? new URL(document.referrer).origin : '',
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.append(script);
  }
  function revoke(value: string): void {
    analyticsWindow[`ga-disable-${MEASUREMENT_ID}`] = true;
    save(value);
    for (const name of ['_ga', `_ga_${MEASUREMENT_ID.slice(2)}`]) {
      for (const path of new Set([base, '/'])) {
        document.cookie = `${name}=; Max-Age=0; Path=${path}; SameSite=Lax`;
        document.cookie = `${name}=; Max-Age=0; Path=${path}; Domain=${window.location.hostname}; SameSite=Lax`;
      }
    }
    // A fresh document unloads the Google tag; refusal must not emit cookieless pings.
    if (loaded) reload();
  }

  if (stored() === 'accepted') grant();
  else if (stored() === 'rejected') revoke('rejected');
  else show();
  accept.addEventListener('click', () => {
    save('accepted');
    banner.classList.remove('show');
    grant();
  });
  reject.addEventListener('click', () => {
    revoke('rejected');
    banner.classList.remove('show');
  });
  document.querySelectorAll('[data-cookie-settings]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      revoke('pending');
      show();
    });
  });
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY && stored() !== 'accepted') {
      revoke(stored() ?? 'pending');
      if (stored() !== 'rejected') show();
    }
  });
}
