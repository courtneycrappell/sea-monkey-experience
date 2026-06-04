/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Trebuchet MS"', 'Verdana', 'sans-serif'],
      },
      colors: {
        fpw: {
          /* original palette from style.css */
          cream:     '#F0EBE7',   /* panel backgrounds, inputs */
          bg:        '#e4e4e4',   /* page background */
          header:    '#5a4a3a',   /* header bar */
          orange:    '#D96B11',   /* h1, accent */
          rust:      '#AD4C21',   /* links, form inputs */
          'rust-dk': '#822C0F',   /* hover, strong accent */
          brown:     '#B05128',   /* footer */
          steel:     '#76b7d7',   /* h3 / section headings */
          'steel-lt':'#9ad5f3',   /* h5 */
          tan:       '#c7b8a4',   /* sidebar nav blocks */
          border:    '#d0c4b8',   /* panel borders */
        },
      },
      maxWidth: {
        site: '760px',
      },
    },
  },
  plugins: [],
};
