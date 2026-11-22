import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Strict CSP for production builds only. In dev, Vite injects inline scripts
// for hot reload, which a strict policy would block.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'"
].join('; ')

function productionCsp(): Plugin {
  return {
    name: 'needledrop:csp',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
  }
}

const shared = resolve('src/shared')

export default defineConfig({
  main: { resolve: { alias: { '@shared': shared } } },
  preload: { resolve: { alias: { '@shared': shared } } },
  renderer: {
    resolve: { alias: { '@shared': shared, '@': resolve('src/renderer/src') } },
    plugins: [react(), tailwindcss(), productionCsp()]
  }
})
