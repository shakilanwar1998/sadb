/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif'
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace'
        ]
      },
      colors: {
        bg: {
          0: '#07080d',
          1: '#0c0e15',
          2: '#11141d',
          3: '#171a25',
          4: '#1e2230'
        },
        line: {
          DEFAULT: 'rgba(255,255,255,0.06)',
          strong: 'rgba(255,255,255,0.12)'
        },
        ink: {
          DEFAULT: '#e6e9f2',
          dim: '#9097ac',
          faint: '#5b6178'
        },
        brand: {
          DEFAULT: '#7c5cff',
          400: '#9c87ff',
          500: '#7c5cff',
          600: '#5b3ff0',
          glow: 'rgba(124,92,255,0.45)'
        },
        accent: {
          cyan: '#22d3ee',
          mint: '#34e3b1',
          amber: '#ffb547',
          rose: '#ff5d8f'
        },
        success: '#34e3b1',
        warning: '#ffb547',
        danger: '#ff5d6c'
      },
      backgroundImage: {
        'grid-glow':
          'radial-gradient(ellipse at top, rgba(124,92,255,0.18), transparent 60%), radial-gradient(ellipse at bottom right, rgba(34,211,238,0.10), transparent 60%)',
        'panel-edge':
          'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 100%)'
      },
      boxShadow: {
        panel: '0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 40px -12px rgba(0,0,0,0.45)',
        glow: '0 0 0 1px rgba(124,92,255,0.4), 0 6px 30px -8px rgba(124,92,255,0.55)'
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        pulseSoft: {
          '0%, 100%': { opacity: 0.6 },
          '50%': { opacity: 1 }
        }
      },
      animation: {
        shimmer: 'shimmer 2.4s linear infinite',
        pulseSoft: 'pulseSoft 2s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
