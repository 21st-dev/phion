import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";

export function vybcelPlugin(options = {}) {
  const { configPath = "vybcel.config.json" } = options;

  let config = null;
  let toolbarEnabled = false;

  return {
    name: "vite-plugin-vybcel",

    configResolved(resolvedConfig) {
      // Read vybcel config
      const configFilePath = resolve(resolvedConfig.root, configPath);

      if (existsSync(configFilePath)) {
        try {
          const configContent = readFileSync(configFilePath, "utf-8");
          config = JSON.parse(configContent);

          // Check if toolbar is enabled
          toolbarEnabled =
            config?.toolbar?.enabled !== false &&
            process.env.VYBCEL_TOOLBAR !== "false";
        } catch (error) {
          console.warn("[vybcel-plugin] Failed to read config:", error);
        }
      }
    },

    configureServer(server) {
      if (!toolbarEnabled || !config) return;

      // Serve toolbar bundle
      server.middlewares.use("/vybcel/toolbar.js", (req, res, next) => {
        try {
          // Inline toolbar code
          const toolbarCode = `
(function() {
  // Vybcel Toolbar - Inline Version
  
  // WebSocket Client
  class ToolbarWebSocketClient {
    constructor(projectId, websocketUrl) {
      this.projectId = projectId
      this.websocketUrl = websocketUrl
      this.socket = null
      this.listeners = new Map()
      this.state = {
        pendingChanges: 0,
        deployStatus: 'ready',
        agentConnected: false,
        netlifyUrl: undefined
      }
    }

    async connect() {
      return new Promise((resolve) => {
        // Use socket.io from CDN
        if (!window.io) {
          const script = document.createElement('script')
          script.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js'
          script.onload = () => this.connectSocket(resolve)
          document.head.appendChild(script)
        } else {
          this.connectSocket(resolve)
        }
      })
    }

    connectSocket(resolve) {
      this.socket = window.io(this.websocketUrl, {
        transports: ['websocket'],
        timeout: 5000
      })

      this.socket.on('connect', () => {
        console.log('[Vybcel Toolbar] Connected to WebSocket server')
        this.authenticate()
      })

      this.socket.on('authenticated', (data) => {
        if (data.success) {
          console.log('[Vybcel Toolbar] Authenticated successfully')
          this.setupEventListeners()
          this.requestStatus()
          resolve(true)
        } else {
          console.error('[Vybcel Toolbar] Authentication failed')
          resolve(false)
        }
      })

      this.socket.on('connect_error', (error) => {
        console.error('[Vybcel Toolbar] Connection error:', error)
        resolve(false)
      })
    }

    authenticate() {
      if (this.socket) {
        this.socket.emit('authenticate', {
          projectId: this.projectId,
          clientType: 'toolbar'
        })
      }
    }

    setupEventListeners() {
      if (!this.socket) return

      this.socket.on('file_change_staged', (data) => {
        this.state.pendingChanges += 1
        this.emit('stateChange', this.state)
      })

      this.socket.on('commit_created', (data) => {
        this.state.pendingChanges = 0
        this.emit('stateChange', this.state)
      })

      this.socket.on('deploy_status_update', (data) => {
        this.state.deployStatus = data.status
        if (data.url) {
          this.state.netlifyUrl = data.url
        }
        this.emit('stateChange', this.state)
      })

      this.socket.on('save_success', () => {
        this.state.pendingChanges = 0
        this.emit('stateChange', this.state)
      })

      this.socket.on('discard_success', () => {
        this.state.pendingChanges = 0
        this.emit('stateChange', this.state)
      })

      this.socket.on('toolbar_status', (status) => {
        this.state = { ...this.state, ...status }
        this.emit('stateChange', this.state)
      })

      this.socket.on('agent_connected', () => {
        this.state.agentConnected = true
        this.emit('stateChange', this.state)
      })

      this.socket.on('agent_disconnected', () => {
        this.state.agentConnected = false
        this.emit('stateChange', this.state)
      })
    }

    requestStatus() {
      if (this.socket) {
        this.socket.emit('toolbar_get_status')
      }
    }

    saveAll() {
      if (this.socket) {
        this.socket.emit('save_all_changes')
      }
    }

    discardAll() {
      if (this.socket) {
        this.socket.emit('discard_all_changes')
      }
    }

    openPreview() {
      if (this.state.netlifyUrl) {
        window.open(this.state.netlifyUrl, '_blank')
      }
    }

    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, [])
      }
      this.listeners.get(event).push(callback)
    }

    emit(event, data) {
      const eventListeners = this.listeners.get(event)
      if (eventListeners) {
        eventListeners.forEach(callback => callback(data))
      }
    }
  }

  // Toolbar Component
  function createToolbar(projectId, websocketUrl, position) {
    const client = new ToolbarWebSocketClient(projectId, websocketUrl)
    let state = {
      pendingChanges: 0,
      deployStatus: 'ready',
      agentConnected: false,
      netlifyUrl: undefined
    }
    let isConnected = false
    let isLoading = false
    
    // Get project name from package.json or use default
    let projectName = 'Project'
    
    // Try to get project name from package.json
    const getProjectName = async () => {
      try {
        const response = await fetch('/package.json')
        if (response.ok) {
          const packageJson = await response.json()
          return packageJson.name || 'Project'
        }
      } catch (e) {
        // Ignore fetch errors
      }
      
      // Fallback: try to get from document title
      let fallbackName = document.title.replace(' - Vite + React + TS', '').replace('Vybcel Project', '').trim()
      if (fallbackName === 'Vite + React + TS' || fallbackName === '') {
        fallbackName = 'Project'
      }
      return fallbackName
    }

    // Create main wrapper for the entire page
    const wrapper = document.createElement('div')
    wrapper.className = 'vybcel-wrapper'
    wrapper.style.cssText = \`
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 999998;
      background-color: #000000;
      padding: 4px;
      display: flex;
      flex-direction: column;
    \`

    // Create toolbar element
    const toolbar = document.createElement('div')
    toolbar.className = 'vybcel-toolbar'
    toolbar.style.cssText = \`
      background-color: transparent;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      flex-shrink: 0;
    \`

    // Create content wrapper for the dev server
    const contentWrapper = document.createElement('div')
    contentWrapper.className = 'vybcel-content'
    contentWrapper.style.cssText = \`
      flex: 1;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: auto;
      position: relative;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    \`

    // Function to move content properly
    function moveContent() {
      setTimeout(() => {
        // Get all existing body content except our wrapper
        const existingContent = Array.from(document.body.children).filter(
          (child) => child.className !== 'vybcel-wrapper'
        )

        // Move all existing content to the content wrapper
        existingContent.forEach((child) => {
          contentWrapper.appendChild(child)
        })

        // If there's a #root element but it's empty, wait a bit more for React
        const rootElement = contentWrapper.querySelector('#root')
        if (rootElement && rootElement.children.length === 0) {
          setTimeout(() => {
            // Check if React has mounted anything
            if (rootElement.children.length === 0) {
              console.log('[Vybcel] React app may not have mounted yet')
            }
          }, 1000)
        }
      }, 100)
    }

    function updateToolbar() {
      const getDeployStatusColor = () => {
        switch (state.deployStatus) {
          case 'ready': return '#10b981'
          case 'building': return '#f59e0b'
          case 'failed': return '#ef4444'
          case 'pending': return '#6b7280'
          default: return '#6b7280'
        }
      }

      const getDeployStatusText = () => {
        switch (state.deployStatus) {
          case 'ready': return 'Ready'
          case 'building': return 'Building...'
          case 'failed': return 'Failed'
          case 'pending': return 'Pending'
          default: return 'Unknown'
        }
      }

      toolbar.innerHTML = \`
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 6px; color: white; font-weight: 500;">
            \${projectName}
          </div>
          \${state.pendingChanges > 0 ? \`
            <div style="
              background-color: rgba(251, 191, 36, 0.15);
              color: #fbbf24;
              border: 1px solid rgba(251, 191, 36, 0.3);
              padding: 2px 8px;
              border-radius: 6px;
              font-size: 11px;
              font-weight: 500;
              backdrop-filter: blur(8px);
            ">
              \${state.pendingChanges} unsaved
            </div>
          \` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="vybcel-save" style="
            background-color: \${state.pendingChanges > 0 ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)'};
            color: \${state.pendingChanges > 0 ? '#ffffff' : 'rgba(255, 255, 255, 0.5)'};
            border: \${state.pendingChanges > 0 ? 'none' : '1px solid rgba(255, 255, 255, 0.2)'};
            border-radius: 6px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 500;
            cursor: \${state.pendingChanges > 0 ? 'pointer' : 'not-allowed'};
            transition: all 0.2s;
            box-shadow: \${state.pendingChanges > 0 ? '0 1px 2px rgba(0, 0, 0, 0.1)' : 'none'};
          ">
            \${isLoading ? 'Saving...' : 'Save All'}
          </button>
          <button id="vybcel-discard" style="
            background-color: rgba(255, 255, 255, 0.1);
            color: \${state.pendingChanges > 0 ? '#ef4444' : 'rgba(255, 255, 255, 0.5)'};
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 500;
            cursor: \${state.pendingChanges > 0 ? 'pointer' : 'not-allowed'};
            transition: all 0.2s;
          ">
            Discard All
          </button>
          <button id="vybcel-preview" style="
            background-color: rgba(255, 255, 255, 0.1);
            color: \${state.netlifyUrl ? '#ffffff' : 'rgba(255, 255, 255, 0.5)'};
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 500;
            cursor: \${state.netlifyUrl ? 'pointer' : 'not-allowed'};
            transition: all 0.2s;
          ">
            Preview
          </button>
        </div>
      \`

      // Add event listeners
      const saveBtn = toolbar.querySelector('#vybcel-save')
      const discardBtn = toolbar.querySelector('#vybcel-discard')
      const previewBtn = toolbar.querySelector('#vybcel-preview')

      saveBtn.onclick = () => {
        if (state.pendingChanges > 0 && !isLoading) {
          isLoading = true
          updateToolbar()
          client.saveAll()
        }
      }

      discardBtn.onclick = () => {
        if (state.pendingChanges > 0 && !isLoading) {
          isLoading = true
          updateToolbar()
          client.discardAll()
        }
      }

      previewBtn.onclick = () => {
        client.openPreview()
      }
    }

    // Initialize
    client.connect().then(async connected => {
      if (connected) {
        isConnected = true
        
        // Get project name and update toolbar
        projectName = await getProjectName()
        updateToolbar()
        
        client.on('stateChange', (newState) => {
          state = newState
          isLoading = false
          updateToolbar()
        })

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
          if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            switch (e.key) {
              case 'S':
                e.preventDefault()
                saveBtn.click()
                break
              case 'D':
                e.preventDefault()
                discardBtn.click()
                break
              case 'P':
                e.preventDefault()
                previewBtn.click()
                break
            }
          }
        })

        // Assemble the wrapper first
        wrapper.appendChild(toolbar)
        wrapper.appendChild(contentWrapper)
        document.body.appendChild(wrapper)

        // Reset body styles to prevent conflicts
        document.body.style.margin = '0'
        document.body.style.padding = '0'
        document.body.style.overflow = 'hidden'

        // Move content after wrapper is in place
        moveContent()
      }
    })
  }

  // Initialize when DOM is ready
  function initializeToolbar() {
    if (!window.VYBCEL_CONFIG) {
      console.error('[Vybcel Toolbar] Configuration not found')
      return
    }

    const { projectId, websocketUrl, position } = window.VYBCEL_CONFIG
    createToolbar(projectId, websocketUrl, position)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeToolbar)
  } else {
    initializeToolbar()
  }
})();
          `;

          res.setHeader("Content-Type", "application/javascript");
          res.end(toolbarCode);
        } catch (error) {
          next(error);
        }
      });

      // Serve toolbar config
      server.middlewares.use("/vybcel/config.js", (req, res) => {
        try {
          const toolbarConfig = {
            projectId: config.projectId,
            websocketUrl: config.wsUrl || "ws://localhost:8080", // Используем wsUrl из конфигурации
            position: config.toolbar?.position || "top",
          };

          const configScript = `window.VYBCEL_CONFIG = ${JSON.stringify(
            toolbarConfig
          )};`;

          res.setHeader("Content-Type", "application/javascript");
          res.setHeader(
            "Content-Length",
            Buffer.byteLength(configScript, "utf8")
          );
          res.statusCode = 200;
          res.end(configScript);
        } catch (error) {
          console.error("[vybcel-plugin] Error serving config:", error);
          res.statusCode = 500;
          res.end('console.error("[Vybcel] Failed to load config");');
        }
      });
    },

    transformIndexHtml(html) {
      if (!toolbarEnabled || !config) return html;

      // Inject toolbar scripts
      const toolbarScript = `
        <script src="/vybcel/config.js"></script>
        <script src="/vybcel/toolbar.js"></script>
      `;

      // Insert before closing body tag
      return html.replace("</body>", `${toolbarScript}</body>`);
    },
  };
}
