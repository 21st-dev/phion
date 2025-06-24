import { NextConfig } from "next"
import { readFileSync, existsSync } from "fs"
import { resolve, join, dirname } from "path"
import type { PhionConfig } from "./types"

// Use require.resolve for __dirname equivalent
const __dirname = dirname(__filename || "")

// Auto-sync version from package.json
const getPluginVersion = (): string => {
  try {
    const packageJsonPath = join(__dirname, "..", "package.json")
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"))
    return packageJson.version
  } catch (error) {
    console.warn("[Phion] Could not read version from package.json, using fallback")
    return "0.0.1" // Fallback version
  }
}

const PLUGIN_VERSION = getPluginVersion()

// Find the toolbar bundle location
const findToolbarBundle = () => {
  const locations = [
    // Direct in dist/toolbar folder
    join(__dirname, "toolbar", "index.global.js"),
    // In node_modules
    join(dirname(dirname(__dirname)), "dist", "toolbar", "index.global.js"),
    // One level up (when used as dependency)
    join(dirname(dirname(dirname(__dirname))), "phion", "dist", "toolbar", "index.global.js"),
  ]

  for (const location of locations) {
    if (existsSync(location)) {
      return location
    }
  }

  console.warn("[Phion] Could not find toolbar bundle at any of these locations:", locations)
  return null
}

export function withPhionToolbar(nextConfig: NextConfig = {}): NextConfig {
  return {
    ...nextConfig,

    webpack: (config, context) => {
      const { dev, isServer } = context
      // Only inject in development mode and client-side
      if (dev && !isServer) {
        // Read Phion config
        let phionConfig: PhionConfig | null = null
        const configFilePath = resolve(process.cwd(), "phion.config.json")

        if (existsSync(configFilePath)) {
          try {
            const configContent = readFileSync(configFilePath, "utf-8")
            phionConfig = JSON.parse(configContent)
          } catch (error) {
            console.warn("[Phion] Failed to read config:", error)
          }
        }

        // Only inject if toolbar is enabled and config exists
        if (phionConfig && phionConfig.projectId) {
          // Inject toolbar initialization script
          const originalEntry = config.entry
          config.entry = async () => {
            const entries = await originalEntry()

            // Add toolbar injection to main entry
            if (entries["main.js"] && !entries["main.js"].includes("./phion-toolbar-inject.js")) {
              entries["main.js"].unshift("./phion-toolbar-inject.js")
            }

            return entries
          }
        }
      }

      // Call the original webpack config if it exists
      if (typeof nextConfig.webpack === "function") {
        return nextConfig.webpack(config, context)
      }

      return config
    },

    async rewrites() {
      const rewrites = [
        {
          source: "/@phion/:path*",
          destination: "/api/phion/:path*",
        },
      ]

      if (nextConfig.rewrites) {
        const existingRewrites = await nextConfig.rewrites()
        if (Array.isArray(existingRewrites)) {
          return [...rewrites, ...existingRewrites]
        }
        return {
          beforeFiles: rewrites,
          ...existingRewrites,
        }
      }

      return rewrites
    },
  }
}

// Toolbar handler for API routes
export function createToolbarHandler() {
  return (req: any, res: any) => {
    const { path } = req.query
    const toolbarPath = Array.isArray(path) ? path.join("/") : path

    try {
      // Read Phion config
      let phionConfig: PhionConfig | null = null
      const configFilePath = resolve(process.cwd(), "phion.config.json")

      if (existsSync(configFilePath)) {
        try {
          const configContent = readFileSync(configFilePath, "utf-8")
          phionConfig = JSON.parse(configContent)
        } catch (error) {
          console.warn("[Phion] Failed to read config:", error)
        }
      }

      if (toolbarPath === "config.js") {
        // Serve toolbar configuration
        const toolbarConfig = {
          projectId: phionConfig?.projectId || "",
          websocketUrl: phionConfig?.wsUrl || "wss://api.phion.dev",
          position: phionConfig?.toolbar?.position || "top",
          version: PLUGIN_VERSION,
          autoUpdate: phionConfig?.toolbar?.autoUpdate !== false,
          updateChannel: phionConfig?.toolbar?.updateChannel || "stable",
          debug: phionConfig?.debug || false,
        }

        res.setHeader("Content-Type", "application/javascript")
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0")
        res.setHeader("Pragma", "no-cache")
        res.setHeader("Expires", "0")
        res.end(`window.PHION_CONFIG = ${JSON.stringify(toolbarConfig)};`)
        return
      }

      if (toolbarPath === "toolbar.js") {
        // Serve toolbar bundle
        const toolbarBundlePath = findToolbarBundle()

        if (toolbarBundlePath && existsSync(toolbarBundlePath)) {
          const toolbarCode = readFileSync(toolbarBundlePath, "utf-8")

          res.setHeader("Content-Type", "application/javascript")
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0")
          res.setHeader("Pragma", "no-cache")
          res.setHeader("Expires", "0")
          res.end(toolbarCode)
          return
        } else {
          console.error("[Phion] Toolbar bundle not found")
          res.status(404).end("Toolbar bundle not found")
          return
        }
      }

      // Default 404 for unknown paths
      res.status(404).end("Not found")
    } catch (error) {
      console.error("[Phion] Error in toolbar handler:", error)
      res.status(500).end("Internal server error")
    }
  }
}
