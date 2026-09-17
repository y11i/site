// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.ysc.dev',
  integrations: [
    svelte(),
    sitemap({
      filter: (page) => !page.includes('/frame')
    })
  ]
});
