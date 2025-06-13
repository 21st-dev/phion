import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  root: 'dev-server',
  publicDir: '../dev-server/public',
  build: {
    outDir: '../dev-server/dist',
    emptyOutDir: true,
  },
  server: {
    port: 3005,
    open: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  define: {
    'process.env': {},
  },
}) 