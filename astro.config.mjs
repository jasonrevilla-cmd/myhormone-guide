import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
const SITE_URL = 'https://www.myhormoneguide.com';

export default defineConfig({
  site: SITE_URL,
  integrations: [
    tailwind(),
    mdx(),
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      filter: (page) => !page.includes('/tools/provider-finder'),
    }),
  ],
  output: 'static',
  redirects: {
    '/night-sweats-and-hormones/': '/posts/night-sweats-and-hormones-what-your-body-is-telling-you/',
  },
});
