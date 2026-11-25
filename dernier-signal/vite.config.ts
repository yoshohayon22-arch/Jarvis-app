import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// base './' : le site fonctionne quel que soit le sous-dossier GitHub Pages.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        atelier: resolve(__dirname, 'atelier.html'),
        gouverneur: resolve(__dirname, 'gouverneur.html'),
        vallee: resolve(__dirname, 'vallee.html'),
      },
    },
  },
});
