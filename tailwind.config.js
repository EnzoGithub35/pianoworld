/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      },
      // Sprint 12 A.5 CSP — utilities pour éliminer style={{ paddingBottom: 'env(safe-area-inset-...)' }}
      // sans recourir à 'unsafe-inline' style-src. Compose comme `pb-safe-bottom`,
      // `pt-safe-banner`, `bottom-safe`, etc.
      padding: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
        'safe-fab': 'calc(1rem + env(safe-area-inset-bottom))',
        'safe-banner-bottom': 'calc(0.75rem + env(safe-area-inset-bottom))',
        'safe-banner-top': 'calc(0.5rem + env(safe-area-inset-top))',
        'safe-dialog-bottom': 'calc(1.25rem + env(safe-area-inset-bottom))',
        'safe-tutorial-bottom': 'calc(1.5rem + env(safe-area-inset-bottom))',
        'safe-form-top': 'calc(0.75rem + env(safe-area-inset-top))'
      },
      inset: {
        'safe-fab': 'calc(1rem + env(safe-area-inset-bottom))'
      }
    }
  },
  plugins: [require('tailwindcss-animate')],
  // Safelist : préserve les 12 classes Avatar HSL bucket + 6 classes QualityBadge
  // générées dynamiquement (sinon Tailwind les tree-shake car non détectées
  // dans le source statique). Voir src/index.css @layer utilities.
  safelist: [
    'avatar-h0', 'avatar-h30', 'avatar-h60', 'avatar-h90',
    'avatar-h120', 'avatar-h150', 'avatar-h180', 'avatar-h210',
    'avatar-h240', 'avatar-h270', 'avatar-h300', 'avatar-h330',
    'quality-neuf', 'quality-bon_etat', 'quality-potable',
    'quality-desaccorde', 'quality-desastreux', 'quality-autre',
    'pm-neuf', 'pm-bon_etat', 'pm-potable',
    'pm-desaccorde', 'pm-desastreux', 'pm-autre'
  ]
}
