// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // This line tells Tailwind to scan files in your src directory
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}