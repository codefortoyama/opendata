import { defineConfig } from 'astro/config';

export default defineConfig({
  outDir: 'dist',
  trailingSlash: 'always',
  // GitHub Pages設定
  integrations: [],
});