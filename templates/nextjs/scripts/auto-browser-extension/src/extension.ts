import * as fs from "fs"
import * as http from "http"
import * as path from "path"
import * as vscode from "vscode"
import { startCDPRelayServer } from "./utils/cdp-relay.js"
import { dispatchAgentCall } from "./utils/dispatch-agent-call"
import { initializeDiagnosticCollection } from "./utils/inject-prompt-diagnostic-with-callback"
import { PhionWebSocketClient } from "./utils/websocket-client"

// Default ports for different project types
const DEFAULT_VITE_PORT = 5173
const DEFAULT_NEXTJS_PORT = 3000

// Flag to track auto-open state
let hasAutoOpened = false
let serverCheckInterval: NodeJS.Timeout | null = null

// CDP Bridge server state
let cdpBridgeServer: any = null
let cdpBridgePort = 9223
let consoleLogsChannel: vscode.OutputChannel | null = null
let simpleBrowserOpen = false

// WebSocket client for runtime errors
let phionWebSocketClient: PhionWebSocketClient | null = null

// Persistent storage key for browser opened state
const BROWSER_OPENED_KEY = "phion-browser-opened"

// Config interface (same as CLI)
interface PhionConfig {
  projectId: string
  wsUrl: string
  templateType?: "vite" | "nextjs"
  devPort?: number
  debug?: boolean
  toolbar?: {
    enabled?: boolean
    position?: "top" | "bottom"
    autoOpen?: boolean
  }
}

// Global config storage
let phionConfig: PhionConfig | null = null

// Function to check persistent browser opened state
function isPersistentBrowserOpened(context) {
  const timestamp = context.globalState.get(BROWSER_OPENED_KEY, 0)
  const now = Date.now()
  const thirtyMinutes = 30 * 60 * 1000 // 30 minutes in ms

  // Reset flag if it's older than 30 minutes (new session)
  if (now - timestamp > thirtyMinutes) {
    context.globalState.update(BROWSER_OPENED_KEY, 0)
    return false
  }

  return timestamp > 0
}

// Function to mark browser as opened persistently
function markPersistentBrowserOpened(context) {
  hasAutoOpened = true
  context.globalState.update(BROWSER_OPENED_KEY, Date.now())
}

let AUTO_START_NEW_PROJECT = false
let AUTO_OPTIMIZE_WORKSPACE = true

function updateConfigSettings() {
  try {
    // Load config using the new function
    phionConfig = loadConfig()

    if (phionConfig) {
      // Extract settings from config (these are extension-specific settings)
      const workspaceFolders = vscode.workspace.workspaceFolders
      if (!workspaceFolders || workspaceFolders.length === 0) return

      const rootPath = workspaceFolders[0].uri.fsPath
      const configPath = path.join(rootPath, "phion.config.json")

      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"))
        AUTO_START_NEW_PROJECT = config?.autoStartOnNewProject === true
        AUTO_OPTIMIZE_WORKSPACE = config?.autoOptimizeWorkspace !== false // Default true
      }
    }
  } catch (error) {
    // Ignore errors, keep defaults
  }
}

/**
 * Check if project has been started before in this workspace
 */
function hasProjectBeenStarted(context) {
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (!workspaceFolders || workspaceFolders.length === 0) return true

  const workspaceId = workspaceFolders[0].uri.fsPath
  const startedProjects = context.globalState.get("phionStartedProjects", [])

  return startedProjects.includes(workspaceId)
}

/**
 * Mark project as started
 */
function markProjectAsStarted(context) {
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (!workspaceFolders || workspaceFolders.length === 0) return

  const workspaceId = workspaceFolders[0].uri.fsPath
  const startedProjects = context.globalState.get("phionStartedProjects", [])

  if (!startedProjects.includes(workspaceId)) {
    startedProjects.push(workspaceId)
    context.globalState.update("phionStartedProjects", startedProjects)
  }
}

/**
 * Detect project type based on config and files
 */
