import { defineConfig } from "tsup"

export default defineConfig([
  // Agent CLI build
  {
    entry: ["src/index.ts", "src/cli.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    external: ["vite"],
  },
  // Plugin build (separate for vite import)
  {
    entry: ["src/plugin.ts"],
    format: ["esm"],
    dts: true,
    clean: false,
    external: ["vite"],
    outDir: "dist",
  },
  // Next.js Plugin build (separate for next import)
  {
    entry: ["src/plugin-next.ts"],
    format: ["esm"],
    dts: true,
    clean: false,
    external: ["next"],
    platform: "node",
    outDir: "dist",
  },
  // Toolbar bundle build (standalone)
  {
    entry: ["src/toolbar/index.tsx"],
    format: ["iife"],
    globalName: "PhionToolbar",
    outDir: "dist/toolbar",
    minify: true,
    clean: false,
    platform: "browser",
    // Don't use noExternal, let tsup handle bundling automatically for browser
    external: [
      "fs",
      "path",
      "os",
      "crypto",
      "http",
      "https",
      "net",
      "tls",
      "util",
      "events",
      "stream",
      "buffer",
      "url",
      "querystring",
      "child_process",
      "cluster",
      "dns",
      "dgram",
      "readline",
      "repl",
      "tty",
      "zlib",
    ],
    esbuildOptions: (options) => {
      options.jsx = "automatic"
      options.platform = "browser"
      options.target = "es2020"
      options.define = {
        "process.env.NODE_ENV": '"production"',
        global: "globalThis",
        process: "undefined",
      }
      // Ensure these Node.js modules throw clear errors if somehow required
      options.alias = {
        fs: "data:text/javascript,export default {}",
        path: "data:text/javascript,export default {}",
        os: "data:text/javascript,export default {}",
      }
    },
  },
])
