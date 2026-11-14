import { writeFileSync } from 'node:fs'
import type { Connect } from 'vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev tool: the FPS benchmark page (?bench, see src/Bench.tsx) POSTs its results here.
// Only the local Vite server (dev and preview) has this endpoint; it is not in the build output.
const benchEndpoint: Connect.NextHandleFunction = (req, res, next) => {
  if (req.url !== '/__bench' || req.method !== 'POST') return next()
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    writeFileSync(process.env.BENCH_OUT ?? 'bench-result.json', body)
    res.end('ok')
  })
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'bench-endpoint',
      configureServer: (server) => void server.middlewares.use(benchEndpoint),
      configurePreviewServer: (server) => void server.middlewares.use(benchEndpoint),
    },
  ],
})