function detectProjectType(): "vite" | "nextjs" {
  try {
    // First check phion.config.json
    if (phionConfig && phionConfig.templateType) {
      return phionConfig.templateType
    }

    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) return "vite"

    const rootPath = workspaceFolders[0].uri.fsPath

    // Check for Next.js specific files
    const nextConfigPath = path.join(rootPath, "next.config.js")
    const nextConfigTsPath = path.join(rootPath, "next.config.ts")

    if (fs.existsSync(nextConfigPath) || fs.existsSync(nextConfigTsPath)) {
      return "nextjs"
    }

    // Check package.json for Next.js dependency
    const packageJsonPath = path.join(rootPath, "package.json")
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
        if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
          return "nextjs"
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    return "vite"
  } catch (error) {
    console.error("Error detecting project type:", error)
    return "vite"
  }
}

/**
 * Get development server port based on project type
 */
function getDevServerPort(): number {
  // Check if port is specified in config
  if (phionConfig && phionConfig.devPort) {
    return phionConfig.devPort
  }

  const projectType = detectProjectType()
  return projectType === "nextjs" ? DEFAULT_NEXTJS_PORT : DEFAULT_VITE_PORT
}

/**
 * Check if website is running on the appropriate port
 */
function checkWebsiteServer() {
  const port = getDevServerPort()

  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: port,
        method: "GET",
        path: "/",
        timeout: 3000,
      },
      (res) => {
        resolve(true)
      },
    )

    req.on("error", () => {
      resolve(false)
    })

    req.on("timeout", () => {
      req.destroy()
      resolve(false)
    })

    req.end()
  })
}

/**
 * Auto-detect server startup and open browser
 */
async function autoDetectAndOpen(context) {
  if (hasAutoOpened || isPersistentBrowserOpened(context)) return

  const isServerActive = await checkWebsiteServer()

  if (isServerActive) {
    markPersistentBrowserOpened(context)

    // Stop checking
    if (serverCheckInterval) {
      clearInterval(serverCheckInterval)
      serverCheckInterval = null
    }

    // Small delay for server stabilization
    setTimeout(async () => {
      await openPreview()
    }, 2000)
  }
}

/**
 * Start server monitoring
 */
function startServerMonitoring(context) {
  const projectType = detectProjectType()
  const port = getDevServerPort()

  console.log(`🔍 Monitoring for ${projectType} server startup on port ${port}...`)

  // Check every 2 seconds
  serverCheckInterval = setInterval(() => autoDetectAndOpen(context), 2000)

  // Stop after 60 seconds if server not found
  setTimeout(() => {
    if (serverCheckInterval && !hasAutoOpened) {
      clearInterval(serverCheckInterval)
      serverCheckInterval = null
      console.log("⏰ Server monitoring timeout - no server detected")
    }
  }, 60000)
}

/**
 * Start project with setup script command
 */
async function startProject(context, isAutoStart = false) {
  try {
    // Check if we're in the right project folder
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) {
      vscode.window.showErrorMessage(
        "No workspace folder found. Please open your project folder first.",
      )
      return
    }

    // Reset auto-open flags
    hasAutoOpened = false
    context.globalState.update(BROWSER_OPENED_KEY, 0)

    const terminal = vscode.window.createTerminal({
      name: "Project Server",
      cwd: workspaceFolders[0].uri.fsPath,
    })

    // Show terminal and run command
    terminal.show()

    // Determine project type and run appropriate command
    const projectType = detectProjectType()
    const isWindows = process.platform === "win32"

    if (projectType === "nextjs") {
      // For Next.js projects, use pnpm phion:start command
      terminal.sendText("pnpm phion:start")
    } else {
      // For Vite projects, use setup script
      if (isWindows) {
        terminal.sendText("setup.bat")
      } else {
        terminal.sendText("chmod +x setup.sh && ./setup.sh")
      }
    }

    // Mark project as started
    if (context) {
      markProjectAsStarted(context)
    }

    // Start server monitoring
    startServerMonitoring(context)

    // Show notification
    const message = isAutoStart ? "🚀 Auto-starting your project..." : "🚀 Starting your project..."

    vscode.window.showInformationMessage(message)
  } catch (error: any) {
    console.error("Failed to start project:", error)
    vscode.window.showErrorMessage(`Could not start project: ${error.message}`)
  }
}

