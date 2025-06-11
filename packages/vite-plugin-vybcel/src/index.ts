import type { Plugin } from 'vite'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve, join } from 'path'
import type { VybcelConfig, VybcelPluginOptions, ToolbarVersion, UpdateCheckResponse } from './types'

// Current version of the plugin (should match package.json)
const PLUGIN_VERSION = '0.2.0'
const DEFAULT_UPDATE_ENDPOINT = process.env.TOOLBAR_UPDATE_ENDPOINT || 'http://localhost:3004/api/toolbar'

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
  const UPDATE_CACHE_DURATION = 10 * 60 * 1000

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

      // Serve toolbar bundle (with auto-update support)
      server.middlewares.use('/vybcel/toolbar.js', async (req, res, next) => {
        try {
          let toolbarCode = cachedToolbarCode

          // Check for updates if enabled
          if (config?.toolbar?.autoUpdate !== false) {
            const updateCheck = await checkForUpdates()
            if (updateCheck?.hasUpdate && updateCheck.latestVersion) {
              const updatedCode = await downloadToolbarUpdate(updateCheck.latestVersion)
              if (updatedCode) {
                toolbarCode = updatedCode
              }
            }
          }

          // Fallback to local version
          if (!toolbarCode) {
            const toolbarPath = join(__dirname, '../dist/toolbar/index.global.js')
            if (existsSync(toolbarPath)) {
              toolbarCode = readFileSync(toolbarPath, 'utf-8')
            }
          }

          if (toolbarCode) {
            res.setHeader('Content-Type', 'application/javascript')
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
            res.end(toolbarCode)
          } else {
            res.statusCode = 404
            res.end('Toolbar bundle not found')
          }
        } catch (error) {
          next(error)
        }
      })

      // Serve toolbar config (with version info)
      server.middlewares.use('/vybcel/config.js', (req, res) => {
        const toolbarConfig = {
          projectId: config!.projectId,
          websocketUrl,
          position: config!.toolbar?.position || 'top',
          version: PLUGIN_VERSION,
          autoUpdate: config!.toolbar?.autoUpdate !== false,
          updateChannel: config!.toolbar?.updateChannel || 'stable'
        }
        
        res.setHeader('Content-Type', 'application/javascript')
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
        res.end(`window.VYBCEL_CONFIG = ${JSON.stringify(toolbarConfig)};`)
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