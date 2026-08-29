import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    // PORT is set by the Claude preview harness when 5173 is taken by
    // another session's server; nothing else in the stack reads it.
    port: Number(process.env.PORT) || 5173,
    watch: {
      // wrangler writes simulated emails and DO state here; a page reload
      // mid-generation kills the studio's stream attachment.
      ignored: ['**/.wrangler/**'],
    },
  },
})
