import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';

// TODO: Re-enable @astrojs/sitemap after upgrading to Astro 5.
// v3.7.2 uses astro:routes:resolved which only fires in dev on Astro 4,
// causing a build crash. Remove the import and integration until then.

const SITE_URL = 'https://myhormoneguide.com';

export default defineConfig({
  site: SITE_URL,
  integrations: [
    tailwind(),
    mdx(),
  ],
  output: 'static',
});
