import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const normalizePath = id => id.replace(/\\/g, '/')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = normalizePath(id)

          if (normalizedId.includes('/node_modules/react') || normalizedId.includes('/node_modules/react-dom')) {
            return 'react-vendor'
          }

          if (normalizedId.includes('/node_modules/html-to-image')) return 'export-vendor'
          if (normalizedId.includes('/node_modules/tesseract.js')) return 'ocr-vendor'
          if (normalizedId.includes('/src/scenes/legacy-fcol/')) return 'legacy-scenes'
          if (normalizedId.includes('/src/data/overwatch/')) return 'ow-data'
        }
      }
    }
  }
})
