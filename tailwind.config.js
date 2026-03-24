/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy:  { DEFAULT: '#1B2B4B', light: '#2a3f6a' },
        teal:  { DEFAULT: '#00C3B5', light: '#e0f7f5', dark: '#00897b' },
        brand: { muted: '#64748B', faint: '#94A3B8', border: '#E8EDF3', bg: '#F7F8FC' },
      },
      fontFamily: { mono: ['"Courier New"', 'Courier', 'monospace'] },
    },
  },
  plugins: [],
};
