import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'ArbiTrack P2P Trading System',
        short_name: 'ArbiTrack',
        description: 'Herramienta Profesional de Control de Capital P2P',
        theme_color: '#020B16',
        background_color: '#020B16',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        screenshots: [
          {
            src: "screenshots/shot1.png",
            sizes: "1080x1920",
            type: "image/png",
            form_factor: "wide"
          },
          {
            src: "screenshots/shot2.png",
            sizes: "1080x1920",
            type: "image/png"
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /\.(js|css|png|svg|ico|woff2)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 dias
              },
            },
          },
          {
            // API data y llamadas a Supabase
            urlPattern: /(\/api\/|https:\/\/.*\.supabase\.co\/.*)/i,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'api-data',
              networkTimeoutSeconds: 3,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    })
  ],
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'vendor-react';
            if (id.includes('gsap')) return 'vendor-gsap';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('@supabase')) return 'vendor-supabase';
            return 'vendor-core';
          }
        }
      }
    }
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
  server: {
    proxy: {
      // Dev proxy: forward /api/binance to our local express server
      '/api/binance': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/binance/, '/api/p2p-orders'),
      },
    },
  },
});