/**
 * Open Simple Browser for website preview
 */
async function openPreview() {
  const port = getDevServerPort()
  const url = `http://localhost:${port}`

  try {
    // First check if server is active
    const isServerActive = await checkWebsiteServer()

    if (!isServerActive) {
      vscode.window.showWarningMessage(`Your website is not running. Run the setup script first.`)
      return false
    }

    // Open Simple Browser
    await vscode.commands.executeCommand("simpleBrowser.show", url)
    console.log(`🌐 Opened preview: ${url}`)

    // Set simple browser as open and update context
    simpleBrowserOpen = true
    vscode.commands.executeCommand("setContext", "phion.simpleBrowserOpen", true)

    // Auto-optimize workspace (if enabled)
    if (AUTO_OPTIMIZE_WORKSPACE) {
      setTimeout(async () => {
        try {
          // 1. Close sidebar (Explorer)
          await vscode.commands.executeCommand("workbench.action.closeSidebar")

          // 2. Close terminal
          await vscode.commands.executeCommand("workbench.action.closePanel")

          // 3. Open AI chat (using correct Cursor commands)
          await vscode.commands.executeCommand("composer.startComposerPrompt")

          console.log("✨ Workspace optimized for development")
        } catch (error) {
          // Don't show error to user, it's not critical
        }
      }, 1500) // Small delay for stability
    }

    // Show notification
    vscode.window.showInformationMessage(`🚀 Website preview opened: ${url}`, "Hide")

    return true
  } catch (error) {
    console.error("Failed to open preview:", error)

    // Fallback: show notification with instruction
    const action = await vscode.window.showWarningMessage(
      `Could not open preview. Try again?`,
      "Copy URL",
      "Try Again",
    )

    if (action === "Copy URL") {
      await vscode.env.clipboard.writeText(url)
      vscode.window.showInformationMessage("URL copied to clipboard")
    } else if (action === "Try Again") {
      return await openPreview()
    }

    return false
  }
}

/**
 * Start CDP Bridge Server for Chrome extension integration
 */
async function startCDPBridge() {
  if (cdpBridgeServer) {
    console.log("🔗 CDP Bridge server already running")
    return
  }

  try {
    const httpServer = http.createServer()
    await new Promise<void>((resolve) => httpServer.listen(cdpBridgePort, resolve))

    const { cdpEndpoint, server } = await startCDPRelayServer(httpServer)
    cdpBridgeServer = { httpServer, cdpEndpoint, server }

    // Create output channel for console logs
    if (!consoleLogsChannel) {
      consoleLogsChannel = vscode.window.createOutputChannel("Browser Console Logs")
    }

    // Set up console log handling
    server.setConsoleLogCallback(async (logData: any) => {
      if (consoleLogsChannel) {
        const timestamp = new Date().toISOString()
        const level = logData.type || "log"
        const args = logData.args || []

        // Format console message
        const message = args.map(JSON.stringify).join(" ")

        consoleLogsChannel.appendLine(`[${timestamp}] ${level.toUpperCase()}: ${message}`)

        // Call dispatchAgentCall on error messages
        if (level === "error") {
          try {
            await dispatchAgentCall({
              prompt: `Fix this console error: ${message}`,
              mode: "agent",
            })
          } catch (error) {
            console.error("Failed to dispatch agent call for error:", error)
          }
        }
      }
    })

    console.log(`🔗 CDP Bridge server started on port ${cdpBridgePort}`)
  } catch (error: any) {
    console.error("Failed to start CDP bridge server:", error)
    vscode.window.showErrorMessage(`Could not start CDP bridge: ${error.message}`)
  }
}

/**
 * Stop CDP Bridge Server
 */
