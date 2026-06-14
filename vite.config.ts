import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'PianoWorld',
        short_name: 'PianoWorld',
        description: 'Carte interactive des pianos publics',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Force le SW à reprendre le contrôle dès le nouveau déploiement.
        // Évite que des tuiles cachées en erreur soient servies indéfiniment
        // après un déploiement (cas vu en preview Vercel : fond gris).
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp}'],
        runtimeCaching: [
          {
            // OSM tiles (legacy, conservé au cas où). StaleWhileRevalidate :
            // retourne cache immédiatement mais refetch en parallèle pour
            // que la prochaine vue soit fraîche. Élimine le bug "cache
            // d'erreur servi indéfiniment" de CacheFirst.
            urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'osm-tiles-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          },
          {
            // CartoDB tiles (light Voyager + dark). Couvre les sous-domaines
            // a/b/c/d utilisés par Leaflet pour ce provider.
            urlPattern: /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'carto-tiles-cache',
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          leaflet: ['leaflet', 'react-leaflet', 'react-leaflet-cluster'],
          supabase: ['@supabase/supabase-js'],
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query']
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
})
