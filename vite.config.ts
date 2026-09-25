import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf('node_modules/@supabase')>=0) return 'supabase'
          if (id.indexOf('node_modules/react')>=0 || id.indexOf('node_modules/scheduler')>=0) return 'react-vendor'
          if (id.indexOf('node_modules/lucide-react')>=0) return 'icons'
        },
      },
    },
  },
})