async function stopCDPBridge() {
  if (!cdpBridgeServer) return

  try {
    cdpBridgeServer.httpServer.close()
    cdpBridgeServer = null

    if (consoleLogsChannel) {
      consoleLogsChannel.dispose()
      consoleLogsChannel = null
    }

    console.log("🔗 CDP Bridge server stopped")
  } catch (error: any) {
    console.error("Error stopping CDP bridge server:", error)
  }
}

/**
 * Load configuration from phion.config.json (same logic as CLI)
 */
function loadConfig(): PhionConfig | null {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) {
      console.log("[Phion VSCode] 📁 No workspace folders found")
      return null
    }

    const rootPath = workspaceFolders[0].uri.fsPath
    const configPath = path.join(rootPath, "phion.config.json")

    console.log(`[Phion VSCode] 🔍 Looking for config at: ${configPath}`)

    if (fs.existsSync(configPath)) {
      try {
        console.log("[Phion VSCode] ✅ Found phion.config.json")
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"))
        console.log("[Phion VSCode] 📋 Config contents:", config)

        const phionConfig: PhionConfig = {
          projectId: config.projectId,
          wsUrl: config.wsUrl || process.env.PHION_WS_URL || "ws://localhost:8080",
          templateType: config.templateType || "vite",
          devPort: config.devPort,
          debug: config.debug || false,
          toolbar: config.toolbar || {
            enabled: true,
            position: "top",
            autoOpen: true,
          },
        }

        if (!phionConfig.projectId || phionConfig.projectId === "__PROJECT_ID__") {
          console.log("[Phion VSCode] ❌ Missing or invalid project ID in config")
          return null
        }

        return phionConfig
      } catch (error) {
        console.error("[Phion VSCode] ❌ Error parsing phion.config.json:", error)
        return null
      }
    } else {
      console.log("[Phion VSCode] ⚠️ phion.config.json not found")
      return null
    }
  } catch (error) {
    console.error("[Phion VSCode] ❌ Error loading config:", error)
    return null
  }
}

/**
 * Connect to websocket for runtime error monitoring
 */
async function connectRuntimeErrorMonitoring() {
  console.log("[Phion VSCode] 🔍 Starting runtime error monitoring setup...")

  // Load config if not already loaded
  if (!phionConfig) {
    phionConfig = loadConfig()
  }

  if (!phionConfig) {
    console.log("[Phion VSCode] ⚠️ No valid config found, skipping runtime error monitoring")
    return
  }

  console.log(`[Phion VSCode] 📋 Found project ID: ${phionConfig.projectId}`)

  try {
    if (!phionWebSocketClient) {
      console.log("[Phion VSCode] 🆕 Creating new WebSocket client for runtime errors")
      // Use WebSocket URL from config without modification
      console.log(`[Phion VSCode] 📋 Using WebSocket URL: ${phionConfig.wsUrl}`)
      phionWebSocketClient = new PhionWebSocketClient(phionConfig.wsUrl)
    }

    console.log("[Phion VSCode] 🔌 Attempting to connect to WebSocket server...")
    const connected = await phionWebSocketClient.connect(phionConfig.projectId)
    if (connected) {
      console.log(
        `[Phion VSCode] ✅ Connected to runtime error monitoring for project: ${phionConfig.projectId}`,
      )
    } else {
      console.log("[Phion VSCode] ❌ Failed to connect to runtime error monitoring")
    }
  } catch (error) {
    console.error("[Phion VSCode] ❌ Error connecting to runtime error monitoring:", error)
  }
}

/**
 * Show runtime errors output channel
 */
function showRuntimeErrors() {
  if (phionWebSocketClient) {
    phionWebSocketClient.showOutputChannel()
  } else {
    vscode.window.showInformationMessage(
      "Runtime error monitoring not available. Make sure the project is running.",
    )
  }
}

/**
 * Check if this is a Phion project
 */
