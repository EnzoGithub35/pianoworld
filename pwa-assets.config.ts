import {
  defineConfig,
  minimal2023Preset as preset
} from '@vite-pwa/assets-generator/config'

/**
 * Config @vite-pwa/assets-generator
 *
 * Génère depuis `public/favicon.svg` :
 *  - pwa-64x64.png            (transparent, small icon)
 *  - pwa-192x192.png          (transparent, Android primary)
 *  - pwa-512x512.png          (transparent, splash + high-res)
 *  - maskable-icon-512x512.png (safe-zone padding, background crème)
 *  - apple-touch-icon-180x180.png (iOS home screen, background opaque)
 *  - favicon.ico              (multi-size fallback legacy)
 *
 * Override des défaults du preset minimal-2023 pour aligner avec le branding
 * PianoWorld :
 *  - resizeOptions.background = crème '#FAF7F0' (PianoWorld)
 *  - apple.resizeOptions.background = crème (Apple recommande opaque)
 *  - maskable utilise padding 80% (centre safe zone) — l'OS applique son
 *    propre masque (cercle Android Pixel, squircle iOS)
 *
 * Run via `npm run generate-pwa-assets`.
 * Les PNG générés sont commités dans public/ (servis statiquement par Vercel).
 */
export default defineConfig({
  preset: {
    ...preset,
    apple: {
      ...preset.apple,
      resizeOptions: {
        ...preset.apple.resizeOptions,
        background: '#FAF7F0'
      }
    },
    maskable: {
      ...preset.maskable,
      resizeOptions: {
        ...preset.maskable.resizeOptions,
        background: '#FAF7F0'
      }
    }
  },
  images: ['public/favicon.svg']
})
