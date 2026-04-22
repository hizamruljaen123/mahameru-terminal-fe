/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg_main: 'var(--bg-main)',
        bg_header: 'var(--bg-header)',
        bg_sidebar: 'var(--bg-sidebar)',
        text_primary: 'var(--text-primary)',
        text_secondary: 'var(--text-secondary)',
        text_accent: 'var(--text-accent)',
        border_main: 'var(--border-main)',
      },
      fontFamily: {
        roboto: ['Roboto', 'sans-serif'],
        mono: ['Roboto Mono', 'monospace'],
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        }
      },
      animation: {
        'shimmer': 'shimmer 2s infinite',
      }
    },
  },
  plugins: [],
}
