/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f2f6ff',
          100: '#e6ecff',
          200: '#c9d6ff',
          300: '#9db4ff',
          400: '#6b8cff',
          500: '#4464f0',
          600: '#2f49d6',
          700: '#283cab',
          800: '#233386',
          900: '#1d2c6b',
          950: '#0b1229',
        },
        surface: {
          light: '#f5f7fb',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, .05), 0 8px 24px -12px rgba(16, 24, 40, .12)',
        'card-hover': '0 2px 4px rgba(16, 24, 40, .06), 0 16px 32px -16px rgba(16, 24, 40, .2)',
        panel: '0 20px 45px -20px rgba(11, 18, 41, .35)',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translate(-100%)' },
          '100%': { transform: 'translate(100%)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        fadeUp: 'fadeUp .35s cubic-bezier(.4,0,.2,1) both',
      },
    },
  },
  plugins: [],
};
