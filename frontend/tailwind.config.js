/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        ink: 'var(--ink)',
        'ink-contrast': 'var(--ink-contrast)',
        fg: 'var(--text)',
        'fg-2': 'var(--text-2)',
        line: 'var(--line)',
        track: 'var(--track)',
        glass: 'var(--glass)',
        'glass-strong': 'var(--glass-strong)',
      },
      fontFamily: { sans: ['var(--font-sans)'] },
      boxShadow: { glass: 'var(--shadow)' },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
}
