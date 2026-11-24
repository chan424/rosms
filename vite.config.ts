import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH: "/rosms/" for https://chan424.github.io/rosms/ (default),
// "/" when served from a custom domain (set repo variable BASE_PATH=/ in GitHub).
export default defineConfig({
  base: process.env.BASE_PATH || '/rosms/',
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
