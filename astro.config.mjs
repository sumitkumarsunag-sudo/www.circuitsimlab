// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://circuitsimlab.com',
  // One URL shape everywhere: pages build to /foo.html, which Cloudflare serves
  // at /foo (and redirects /foo/ to it). That matches the canonical tags and
  // every internal link, so nothing on the site points at a redirect.
  trailingSlash: 'never',
  integrations: [
    react(),
    sitemap({
      // /s/v is the noindex share shell — it has no business in the sitemap.
      filter: (page) => !/\/s\/v\/?$/.test(page),
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
    worker: {
      format: 'es',
    },
  },

  build: {
    format: 'file',
    inlineStylesheets: 'auto',
  }
});
