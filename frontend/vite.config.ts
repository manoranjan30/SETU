import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/ - Optimized for React PDF
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['ag-grid-react', 'ag-grid-community', 'react-pdf', 'pdfjs-dist', 'react-grid-layout']
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    hmr: {
      host: 'localhost',
      clientPort: 5173,
      protocol: 'ws',
    },
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
  build: {
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('ag-grid-react')) return 'vendor-aggrid-react';
            if (id.includes('ag-grid-community')) return 'vendor-aggrid-community';
            if (id.includes('pdfjs-dist') || id.includes('react-pdf')) return 'vendor-pdf';
            if (id.includes('lucide-react')) return 'vendor-lucide';
            if (id.includes('recharts')) return 'vendor-recharts';
            if (id.includes('three')) return 'vendor-three';
            if (id.includes('react-router')) return 'vendor-router';
            if (id.includes('@xyflow')) return 'vendor-flow';
            if (id.includes('@dnd-kit')) return 'vendor-dnd';
            if (id.includes('xlsx')) return 'vendor-xlsx';
            if (id.includes('react-grid-layout')) return 'vendor-grid-layout';
            if (id.includes('axios')) return 'vendor-axios';
            return 'vendor';
          }
        },
      },
    },
  },
})
