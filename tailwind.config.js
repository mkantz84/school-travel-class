/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Rubik', 'system-ui', 'sans-serif'],
      },
      colors: {
        cream: '#FAF7F2',
        forest: {
          50: '#eef7f4',
          100: '#d5ebe3',
          500: '#2A9D8F',
          600: '#21867a',
          700: '#19695f',
        },
        coral: {
          50: '#fef1ec',
          100: '#fde0d5',
          500: '#F4845F',
          600: '#e06b44',
        },
        sun: {
          50: '#fef9ec',
          100: '#fbf0cf',
          500: '#F6BD60',
        },
      },
    },
  },
  plugins: [],
};
