import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { responseHeaders } from '../config/security.mjs';

export function metaPolicy(html) {
  const tag = html.match(/<meta\b[^>]*http-equiv=["']content-security-policy["'][^>]*>/i)?.[0];
  const value = tag?.match(/\bcontent="([^"]*)"/i)?.[1];
  if (!value) throw new Error('Built page is missing its CSP meta policy.');
  return value.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/gi, "'").replace(/&amp;/g, '&');
}

export function headerPolicy(policies) {
  const directives = new Map();
  for (const policy of policies) {
    for (const entry of policy.split(';')) {
      const [name, ...sources] = entry.trim().split(/\s+/);
      if (!name) continue;
      if (!directives.has(name)) directives.set(name, new Set());
      for (const source of sources) directives.get(name).add(source);
    }
  }
  directives.set('frame-ancestors', new Set(["'none'"]));
  return [...directives].map(([name, sources]) => [name, ...sources].join(' ')).join('; ');
}

async function htmlFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(absolute));
    else if (entry.name.endsWith('.html')) files.push(absolute);
  }
  return files;
}

export default function securityHeaders() {
  return {
    name: 'toyama-security-headers',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const directory = fileURLToPath(dir);
        const pages = await htmlFiles(directory);
        if (!pages.length) throw new Error('No static pages were generated.');
        const policies = await Promise.all(pages.map(async page => metaPolicy(await readFile(page, 'utf8'))));
        const headers = { 'Content-Security-Policy': headerPolicy(policies), ...responseHeaders };
        const lines = Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`);
        if (lines.some(line => line.length > 2000)) throw new Error('Security header exceeds Cloudflare _headers line limit.');
        await writeFile(join(directory, '_headers'), `/*\n${lines.join('\n')}\n`, 'utf8');
      },
    },
  };
}
