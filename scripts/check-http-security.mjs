import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { responseHeaders } from '../config/security.mjs';

const configured = process.argv[2];
if (!configured) throw new Error('Pass the base URL to check.');
const base = new URL(configured);
if (base.username || base.password || !['http:', 'https:'].includes(base.protocol)) throw new Error('Invalid public site URL.');
const checks = [];
for (const resource of ['', 'cookie-policy/', 'images/toyama-opendata-eyecatch.png', '.env']) {
  const url = new URL(resource, base);
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const headers = Object.fromEntries(response.headers);
  checks.push({ url: url.href, status: response.status, headers });
  await response.body?.cancel();
  assert.equal(response.status, resource === '.env' ? 404 : 200);
  for (const [name, value] of Object.entries(responseHeaders)) {
    assert.equal(response.headers.get(name), value, `${name} must protect ${resource || '/'}`);
  }
  const csp = response.headers.get('content-security-policy');
  assert.ok(csp?.includes("frame-ancestors 'none'"));
  assert.ok(!csp.includes("'unsafe-inline'") && !csp.includes("'unsafe-eval'"));
}
const report = { checkedAt: new Date().toISOString(), target: base.href, checks };
mkdirSync('output/security', { recursive: true });
writeFileSync('output/security/http-headers-check.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ target: base.href, routes: checks.map(check => ({ url: check.url, status: check.status })), allHeadersVerified: true }, null, 2));
