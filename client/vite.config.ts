import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The React app talks to the FastAPI backend (backend/, MariaDB/SQL) over
// /api. In dev Vite proxies that prefix; in production FastAPI serves the
// built client from client/dist itself. Override the target with VITE_API_TARGET.
const apiTarget = process.env.VITE_API_TARGET || 'http://127.0.0.1:8000';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});