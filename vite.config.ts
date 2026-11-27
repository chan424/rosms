import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base ("./"): the app uses hash routes (/#/...), so every page is index.html and the same build
// works at https://rosms.in/ (custom domain, public/CNAME) and at https://chan424.github.io/rosms/.
// Set BASE_PATH (e.g. "/") to force an absolute base.
export default defineConfig({
  base: process.env.BASE_PATH || './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          mui: ['@mui/material', '@emotion/react', '@emotion/styled'],
        },
      },
    },
  },
});