function isPhionProject() {
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (!workspaceFolders) return false

  const rootPath = workspaceFolders[0].uri.fsPath
  const phionConfigPath = path.join(rootPath, "phion.config.json")
  const packageJsonPath = path.join(rootPath, "package.json")

  // Check for phion.config.json or phion in package.json
  if (fs.existsSync(phionConfigPath)) {
    return true
  }

  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
      return !!(packageJson.dependencies?.phion || packageJson.devDependencies?.phion)
    } catch (error) {
      return false
    }
  }

  return false
}

/**
 * Extension activation
 */
function activate(context) {
  updateConfigSettings()
  console.log("🚀 Phion extension activated")

  // Initialize diagnostic collection for prompt injection
  const diagnosticCollection = initializeDiagnosticCollection()
  context.subscriptions.push(diagnosticCollection) // Dispose on deactivation

  // Track tab changes to detect Simple Browser state
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    const isSimpleBrowser = editor && editor.document.uri.scheme === "simple-browser"
    simpleBrowserOpen = isSimpleBrowser || false
    vscode.commands.executeCommand("setContext", "phion.simpleBrowserOpen", isSimpleBrowser)
  })

  // Track tab closures
  vscode.workspace.onDidCloseTextDocument((document) => {
    if (document.uri.scheme === "simple-browser") {
      // Check if any simple browser tabs are still open
      const hasSimpleBrowser = vscode.window.visibleTextEditors.some(
        (editor) => editor.document.uri.scheme === "simple-browser",
      )
      simpleBrowserOpen = hasSimpleBrowser
      vscode.commands.executeCommand("setContext", "phion.simpleBrowserOpen", hasSimpleBrowser)
    }
  })

  // Check if this is a Phion project and start monitoring
  if (isPhionProject()) {
    // Connect to runtime error monitoring
    setTimeout(() => {
      connectRuntimeErrorMonitoring()
    }, 2000)

    // First check if server is already running
    checkWebsiteServer().then((isServerActive) => {
      if (isServerActive && !hasAutoOpened && !isPersistentBrowserOpened(context)) {
        markPersistentBrowserOpened(context)
        setTimeout(async () => {
          await openPreview()
        }, 1000)
        return
      }

      // Check if we need to auto-start new project
      if (AUTO_START_NEW_PROJECT && !hasProjectBeenStarted(context)) {
        vscode.window.showInformationMessage("🎉 New Phion project detected! Auto-starting...")

        // Auto-start project with small delay
        setTimeout(() => {
          startProject(context, true)
        }, 2000)
      } else {
        // Just start server monitoring
        setTimeout(() => {
          startServerMonitoring(context)
        }, 3000)
      }
    })
  }

  // Register commands
  const startProjectCommand = vscode.commands.registerCommand("phion.startProject", () =>
    startProject(context, false),
  )

  const openPreviewCommand = vscode.commands.registerCommand("phion.openPreview", openPreview)

  const showRuntimeErrorsCommand = vscode.commands.registerCommand(
    "phion.showRuntimeErrors",
    showRuntimeErrors,
  )

  // AI Chat toggle command
  const toggleAiChatCommand = vscode.commands.registerCommand("phion.toggleAiChat", async () => {
    try {
      // Try to open AI chat first
      await vscode.commands.executeCommand("composer.startComposerPrompt")
    } catch (error) {
      // If opening fails, try to close
      try {
        await vscode.commands.executeCommand("composer.closeComposerTab")
      } catch (closeError) {
        vscode.window.showWarningMessage("Could not toggle AI chat")
      }
    }
  })

  // Add to subscriptions
  context.subscriptions.push(
    startProjectCommand,
    openPreviewCommand,
    showRuntimeErrorsCommand,
    toggleAiChatCommand,
  )
}

/**
 * Extension deactivation
 */
function deactivate() {
  if (serverCheckInterval) {
    clearInterval(serverCheckInterval)
    serverCheckInterval = null
  }

  // Clean up CDP bridge server
  if (cdpBridgeServer) {
    stopCDPBridge()
  }

  // Clean up websocket client
  if (phionWebSocketClient) {
    phionWebSocketClient.disconnect()
    phionWebSocketClient = null
  }

  console.log("👋 Phion extension deactivated")
}

export { activate, deactivate }
