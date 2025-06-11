import { defineConfig } from 'tsup'

export default defineConfig([
  // Main plugin build
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    external: ['vite'],
  },
  // Toolbar bundle build (standalone)
  {
    entry: ['src/toolbar/index.tsx'],
    format: ['iife'],
    globalName: 'VybcelToolbar',
    outDir: 'dist/toolbar',
    minify: true,
    clean: false,
    noExternal: ['socket.io-client', 'react', 'react-dom'],
    esbuildOptions: (options) => {
      options.jsx = 'automatic'
      options.define = {
        'process.env.NODE_ENV': '"production"'
      }
    },
  },
]) 