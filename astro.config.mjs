import { defineConfig } from 'astro/config';
import { csp } from './config/security.mjs';
import securityHeaders from './integrations/security-headers.mjs';

export default defineConfig({
  site: process.env.SITE_URL || 'https://codefortoyama.github.io',
  // GitHub Pagesへのデプロイ時のみ /opendata を使用
  base: process.env.SITE_BASE || (process.env.GITHUB_ACTIONS ? '/opendata' : '/'),
  outDir: process.env.ASTRO_OUT_DIR || 'dist',
  trailingSlash: 'always',
  compressHTML: true,
  server: { host: '127.0.0.1' },
  security: { csp },
  integrations: [securityHeaders()],
  markdown: { syntaxHighlight: 'prism' },
});
