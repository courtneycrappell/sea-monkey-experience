import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://courtneycrappell.com',
  base: '/findpianoworks',
  integrations: [tailwind()],
  output: 'static',
});
