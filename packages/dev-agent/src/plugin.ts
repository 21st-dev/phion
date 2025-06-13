import type { Plugin } from 'vite'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { VybcelConfig, VybcelPluginOptions, ToolbarVersion, UpdateCheckResponse } from './types'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Auto-sync version from package.json
const getPluginVersion = (): string => {
  try {
    const packageJsonPath = join(__dirname, '..', 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    return packageJson.version
  } catch (error) {
    console.warn('[Vybcel] Could not read version from package.json, using fallback')
    return '1.1.15' // Fallback version
  }
}

const PLUGIN_VERSION = getPluginVersion()
const DEFAULT_UPDATE_ENDPOINT = process.env.TOOLBAR_UPDATE_ENDPOINT || 'http://localhost:3004/api/toolbar'

// Find the toolbar bundle location (working in both dev and prod environments)
const findToolbarBundle = () => {
  // Using import.meta.url for ESM compatibility
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  
  // Try different potential locations
  const locations = [
    // Direct in dist/toolbar folder (new package structure)
    join(__dirname, 'toolbar', 'index.global.js'),
    // In node_modules
    join(dirname(dirname(__dirname)), 'dist', 'toolbar', 'index.global.js'),
    // One level up (when used as dependency)
    join(dirname(dirname(dirname(__dirname))), 'vybcel', 'dist', 'toolbar', 'index.global.js'),
  ]
  
  for (const location of locations) {
    if (existsSync(location)) {
      console.log(`[Vybcel] Found toolbar bundle at: ${location}`)
      return location
    }
  }
  
  console.warn('[Vybcel] Could not find toolbar bundle at any of these locations:', locations)
  return null
}

export function vybcelPlugin(options: VybcelPluginOptions = {}): Plugin {
  const {
    configPath = 'vybcel.config.json',
    websocketUrl = 'ws://localhost:8080',
    autoUpdate = true,
    updateEndpoint = DEFAULT_UPDATE_ENDPOINT
  } = options

  let config: VybcelConfig | null = null
  let toolbarEnabled = false
  let cachedToolbarCode: string | null = null
  let lastUpdateCheck = 0
  
  // Cache toolbar updates for 10 minutes
  const UPDATE_CACHE_DURATION = 0; // ✅ Disabled to force latest version

  // Check for toolbar updates
  async function checkForUpdates(): Promise<UpdateCheckResponse | null> {
    if (!autoUpdate || Date.now() - lastUpdateCheck < UPDATE_CACHE_DURATION) {
      return null
    }

    try {
      const channel = config?.toolbar?.updateChannel || 'stable'
      const response = await fetch(`${updateEndpoint}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentVersion: PLUGIN_VERSION,
          channel,
          projectId: config?.projectId
        })
      })

      if (response.ok) {
        lastUpdateCheck = Date.now()
        return await response.json()
      }
    } catch (error) {
      console.warn('[vybcel-plugin] Update check failed:', error)
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
        const actualChecksum = Buffer.from(code).toString('base64').slice(0, 8)
        if (actualChecksum !== version.checksum.slice(0, 8)) {
          console.warn('[vybcel-plugin] Checksum mismatch, using local version')
          return null
        }

        cachedToolbarCode = code
        console.log(`[vybcel-plugin] Updated to toolbar version ${version.version}`)
        return code
      }
    } catch (error) {
      console.warn('[vybcel-plugin] Failed to download toolbar update:', error)
    }

    return null
  }

  return {
    name: 'vite-plugin-vybcel',
    
    configResolved(resolvedConfig) {
      // Read vybcel config
      const configFilePath = resolve(resolvedConfig.root, configPath)
      
      if (existsSync(configFilePath)) {
        try {
          const configContent = readFileSync(configFilePath, 'utf-8')
          config = JSON.parse(configContent)
          
          // Check if toolbar is enabled
          toolbarEnabled = config?.toolbar?.enabled !== false && 
                          process.env.VYBCEL_TOOLBAR !== 'false'
        } catch (error) {
          console.warn('[vybcel-plugin] Failed to read config:', error)
        }
      }
    },

    configureServer(server) {
      if (!toolbarEnabled || !config) return

      // Serve the toolbar configuration
      server.middlewares.use('/vybcel/config.js', (req, res, next) => {
        try {
          // Simply use the existing config 
          // (config was already read in configResolved hook)
          const toolbarConfig = {
            projectId: config?.projectId || '',
            websocketUrl: websocketUrl || 'ws://localhost:8080',
            position: config?.toolbar?.position || 'top',
            version: PLUGIN_VERSION,
            autoUpdate: config?.toolbar?.autoUpdate !== false,
            updateChannel: config?.toolbar?.updateChannel || 'stable'
          }
          
          res.writeHead(200, { 'Content-Type': 'application/javascript' })
          res.end(`window.VYBCEL_CONFIG = ${JSON.stringify(toolbarConfig)};`)
        } catch (err) {
          console.error('[Vybcel] Error serving config:', err)
          res.writeHead(500, { 'Content-Type': 'text/plain' })
          res.end('Error generating toolbar config')
        }
      })

      // Serve the toolbar bundle
      server.middlewares.use('/vybcel/toolbar.js', async (req, res, next) => {
        try {
          // Try to get the remote version first
          let toolbarCode = cachedToolbarCode
          
          try {
            // Check for updates if enabled
            if (config?.toolbar?.autoUpdate !== false) {
              const updateCheck = await checkForUpdates()
              if (updateCheck?.hasUpdate && updateCheck.latestVersion) {
                console.log(`[Vybcel] Using latest toolbar from ${updateCheck.latestVersion.url}`)
                const updatedCode = await downloadToolbarUpdate(updateCheck.latestVersion)
                if (updatedCode) {
                  toolbarCode = updatedCode
                }
              }
            }
          } catch (fetchError) {
            console.log(`[Vybcel] Could not fetch remote toolbar: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`)
          }

          // Fallback to local version
          if (!toolbarCode) {
            const toolbarPath = findToolbarBundle()
            if (toolbarPath) {
              console.log(`[Vybcel] Using local toolbar from ${toolbarPath}`)
              toolbarCode = readFileSync(toolbarPath, 'utf-8')
            }
          }

          if (toolbarCode) {
            res.writeHead(200, { 'Content-Type': 'application/javascript' })
            res.end(toolbarCode)
          } else {
            console.error('[Vybcel] Toolbar bundle not found')
            res.writeHead(404, { 'Content-Type': 'text/plain' })
            res.end('Toolbar bundle not found')
          }
        } catch (err) {
          console.error('[Vybcel] Error serving toolbar:', err)
          res.writeHead(500, { 'Content-Type': 'text/plain' })
          res.end('Error loading toolbar')
        }
      })

      // API endpoint for manual update check
      server.middlewares.use('/vybcel/api/update-check', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        try {
          const updateCheck = await checkForUpdates()
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(updateCheck || { hasUpdate: false, currentVersion: PLUGIN_VERSION }))
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Update check failed' }))
        }
      })
    },

    transformIndexHtml(html) {
      if (!toolbarEnabled || !config) return html

      // Add cache busting timestamp
      const timestamp = Date.now()
      
      // Inject toolbar scripts
      const toolbarScript = `
        <script src="/vybcel/config.js?v=${timestamp}"></script>
        <script src="/vybcel/toolbar.js?v=${timestamp}"></script>
      `

      // Insert before closing body tag
      return html.replace('</body>', `${toolbarScript}</body>`)
    }
  }
}

export default vybcelPlugin
export type { VybcelConfig, VybcelPluginOptions, ToolbarVersion, UpdateCheckResponse } from './types' 