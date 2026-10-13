import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

const visionLibraryPath = 'vendor/mediapipe-1.0.1/vision_bundle.js'
const visionLibrary = readFileSync(new URL('./node_modules/@mediapipe/tasks-vision/vision_bundle.js', import.meta.url), 'utf8')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'mediapipe-classic-worker-library',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== `/${visionLibraryPath}`) { next(); return; }
        response.setHeader('Content-Type', 'application/javascript')
        response.end(visionLibrary)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: visionLibraryPath, source: visionLibrary })
    },
  }],
  worker: { format: 'iife' },
})
