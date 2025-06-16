import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { plugin as phionPlugin } from "phion"
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), phionPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "/src/": path.resolve(__dirname, "./src/"),
    },
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
    },
  },
})
