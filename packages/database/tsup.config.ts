import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    client: 'src/client.ts',
    queries: 'src/queries/index.ts'
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['@supabase/supabase-js', '@supabase/ssr', '@shipvibes/shared'],
  target: 'node16'
}) 