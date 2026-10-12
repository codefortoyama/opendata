import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { httpsUrl, validateApps, scriptJson } from '../src/scripts/data.ts';
import { init } from '../src/scripts/apps.ts';
import { initConsent } from '../src/scripts/consent.ts';

const record = {
  id: 1, name: 'App', category: ['Category'], description: 'Description',
  url: 'https://example.com/', copyright: 'Author', verifiedDate: '2026-10-12',
};

function browser(choice) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>
    <div id="cookie-consent"><button id="cookie-accept">Accept</button><button id="cookie-reject">Reject</button></div>
    <a href="#" data-cookie-settings>Settings</a>
    <div id="apps-grid"></div><nav id="pagination"></nav>
    <input id="search-input"><span class="search-results-count"></span>
    </body></html>`, { url: 'https://example.com/opendata/?private=query#fragment' });
  globalThis.window = dom.window;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  if (choice) localStorage.setItem('cookieConsent', choice);
  return dom;
}

test('directory rejects script URLs, credentials, control characters and malformed records', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'http://example.com',
    'https://user:password@example.com', 'https://example.com/" onclick="test', 'https://example.com/\npath']) {
    assert.throws(() => httpsUrl(url));
    assert.throws(() => validateApps([{ ...record, url }]));
  }
  assert.throws(() => validateApps([{ ...record, category: 'not an array' }]));
  assert.throws(() => validateApps([record, record]));
  assert.equal(httpsUrl(record.url), record.url);
});

test('embedded JSON cannot close its script element and preserves data', () => {
  const data = { '</script><script>alert(1)</script>': 'value' };
  const encoded = scriptJson(data);
  assert.ok(!encoded.includes('<'));
  assert.deepEqual(JSON.parse(encoded), data);
});

test('malicious card text remains text, QR attributes cannot create handlers, and search/pagination work', () => {
  const dom = browser();
  try {
    const payload = '\"><img src=x onerror=alert(1)><script>alert(1)</script>';
    const apps = Array.from({ length: 7 }, (_, i) => ({ ...record, id: i + 1,
      name: i === 0 ? payload : `App ${i}`, category: [payload], url: `https://example.com/${i}` }));
    init(apps, { [apps[0].url]: 'data:image/png;base64,aGVsbG8=' });
    assert.equal(document.querySelectorAll('.card').length, 6);
    assert.equal(document.querySelector('h3').textContent, payload);
    assert.equal(document.querySelector('img').alt, `${payload} のQRコード`);
    assert.equal(document.querySelectorAll('script, [onerror], [onclick]').length, 0);
    document.querySelector('[data-page="2"]').click();
    assert.equal(document.querySelectorAll('.card').length, 1);
    const input = document.getElementById('search-input');
    input.value = 'App 1';
    input.dispatchEvent(new window.Event('input'));
    assert.equal(document.querySelectorAll('.card').length, 1);
    assert.equal(document.querySelector('h3').textContent, 'App 1');
  } finally { dom.window.close(); }
});

test('no choice and saved rejection load no Google tag or measurement commands', () => {
  for (const choice of [undefined, 'rejected']) {
    const dom = browser(choice);
    try {
      if (choice === 'rejected') document.cookie = '_ga_0SFK86LPGH=legacy; Path=/opendata/';
      initConsent('/opendata/');
      assert.equal(document.querySelectorAll('script[src]').length, 0);
      const commands = window.dataLayer.map(args => Array.from(args));
      assert.equal(commands.length, 1);
      assert.deepEqual(commands[0].slice(0, 2), ['consent', 'default']);
      assert.equal(commands[0][2].analytics_storage, 'denied');
      assert.equal(window['ga-disable-G-0SFK86LPGH'], true);
      assert.equal(document.getElementById('cookie-consent').classList.contains('show'), !choice);
      assert.equal(document.cookie, '');
      document.getElementById('cookie-reject').click();
      assert.equal(localStorage.getItem('cookieConsent'), 'rejected');
      assert.equal(document.querySelectorAll('script[src]').length, 0);
    } finally { dom.window.close(); }
  }
});

test('acceptance and saved acceptance load once with consent before config, advertising denied', () => {
  for (const choice of [undefined, 'accepted']) {
    const dom = browser(choice);
    try {
      initConsent('/opendata/');
      if (!choice) document.getElementById('cookie-accept').click();
      assert.equal(document.querySelectorAll('script[src]').length, 1);
      assert.equal(localStorage.getItem('cookieConsent'), 'accepted');
      const commands = window.dataLayer.map(args => Array.from(args));
      assert.deepEqual(commands.map(args => args[0]), ['consent', 'consent', 'js', 'config']);
      assert.equal(commands[1][2].analytics_storage, 'granted');
      assert.equal(commands[1][2].ad_storage, 'denied');
      assert.equal(commands[1][2].ad_user_data, 'denied');
      assert.equal(commands[1][2].ad_personalization, 'denied');
      assert.equal(commands[3][2].page_location, 'https://example.com/opendata/');
      assert.equal(commands[3][2].cookie_path, '/opendata/');
      document.getElementById('cookie-accept').click();
      assert.equal(document.querySelectorAll('script[src]').length, 1);
    } finally { dom.window.close(); }
  }
});

test('withdrawal disables analytics, removes its cookies and reloads to unload the tag', () => {
  const dom = browser('accepted');
  try {
    let reloads = 0;
    initConsent('/opendata/', () => { reloads++; });
    document.cookie = '_ga=test; Path=/opendata/';
    document.cookie = '_ga_0SFK86LPGH=test; Path=/opendata/';
    document.querySelector('[data-cookie-settings]').click();
    assert.equal(window['ga-disable-G-0SFK86LPGH'], true);
    assert.equal(localStorage.getItem('cookieConsent'), 'pending');
    assert.equal(document.cookie, '');
    assert.equal(reloads, 1);
    assert.equal(document.getElementById('cookie-consent').classList.contains('show'), true);
  } finally { dom.window.close(); }
});

test('duplicate initialization cannot load or configure analytics twice', () => {
  for (const choice of [undefined, 'accepted']) {
    const dom = browser(choice);
    try {
      initConsent('/opendata/');
      initConsent('/opendata/');
      if (!choice) document.getElementById('cookie-accept').click();
      assert.equal(document.querySelectorAll('script[src]').length, 1);
      const commands = window.dataLayer.map(args => Array.from(args));
      assert.equal(commands.filter(args => args[0] === 'config').length, 1);
      assert.equal(commands.filter(args => args[0] === 'consent' && args[1] === 'default').length, 1);
    } finally { dom.window.close(); }
  }
});

test('revocation in another tab stops analytics in this tab', () => {
  const dom = browser('accepted');
  try {
    let reloads = 0;
    initConsent('/opendata/', () => { reloads++; });
    localStorage.setItem('cookieConsent', 'rejected');
    window.dispatchEvent(new window.StorageEvent('storage', { key: 'cookieConsent', newValue: 'rejected' }));
    assert.equal(window['ga-disable-G-0SFK86LPGH'], true);
    assert.equal(reloads, 1);
  } finally { dom.window.close(); }
});

test('unavailable storage defaults to no analytics without breaking the banner', () => {
  const dom = browser();
  try {
    globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    initConsent('/opendata/');
    assert.equal(document.querySelectorAll('script[src]').length, 0);
    assert.equal(document.getElementById('cookie-consent').classList.contains('show'), true);
    document.getElementById('cookie-reject').click();
    assert.equal(document.querySelectorAll('script[src]').length, 0);
  } finally { dom.window.close(); }
});
