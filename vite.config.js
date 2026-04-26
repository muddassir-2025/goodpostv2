import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/moderate-image': 'http://localhost:3000'
    }
  },
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('appwrite')) return 'vendor-appwrite';
            if (id.includes('react') || id.includes('redux') || id.includes('react-router')) return 'vendor-react';
            if (id.includes('framer-motion')) return 'vendor-framer';
            return 'vendor-others';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
