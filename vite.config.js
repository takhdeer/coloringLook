import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Forward API calls to the Express server in dev
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
