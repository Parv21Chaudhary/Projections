/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.{html,js}", "./js/**/*.{html,js}"],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        'profit': '#22c55e', // text-green-500
        'loss': '#ef4444', // text-red-500
      }
    },
  },
  plugins: [],
}
