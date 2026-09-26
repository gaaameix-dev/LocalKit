import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';

// The app is served from https://<user>.github.io/LocalKit/ — this is the single
// place the deployment base path is defined. All PWA paths derive from it.
const base = '/LocalKit/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'LocalKit – Offline SuperTools',
        short_name: 'LocalKit',
        start_url: base,
        scope: base,
        display: 'standalone',
        theme_color: '#080a12',
        background_color: '#080a12',
        description: 'Private offline-first toolkit',
        icons: [
          {src: base + 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable'},
          {src: base + 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable'}
        ]
      },
      workbox: {
        navigateFallback: base + 'index.html',
        globPatterns: ['**/*.{js,css,html}', 'icons/*.png']
      }
    })
  ]
});
