/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        finora: {
          primary: '#5E81F4',
          soft: '#CDD8FC',
          charcoal: '#16171A',
          graphite: '#1C1D21',
          elevated: '#222328',
          border: 'rgba(255, 255, 255, 0.08)',
          subtle: '#2A2C35',
        },
        obsidian: {
          950: '#16171A',
          900: '#1C1D21',
          800: '#222328',
          700: '#2A2C35',
          600: '#3A3D4A',
        },
        amber: {
          500: '#F59E0B',
          600: '#D97706',
          400: '#FBBF24',
        },
        meta: {
          whatsapp: '#25D366',
          instagram: '#E1306C',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        'glow-primary': '0 0 20px -3px rgba(94, 129, 244, 0.35)',
        'glow-soft': '0 0 16px -2px rgba(205, 216, 252, 0.25)',
        'glow-wa': '0 0 20px -5px rgba(37, 211, 102, 0.3)',
        'glow-ig': '0 0 20px -5px rgba(225, 48, 108, 0.3)',
      },
    },
  },
  plugins: [],
}

