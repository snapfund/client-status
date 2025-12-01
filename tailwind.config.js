/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        status: {
          operational: '#22c55e',
          degraded: '#eab308',
          partial: '#f97316',
          major: '#ef4444',
        }
      }
    },
  },
  plugins: [],
}
