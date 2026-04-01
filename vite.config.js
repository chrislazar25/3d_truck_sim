import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxy = {
  '/state': { target: 'http://localhost:3001', changeOrigin: true },
  '/lights': { target: 'http://localhost:3001', changeOrigin: true },
  // Must not use `/truck` — that prefix matches `/truck.glb` and steals the model from `public/`.
  '/truck/speed': { target: 'http://localhost:3001', changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { ...apiProxy },
  },
  preview: {
    proxy: { ...apiProxy },
  },
});
