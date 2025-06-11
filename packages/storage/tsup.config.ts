import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'r2-toolbar': 'src/r2-toolbar.ts'
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['@aws-sdk/client-s3'],
  target: 'node16'
}) 