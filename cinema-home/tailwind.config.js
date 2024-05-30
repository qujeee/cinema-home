/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [".//**/*.{html,js}"],
  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      {
        light: {
          ...require("daisyui/src/theming/themes")["light"],
          primary: "#1d4ed8",
          "primary-focus": "#0284c7",
        },
        dark: {
          ...require("daisyui/src/theming/themes")["dark"],
          primary: "#2563eb",
          "primary-focus": "#3b82f6",
        },
      },
    ],
  },
}

