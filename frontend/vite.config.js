import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      // No rewrite: backend/app/main.py mounts every router under /api itself,
      // so /api/recommend must reach it as /api/recommend -- this keeps the
      // same frontend URLs working in production, where there's no Vite proxy.
      '/api': {
        target: 'http://localhost:8000',
      },
    },
  },
})
