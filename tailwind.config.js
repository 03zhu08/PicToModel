/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        mc: {
          bg: '#ffffff',
          secondary: '#f5f5f5',
          tertiary: '#ececec',
          hover: '#e8e8e8',
          accent: '#4a90d9',
          'accent-hover': '#357abd',
          border: '#d6d6d6',
          text: '#333333',
          'text-secondary': '#6e6e6e',
          'text-muted': '#999999',
          danger: '#d94452',
          success: '#42a35a',
        }
      }
    }
  },
  plugins: []
}
