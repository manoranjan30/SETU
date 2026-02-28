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
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('ag-grid')) return 'vendor-aggrid';
            if (id.includes('pdfjs-dist') || id.includes('react-pdf')) return 'vendor-pdf';
            if (id.includes('lucide-react')) return 'vendor-lucide';
            if (id.includes('recharts')) return 'vendor-recharts';
            if (id.includes('three')) return 'vendor-three';
            return 'vendor';
          }
        },
      },
    },
  },
})
