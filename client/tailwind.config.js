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
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#16a34a', // Emerald / Khata Green
          600: '#15803d',
          700: '#166534',
          800: '#14532d',
          900: '#052e16',
        },
        khata: {
          debit: '#e11d48',   // Red for Baaki/Debit
          credit: '#059669',  // Emerald for Jama/Payment
          gold: '#d97706',    // Amber for pending/partial
          slate: '#0f172a',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
