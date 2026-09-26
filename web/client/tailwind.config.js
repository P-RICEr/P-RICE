/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        rice: {
          950: "#0d2b1a",
          900: "#12351f",
          800: "#1b4d2b",
          700: "#256639",
          600: "#2f8047",
          500: "#3f9c58",
          100: "#e8f5ec",
          50: "#f4faf6",
        },
      },
    },
  },
  plugins: [],
};
