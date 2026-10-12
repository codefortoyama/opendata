import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://codefortoyama.github.io',
  // GitHub Pagesへのデプロイ時のみ /opendata を使用
  base: process.env.GITHUB_ACTIONS ? '/opendata' : '/',
  outDir: 'dist',
  trailingSlash: 'always',
  compressHTML: true,
  server: { host: '127.0.0.1' },
});
