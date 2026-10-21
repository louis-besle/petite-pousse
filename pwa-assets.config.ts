import { defineConfig } from '@vite-pwa/assets-generator/config'

/** Fond crème de l'application, repris dans le manifest et les icônes. */
const CREAM = '#FBF6EC'

/**
 * Icônes PWA générées depuis la marque florale :
 * - `pwa-192x192.png` et `pwa-512x512.png` pour le manifest ;
 * - `maskable-icon-512x512.png` avec la marge de sécurité Android ;
 * - `apple-touch-icon-180x180.png` pour l'écran d'accueil iOS.
 */
export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    transparent: {
      sizes: [192, 512],
      favicons: [],
      resizeOptions: { fit: 'contain', background: 'transparent' },
    },
    maskable: {
      sizes: [512],
      padding: 0.3,
      resizeOptions: { fit: 'contain', background: CREAM },
    },
    apple: {
      sizes: [180],
      padding: 0.2,
      resizeOptions: { fit: 'contain', background: CREAM },
    },
  },
  images: ['public/favicon.svg'],
})
