import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Production build output → frontend/dist/
  // Express backend serves it from ../frontend/dist in production
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/recharts')) return 'vendor-charts';
          if (id.includes('node_modules/socket.io-client')) return 'vendor-socket';
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
        }
      }
    }
  },

  server: {
    port: 5173,
    proxy: {
      // REST API → Express
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        // Suppress ECONNREFUSED/ECONNRESET noise when backend is not running
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            // Only log once per error type, not a full stack trace every poll
            const code = err.code || 'ERR';
            if (code === 'ECONNREFUSED' || code === 'ECONNRESET') {
              // Silently swallow — backend is simply not running yet
              if (!res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Backend offline', code }));
              }
            }
          });
        },
      },

      // Socket.IO WebSocket + polling → Express
      '/socket.io': {
        target: 'http://localhost:5001',
        ws: true,
        changeOrigin: true,
        // Suppress ECONNREFUSED/ECONNRESET noise when backend is not running
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            const code = err.code || 'ERR';
            if (code === 'ECONNREFUSED' || code === 'ECONNRESET') {
              // Silently drop — Socket.IO client handles reconnection itself
              if (res && !res.headersSent && typeof res.writeHead === 'function') {
                res.writeHead(503);
                res.end();
              }
            }
          });
        },
      },
    },
  },
})
