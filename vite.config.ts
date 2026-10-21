import { readFileSync } from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const packageJson = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf-8'),
) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  // Version affichée dans les réglages : une seule source, `package.json`.
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [
    react(),
    VitePWA({
      // L'enregistrement est fait dans `main.tsx`, pour garder une seule racine.
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: [
        'favicon.svg',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-icon-512x512.png',
        'apple-touch-icon-180x180.png',
      ],
      manifest: {
        // Identité explicite : ne pas dépendre des valeurs par défaut du plugin.
        id: '/',
        start_url: '/',
        scope: '/',
        name: 'Carnet de réussites',
        short_name: 'Carnet',
        lang: 'fr',
        // Pas d'`orientation` : l'iPad doit rester utilisable en paysage
        // (comportement actuel du manifest).
        display: 'standalone',
        theme_color: '#FBF6EC',
        background_color: '#FBF6EC',
        description:
          'Carnet de réussites : suivi des apprentissages de la maternelle, ' +
          'hors ligne et sur l’appareil.',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // `ttf` : les fontes embarquées dans les PDF doivent être disponibles
        // hors ligne pour que la génération fonctionne sans réseau.
        globPatterns: ['**/*.{js,css,html,svg,png,ttf,woff,woff2,ico}'],
        // Les icônes publiques sont déjà déclarées dans `includeAssets` :
        // on les retire du glob pour ne pas les précacher deux fois.
        globIgnores: [
          '**/favicon.svg',
          '**/pwa-192x192.png',
          '**/pwa-512x512.png',
          '**/maskable-icon-512x512.png',
          '**/apple-touch-icon-180x180.png',
        ],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
})
