/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        discord: {
          bg: '#36393f',
          sidebar: '#2f3136',
          dark: '#202225',
          darker: '#18191c',
          input: '#40444b',
          text: '#dcddde',
          muted: '#72767d',
          blurple: '#5865f2',
          green: '#3ba55d',
          red: '#ed4245',
          yellow: '#faa81a',
        },
      },
    },
  },
  plugins: [],
};
