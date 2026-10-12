import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { metaPolicy } from '../integrations/security-headers.mjs';

const directory = resolve(process.env.CSP_BUILD_DIR || 'dist');
const headers = readFileSync(join(directory, '_headers'), 'utf8');
const headerCsp = headers.match(/^\s+Content-Security-Policy: (.+)$/m)?.[1];
assert.ok(headerCsp, 'Build must emit its HTTP CSP policy.');

function pages(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const file = join(root, entry.name);
    return entry.isDirectory() ? pages(file) : entry.name.endsWith('.html') ? [file] : [];
  });
}

function directives(policy) {
  return new Map(policy.split(';').filter(item => item.trim()).map(item => {
    const [key, ...values] = item.trim().split(/\s+/);
    return [key, values];
  }));
}

for (const page of pages(directory)) {
  test(`CSP permits generated content and denies injected code: ${page}`, () => {
    const html = readFileSync(page, 'utf8');
    const dom = new JSDOM(html, { url: 'https://example.com/' });
    try {
      const document = dom.window.document;
      const policy = metaPolicy(html);
      const parsed = directives(policy);
      const header = directives(headerCsp);
      assert.equal(document.querySelectorAll('meta[http-equiv="content-security-policy" i]').length, 1);
      assert.equal(document.querySelector('meta[name="referrer"]').content, 'no-referrer');
      assert.ok(!policy.includes("'unsafe-inline'") && !policy.includes("'unsafe-eval'"));
      assert.deepEqual(parsed.get('object-src'), ["'none'"]);
      assert.deepEqual(parsed.get('base-uri'), ["'none'"]);
      assert.deepEqual(parsed.get('script-src-attr'), ["'none'"]);
      assert.deepEqual(parsed.get('style-src-attr'), ["'none'"]);
      assert.deepEqual(header.get('frame-ancestors'), ["'none'"]);
      const cspElement = document.querySelector('meta[http-equiv="content-security-policy" i]');
      const firstScript = document.querySelector('script');
      if (firstScript) assert.ok(cspElement.compareDocumentPosition(firstScript) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING);

      for (const [tag, directive] of [['script', 'script-src'], ['style', 'style-src']]) {
        const allowed = parsed.get(directive) || [];
        for (const element of document.querySelectorAll(tag)) {
          if (element.src || (tag === 'script' && !['', 'module', 'text/javascript'].includes(element.type))) continue;
          const hash = `'sha256-${createHash('sha256').update(element.textContent).digest('base64')}'`;
          assert.ok(allowed.includes(hash), `${tag} hash must be allowed by the page CSP`);
          assert.ok(header.get(directive).includes(hash), `${tag} hash must be allowed by the HTTP CSP`);
        }
        const injected = `'sha256-${createHash('sha256').update('alert("injected")').digest('base64')}'`;
        assert.ok(!allowed.includes(injected));
      }
      assert.ok(parsed.get('script-src').includes('https://www.googletagmanager.com'));
      assert.ok(parsed.get('img-src').includes('data:'));
      assert.equal(document.querySelectorAll('[style], [onclick], [onerror]').length, 0);
    } finally { dom.window.close(); }
  });
}

test('HTTP header manifest protects all paths and stays within provider limits', () => {
  assert.ok(headers.startsWith('/*\n'));
  for (const line of headers.split('\n')) assert.ok(line.length <= 2000);
  assert.ok(headers.includes('X-Frame-Options: DENY'));
  assert.ok(headers.includes('X-Content-Type-Options: nosniff'));
  assert.ok(headers.includes('Strict-Transport-Security: max-age=31536000'));
  assert.ok(headers.includes('Referrer-Policy: no-referrer'));
  assert.ok(headers.includes('Permissions-Policy: camera=(), microphone=(), geolocation=()'));
});
