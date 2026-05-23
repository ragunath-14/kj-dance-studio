import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    host: true,
    proxy: {
      '/api': {
        target: 'https://dance-studio-5nu0.onrender.com',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'https://dance-studio-5nu0.onrender.com',
        ws: true,
        changeOrigin: true
      }
    }
  }
})
