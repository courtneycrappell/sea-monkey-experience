/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Trebuchet MS"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        fpw: {
          blue:      '#3b6ea5',
          lightblue: '#d4e4f7',
          darkblue:  '#1e3f6e',
          green:     '#4a7c59',
          bg:        '#f5f5f0',
          border:    '#c8d8e8',
        },
      },
    },
  },
  plugins: [],
};
