import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import globals from 'globals'

/**
 * ESLint config flat (ESLint 9+) pour PianoWorld.
 *
 * Strict TypeScript + règles React hooks + accessibilité de base. La cible est
 * d'attraper les fautes courantes (useEffect deps manquantes, hooks
 * conditionnels, missing alt) sans flooder de warnings stylistiques (laissés
 * à Prettier).
 *
 * Les tests Vitest sont assouplis (any et console autorisés).
 */
export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      '.husky',
      'coverage',
      'supabase/functions/**',
      'tailwind.config.js',
      'postcss.config.js',
      'vite.config.ts',
      'vitest.config.ts'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node }
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Règles strictes React 19 (react-hooks v7) — passées en warn pour ne
      // pas bloquer le CI sur du code pré-existant. À traiter au cas par cas
      // (ex: Date.now() in render → useState + useEffect ticker quand visible
      // dans l'UI, sinon laisser tel quel si la stale est acceptable).
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/refs': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true }
      ],
      // Accessibilité minimum
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-is-valid': 'warn',
      'jsx-a11y/aria-props': 'warn',
      'jsx-a11y/role-has-required-aria-props': 'warn',
      // TS quality
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Garde-fous projet
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  },
  {
    // Le logger est volontairement le seul endroit où console.* est autorisé.
    files: ['src/lib/logger.ts'],
    rules: { 'no-console': 'off' }
  },
  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'src/test/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off'
    }
  }
)
