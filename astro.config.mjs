import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel/serverless';
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
  // Hybrid: every page is prerendered to static HTML by default, same as
  // 'static' output — except src/pages/api/claim.ts, which opts out via
  // `export const prerender = false` and runs as a real Vercel serverless
  // function instead of being silently dropped from the build.
  output: 'hybrid',
  adapter: vercel(),
  redirects: {
    '/night-sweats-and-hormones/': '/posts/night-sweats-and-hormones-what-your-body-is-telling-you/',
    '/tools/provider-finder/': '/find-bhrt-provider/',
  },
});
