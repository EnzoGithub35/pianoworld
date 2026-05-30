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
        lines: 30,
        branches: 30,
        functions: 30,
        statements: 30,
        // Cible plus stricte sur le code pur (où on a écrit nos tests)
        'src/lib/**/*.ts': { lines: 70, branches: 60, functions: 70, statements: 70 }
      }
    }
  }
})
