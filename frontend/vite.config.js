import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Corrected import: tailwindcss, not tailwindess
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  // Corrected plugin usage: tailwindcss(), not tailwindess()
  plugins: [react(), tailwindcss()],
})
