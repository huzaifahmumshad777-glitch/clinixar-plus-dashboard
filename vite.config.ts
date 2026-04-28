import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // ✅ correct alias
    },
  },

  build: {
    chunkSizeWarningLimit: 2000, // ✅ removes warning

    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          charts: ['recharts'],
          xlsx: ['xlsx'],
        },
      },
    },
  },

  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
