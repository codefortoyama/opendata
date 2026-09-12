import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://codefortoyama.github.io',
  base: '/opendata',
  outDir: 'dist',
  trailingSlash: 'always',
  // GitHub Pages設定
  integrations: [],
});