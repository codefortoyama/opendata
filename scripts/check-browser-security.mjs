import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = process.argv[2];
if (!target) throw new Error('Pass the site URL to check.');
const site = new URL(target);
if (!['https:', 'http:'].includes(site.protocol) || (site.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(site.hostname))) {
  throw new Error('Use HTTPS, or a local HTTP test server.');
}
const executable = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!executable) throw new Error('A local Chromium browser is required.');
const profile = resolve('.tools', `security-browser-${process.pid}`);
mkdirSync(profile, { recursive: true });
const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
  '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'],
  { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  const activePort = resolve(profile, 'DevToolsActivePort');
  for (let i = 0; !existsSync(activePort) && i < 200; i++) await pause(100);
  if (!existsSync(activePort)) throw new Error('Chromium did not start its debugging endpoint.');
  const port = readFileSync(activePort, 'utf8').split('\n')[0];
  const page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let nextId = 0;
  const pending = new Map();
  const runtimeErrors = [];
  const commands = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
  let blockedMeasurementRequests = 0;
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timeout);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.text);
    else if (message.method === 'Fetch.requestPaused') {
      // Do not pollute production analytics during the browser test.
      blockedMeasurementRequests++;
      void commands('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 204, body: '' })
        .catch(error => runtimeErrors.push(error.message));
    }
  });
  const evaluate = async expression => {
    const result = await commands('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  await commands('Page.enable');
  await commands('Runtime.enable');
  await commands('Fetch.enable', { patterns: [
    { urlPattern: '*google-analytics.com*collect*' }, { urlPattern: '*google.com*collect*' },
  ] });
  await commands('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => {
      window.__cspViolations.push({ directive: event.effectiveDirective, blocked: event.blockedURI });
    });
  ` });
  await commands('Page.navigate', { url: site.href });
  for (let i = 0; i < 150; i++) {
    if (await evaluate("document.querySelectorAll('.card--app').length > 0 && document.querySelector('.hero-image')?.complete")) break;
    await pause(100);
  }
  await evaluate(`Promise.all([...document.querySelectorAll('.card-qr img')].map(image => {
    image.loading = 'eager';
    return image.decode().catch(() => {});
  }))`);
  const initial = await evaluate(`({
    cards: document.querySelectorAll('.card--app').length,
    imageLoaded: document.querySelector('.hero-image')?.naturalWidth > 0,
    qrLoaded: [...document.querySelectorAll('.card-qr img')].every(image => image.naturalWidth > 0),
    consentBanner: document.querySelector('#cookie-consent')?.classList.contains('show'),
    googleScripts: [...document.scripts].filter(script => script.src.includes('googletagmanager.com')).length,
    violations: window.__cspViolations,
    referrerPolicy: document.querySelector('meta[name="referrer"]')?.content
  })`);
  assert.equal(initial.cards, 6);
  assert.equal(initial.imageLoaded, true);
  assert.equal(initial.qrLoaded, true);
  assert.equal(initial.consentBanner, true);
  assert.equal(initial.googleScripts, 0);
  assert.equal(initial.referrerPolicy, 'no-referrer');
  assert.deepEqual(initial.violations, []);

  await evaluate(`document.getElementById('search-input').value = '交通';
    document.getElementById('search-input').dispatchEvent(new Event('input', { bubbles: true }));`);
  const searchCards = await evaluate("document.querySelectorAll('.card--app').length");
  assert.ok(searchCards > 0);
  await evaluate("document.getElementById('cookie-accept').click()");
  await pause(3000);
  const accepted = await evaluate(`({
    googleScripts: [...document.scripts].filter(script => script.src.includes('googletagmanager.com')).length,
    violations: window.__cspViolations,
    choice: localStorage.getItem('cookieConsent')
  })`);
  assert.equal(accepted.googleScripts, 1);
  assert.equal(accepted.choice, 'accepted');
  assert.deepEqual(accepted.violations, []);

  await evaluate(`window.__injectedRan = false;
    const injected = document.createElement('script');
    injected.textContent = 'window.__injectedRan = true';
    document.body.append(injected);`);
  await pause(200);
  assert.equal(await evaluate('window.__injectedRan'), false);
  const injectedBlocked = await evaluate("window.__cspViolations.some(event => event.directive === 'script-src-elem' && event.blocked === 'inline')");
  assert.equal(injectedBlocked, true);

  await evaluate("document.querySelector('[data-cookie-settings]').click()");
  await pause(2000);
  const revoked = await evaluate(`({
    googleScripts: [...document.scripts].filter(script => script.src.includes('googletagmanager.com')).length,
    banner: document.querySelector('#cookie-consent')?.classList.contains('show'),
    choice: localStorage.getItem('cookieConsent'),
    violations: window.__cspViolations
  })`);
  assert.equal(revoked.googleScripts, 0);
  assert.equal(revoked.banner, true);
  assert.equal(revoked.choice, 'pending');
  assert.deepEqual(revoked.violations, []);
  assert.deepEqual(runtimeErrors, []);
  const report = { checkedAt: new Date().toISOString(), target: site.href, initial, accepted, revoked,
    searchCards, injectedBlocked, blockedMeasurementRequests, runtimeErrors };
  mkdirSync('output/security', { recursive: true });
  writeFileSync('output/security/browser-csp-check.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  await commands('Browser.close');
} finally {
  socket?.close();
  if (browser.exitCode === null) browser.kill();
}
