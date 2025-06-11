import type { Plugin } from 'vite'
import { readFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'
import type { VybcelConfig, VybcelPluginOptions } from './types'

export function vybcelPlugin(options: VybcelPluginOptions = {}): Plugin {
  const {
    configPath = 'vybcel.config.json',
    websocketUrl = 'ws://localhost:8080'
  } = options

  let config: VybcelConfig | null = null
  let toolbarEnabled = false

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

      // Serve toolbar bundle
      server.middlewares.use('/vybcel/toolbar.js', (req, res, next) => {
        try {
          const toolbarPath = join(__dirname, '../dist/toolbar/index.global.js')
          if (existsSync(toolbarPath)) {
            const toolbarCode = readFileSync(toolbarPath, 'utf-8')
            res.setHeader('Content-Type', 'application/javascript')
            res.end(toolbarCode)
          } else {
            res.statusCode = 404
            res.end('Toolbar bundle not found')
          }
        } catch (error) {
          next(error)
        }
      })

      // Serve toolbar config
      server.middlewares.use('/vybcel/config.js', (req, res) => {
        const toolbarConfig = {
          projectId: config!.projectId,
          websocketUrl,
          position: config!.toolbar?.position || 'top'
        }
        
        res.setHeader('Content-Type', 'application/javascript')
        res.end(`window.VYBCEL_CONFIG = ${JSON.stringify(toolbarConfig)};`)
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
export type { VybcelConfig, VybcelPluginOptions } from './types' 