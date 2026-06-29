import { defineConfig } from 'astro/config'

// Static site, deployed to GitHub Pages at the joanrm20.me custom domain.
export default defineConfig({
  site: 'https://joanrm20.me',
  prefetch: true,
})
