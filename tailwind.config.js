/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./website/**/*.html', './src/js/**/*.js', './src/templates/**/*.mjs'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#89683A', dark: '#6E532E', light: '#F3EEE7' },
        ink: '#000000',
        muted: '#777777',
        soft: '#F5F5F5',
        line: '#E5E5E5',
      },
      fontFamily: {
        sans: ['Jost', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      maxWidth: { site: '1140px' },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
        'marquee-slow': 'marquee 45s linear infinite',
      },
    },
  },
  plugins: [],
};
