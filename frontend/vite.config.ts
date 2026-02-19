import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/ - Optimized for React PDF
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['ag-grid-react', 'ag-grid-community', 'react-pdf', 'pdfjs-dist']
  },
  server: {
    allowedHosts: true
  }
})
