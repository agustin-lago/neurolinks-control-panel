/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/**/*.{html,js}",
    "./assets/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        primary:  { DEFAULT: "#0A192F", light: "#102A43" },
        accent:   { DEFAULT: "#0078D4", bright: "#0099FF", light: "#00B4D8",
                    sky: "#48CAE4", pale: "#90E0EF", subtle: "#AFC8E8", muted: "#7895B2" },
        gold:     { DEFAULT: "#dfce82", dark: "#c4b55e" },
        whatsapp: { DEFAULT: "#25d366", dark: "#1da851" },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "Montserrat", "sans-serif"],
        body:    ["var(--font-body)",    "Poppins",    "sans-serif"],
      },
    },
  },
  plugins: [],
};
