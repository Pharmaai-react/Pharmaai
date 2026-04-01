import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    // Raise the warning threshold – our single-page app is intentionally monolithic for now
    chunkSizeWarningLimit: 600,

    // Split vendor libraries into a separate chunk so they can be cached independently
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Put chart.js in its own chunk
            if (id.includes('chart.js') || id.includes('chartjs')) return 'chart';
            // All other node_modules go into a shared vendor chunk
            return 'vendor';
          }
        },
      },
    },
  },
})
