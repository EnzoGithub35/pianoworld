/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/**
 * Config Vitest pour PianoWorld.
 *
 * - jsdom : env DOM-like nécessaire pour les tests de composants/hooks
 * - setupFiles : importe jest-dom matchers + reset auto entre tests
 * - alias `@/` aligné avec le projet
 * - coverage v8 : seuils stricts sur src/lib/, plus relâchés ailleurs
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/types/**'
      ],
      thresholds: {
        // Pas de seuil global tant que B.3 (component/hook tests) n'est pas
        // écrit — on n'a testé que src/lib/ pour l'instant. La coverage globale
        // est imprimée mais informative.
        //
        // Sur src/lib/ on garde un seuil aligné sur l'état actuel + petit
        // tampon — toute régression de couverture sur ces fichiers fail.
        // À monter quand on aura plus de tests (cible 80% à terme).
        'src/lib/**/*.ts': { lines: 65, branches: 55, functions: 60, statements: 65 }
      }
    }
  }
})
