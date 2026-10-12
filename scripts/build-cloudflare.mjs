import { execFileSync } from 'node:child_process';

const configured = process.env.SITE_URL || process.argv[2];
if (!configured) throw new Error('Set SITE_URL or pass your HTTPS public origin to npm run build:cloudflare -- https://your-domain.example');
const url = new URL(configured);
if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
  throw new Error('Cloudflare SITE_URL must be an HTTPS origin without credentials, path, query or fragment.');
}
execFileSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, SITE_URL: url.origin, SITE_BASE: '/', ASTRO_OUT_DIR: 'dist-cloudflare' },
});
