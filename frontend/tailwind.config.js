/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html", // Include your main HTML file
      "./src/**/*.{js,ts,jsx,tsx}", // Include all JS/TS/JSX/TSX files in the src folder
    ],
    theme: {
      extend: {
         // Add custom theme settings here later if needed
         // Ensure this 'colors' section is present!
         colors: {
           'jp-bg': '#FDF3E7',      // Creamy background
           'jp-text-main': '#4A3F35', // Dark brown text
           'jp-text-header': '#6B4F4F', // Header text color
           'jp-text-muted': '#A07F6A', // Muted text color
           'jp-accent': '#E57A44',    // Orange accent (button)
           'jp-accent-hover': '#D46A34', // Darker orange for hover
           'jp-border': '#D3C1AE',    // Border color
         }
      },
    },
    plugins: [],
  }
  