/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f7f1',
          100: '#c2ebdc',
          400: '#06cf9c',
          500: '#00a884',
          600: '#008f6f',
          700: '#00755c',
          900: '#003d30',
        },
        surface: {
          50: '#202c33',
          100: '#182229',
          200: '#111b21',
          card: '#202c33',
          hover: '#2a3942',
          border: '#2a3942',
        },
        accent: {
          green: '#00a884',
          red: '#ef4444',
          amber: '#f59e0b',
          blue: '#53bdeb',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.2s ease-out',
        'slide-right': 'slideRight 0.25s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
        'bounce-in': 'bounceIn 0.3s ease-out',
        'ring': 'ring 2s ease-in-out infinite',
      },
      keyframes: {
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        slideRight: { '0%': { transform: 'translateX(-10px)', opacity: 0 }, '100%': { transform: 'translateX(0)', opacity: 1 } },
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        bounceIn: { '0%': { transform: 'scale(0.8)', opacity: 0 }, '70%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)', opacity: 1 } },
        ring: { '0%, 100%': { transform: 'rotate(0deg)' }, '25%': { transform: 'rotate(-15deg)' }, '75%': { transform: 'rotate(15deg)' } },
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
};
