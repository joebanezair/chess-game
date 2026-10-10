import type { Config } from 'tailwindcss';
export default {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101518',
        panel: '#182023',
        line: '#303b3b',
        cream: '#f0eadb',
        gold: '#d7af69',
        muted: '#a4aea9',
      },
      boxShadow: { board: '0 25px 65px rgba(0,0,0,.35)', soft: '0 12px 32px rgba(0,0,0,.15)' },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'], display: ['Georgia', 'serif'] },
    },
  },
  plugins: [],
} satisfies Config;
