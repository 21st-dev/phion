import type { Plugin } from "vite"
import { readFileSync, existsSync, writeFileSync } from "fs"
import { resolve, join, dirname } from "path"
import { fileURLToPath } from "url"
import type { PhionConfig, PhionPluginOptions, ToolbarVersion, UpdateCheckResponse } from "./types"

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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
const DEFAULT_UPDATE_ENDPOINT =
  process.env.TOOLBAR_UPDATE_ENDPOINT || "http://localhost:3004/api/toolbar"

// Find the toolbar bundle location (working in both dev and prod environments)
const findToolbarBundle = () => {
  // Using import.meta.url for ESM compatibility
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)

  // Try different potential locations
  const locations = [
    // Direct in dist/toolbar folder (new package structure)
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

export function phionPlugin(options: PhionPluginOptions = {}): Plugin {
  const {
    configPath = "phion.config.json",
    websocketUrl = "wss://api.phion.dev",
    autoUpdate = true,
    updateEndpoint = DEFAULT_UPDATE_ENDPOINT,
  } = options

  let config: PhionConfig | null = null
  let toolbarEnabled = false
  let cachedToolbarCode: string | null = null
  let lastUpdateCheck = 0

  // Cache toolbar updates for 10 minutes
  const UPDATE_CACHE_DURATION = 0 // ✅ Disabled to force latest version

  // Check for toolbar updates
  async function checkForUpdates(): Promise<UpdateCheckResponse | null> {
    if (!autoUpdate || Date.now() - lastUpdateCheck < UPDATE_CACHE_DURATION) {
      return null
    }

    try {
      const channel = config?.toolbar?.updateChannel || "stable"
      const response = await fetch(`${updateEndpoint}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentVersion: PLUGIN_VERSION,
          channel,
          projectId: config?.projectId,
        }),
      })

      if (response.ok) {
        lastUpdateCheck = Date.now()
        return await response.json()
      }
    } catch (error) {
      if (config?.debug) {
        console.warn("[phion-plugin] Update check failed:", error)
      }
    }

    return null
  }

  // Download and cache toolbar update
  async function downloadToolbarUpdate(version: ToolbarVersion): Promise<string | null> {
    try {
      const response = await fetch(version.url)
      if (response.ok) {
        const code = await response.text()

        // Basic checksum validation (simple for now)
        if (version.checksum) {
          const actualChecksum = Buffer.from(code).toString("base64").slice(0, 8)
          if (actualChecksum !== version.checksum.slice(0, 8)) {
            console.warn("[phion-plugin] Checksum mismatch, using local version")
            return null
          }
        }

        cachedToolbarCode = code
        console.log(`[phion-plugin] Updated to toolbar version ${version.version}`)
        return code
      }
    } catch (error) {
      console.warn("[phion-plugin] Failed to download toolbar update:", error)
    }

    return null
  }

  return {
    name: "vite-plugin-phion",

    configResolved(resolvedConfig) {
      // Read phion config
      const configFilePath = resolve(resolvedConfig.root, configPath)
      console.log(`[Phion] Looking for config at: ${configFilePath}`)

      if (existsSync(configFilePath)) {
        try {
          const configContent = readFileSync(configFilePath, "utf-8")
          config = JSON.parse(configContent)

          console.log(`[Phion] Config loaded:`, {
            projectId: config?.projectId,
            wsUrl: config?.wsUrl,
            toolbarEnabled: config?.toolbar?.enabled,
          })

          // Check if toolbar is enabled
          toolbarEnabled =
            config?.toolbar?.enabled !== false && process.env.PHION_TOOLBAR !== "false"

          console.log(`[Phion] Toolbar enabled: ${toolbarEnabled}`)
        } catch (error) {
          console.warn("[phion-plugin] Failed to read config:", error)
        }
      } else {
        console.log(`[Phion] Config file not found at: ${configFilePath}`)
      }
    },

    configureServer(server) {
      if (!toolbarEnabled || !config) return

      // Serve the toolbar configuration
      server.middlewares.use("/phion/config.js", (req, res, next) => {
        try {
          // Simply use the existing config
          // (config was already read in configResolved hook)
          const toolbarConfig = {
            projectId: config?.projectId || "",
            websocketUrl: config?.wsUrl || websocketUrl, // ✅ Всегда из конфига в первую очередь
            position: config?.toolbar?.position || "top",
            version: PLUGIN_VERSION,
            autoUpdate: config?.toolbar?.autoUpdate !== false,
            updateChannel: config?.toolbar?.updateChannel || "stable",
            debug: config?.debug || false,
          }

          if (config?.debug) {
            console.log(`[Phion] Creating toolbar config...`)
            console.log(`[Phion] Config object:`, config)
            console.log(`[Phion] Final toolbar config:`, toolbarConfig)
          }

          res.writeHead(200, { "Content-Type": "application/javascript" })
          res.end(`window.PHION_CONFIG = ${JSON.stringify(toolbarConfig)};`)
        } catch (err) {
          console.error("[Phion] Error serving config:", err)
          res.writeHead(500, { "Content-Type": "text/plain" })
          res.end("Error generating toolbar config")
        }
      })

      // Serve the toolbar bundle
      server.middlewares.use("/phion/toolbar.js", async (req, res, next) => {
        try {
          // Try to get the remote version first
          let toolbarCode = cachedToolbarCode

          try {
            // Check for updates if enabled
            if (config?.toolbar?.autoUpdate !== false) {
              const updateCheck = await checkForUpdates()
              if (updateCheck?.hasUpdate && updateCheck.latestVersion) {
                if (config?.debug) {
                  console.log(`[Phion] Using latest toolbar from ${updateCheck.latestVersion.url}`)
                }
                const updatedCode = await downloadToolbarUpdate(updateCheck.latestVersion)
                if (updatedCode) {
                  toolbarCode = updatedCode
                }
              }
            }
          } catch (fetchError) {
            if (config?.debug) {
              console.log(
                `[Phion] Could not fetch remote toolbar: ${
                  fetchError instanceof Error ? fetchError.message : String(fetchError)
                }`,
              )
            }
          }

          // Fallback to local version
          if (!toolbarCode) {
            const toolbarPath = findToolbarBundle()
            if (toolbarPath) {
              if (config?.debug) {
                console.log(`[Phion] Using local toolbar from ${toolbarPath}`)
              }
              toolbarCode = readFileSync(toolbarPath, "utf-8")
            }
          }

          if (toolbarCode) {
            res.writeHead(200, { "Content-Type": "application/javascript" })
            res.end(toolbarCode)
          } else {
            console.error("[Phion] Toolbar bundle not found")
            res.writeHead(404, { "Content-Type": "text/plain" })
            res.end("Toolbar bundle not found")
          }
        } catch (err) {
          console.error("[Phion] Error serving toolbar:", err)
          res.writeHead(500, { "Content-Type": "text/plain" })
          res.end("Error loading toolbar")
        }
      })

      // API endpoint for manual update check
      server.middlewares.use("/phion/api/update-check", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405
          res.end("Method not allowed")
          return
        }

        try {
          const updateCheck = await checkForUpdates()
          res.setHeader("Content-Type", "application/json")
          res.end(
            JSON.stringify(updateCheck || { hasUpdate: false, currentVersion: PLUGIN_VERSION }),
          )
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: "Update check failed" }))
        }
      })
    },

    transformIndexHtml(html) {
      if (!toolbarEnabled || !config) return html

      // Add cache busting timestamp
      const timestamp = Date.now()

      // Inject toolbar scripts
      const toolbarScript = `
        <script src="/phion/config.js?v=${timestamp}"></script>
        <script src="/phion/toolbar.js?v=${timestamp}"></script>
      `

      // Insert before closing body tag
      return html.replace("</body>", `${toolbarScript}</body>`)
    },
  }
}

export default phionPlugin
export type { PhionConfig, PhionPluginOptions, ToolbarVersion, UpdateCheckResponse } from "./types"
