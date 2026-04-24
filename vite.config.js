import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('appwrite')) {
            return 'vendor-appwrite';
          }
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom') || id.includes('react-redux') || id.includes('@reduxjs/toolkit')) {
            return 'vendor-react';
          }
          if (id.includes('@tensorflow/tfjs') || id.includes('nsfwjs')) {
            return 'vendor-ml';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
