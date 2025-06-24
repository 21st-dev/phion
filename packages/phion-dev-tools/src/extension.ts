import { exec } from "child_process"
import * as fs from "fs"
import * as http from "http"
import * as path from "path"
import { promisify } from "util"
import * as vscode from "vscode"
import { startCDPRelayServer } from "./utils/cdp-relay.js"
import { dispatchAgentCall } from "./utils/dispatch-agent-call"
import { initializeDiagnosticCollection } from "./utils/inject-prompt-diagnostic-with-callback"
import { PhionWebSocketClient } from "./utils/websocket-client"

const execAsync = promisify(exec)

// Default Vite port only
const DEFAULT_VITE_PORT = 5173

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
 * Check if website is running on port 5173
 */
function checkWebsiteServer() {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: DEFAULT_VITE_PORT,
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
 * Kill process using a specific port
 */
async function killProcessOnPort(port: number): Promise<boolean> {
  try {
    const platform = process.platform

    let command: string
    if (platform === "win32") {
      // Windows
      command = `netstat -ano | findstr :${port}`
    } else {
      // macOS/Linux
      command = `lsof -ti:${port}`
    }

    console.log(`🔍 Checking for processes on port ${port}...`)
    const { stdout } = await execAsync(command)

    if (!stdout.trim()) {
      console.log(`✅ No processes found on port ${port}`)
      return true
    }

    if (platform === "win32") {
      // Windows: Extract PID from netstat output
      const lines = stdout.trim().split("\n")
      const pids = lines
        .map((line) => {
          const parts = line.trim().split(/\s+/)
          return parts[parts.length - 1]
        })
        .filter((pid) => pid && pid !== "0")

      for (const pid of pids) {
        try {
          await execAsync(`taskkill /PID ${pid} /F`)
          console.log(`💀 Killed process ${pid} on port ${port}`)
        } catch (error) {
          console.warn(`⚠️ Could not kill process ${pid}:`, error)
        }
      }
    } else {
      // macOS/Linux: PIDs are directly in stdout
      const pids = stdout
        .trim()
        .split("\n")
        .filter((pid) => pid.trim())

      for (const pid of pids) {
        try {
          await execAsync(`kill -9 ${pid}`)
          console.log(`💀 Killed process ${pid} on port ${port}`)
        } catch (error) {
          console.warn(`⚠️ Could not kill process ${pid}:`, error)
        }
      }
    }

    // Wait a moment for processes to fully terminate
    await new Promise((resolve) => setTimeout(resolve, 1000))

    console.log(`✅ Port ${port} should now be available`)
    return true
  } catch (error) {
    console.log(`ℹ️ No processes found on port ${port} or error occurred:`, error)
    return true // Return true as port is likely available
  }
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
  console.log("🔍 Monitoring for Vite server startup...")

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

    // Kill any process using port 5173 before starting
    console.log(`🔍 Ensuring port ${DEFAULT_VITE_PORT} is available...`)
    await killProcessOnPort(DEFAULT_VITE_PORT)

    // First, run check-updates.js script, then start the project
    const checkUpdatesPath = path.join(
      workspaceFolders[0].uri.fsPath,
      "scripts",
      "check-updates.js",
    )

    if (fs.existsSync(checkUpdatesPath)) {
      // Run check-updates script followed by pnpm start
      terminal.sendText(`node "${checkUpdatesPath}" && pnpm start`)
    } else {
      // Just start the project with pnpm
      terminal.sendText("pnpm start")
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
  const url = `http://localhost:${DEFAULT_VITE_PORT}`

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

  // Auto-start project on activation if it's a Phion project
  const workspaceFolders = vscode.workspace.workspaceFolders

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

  if (workspaceFolders && isPhionProject()) {
    console.log("🚀 Phion project detected, auto-starting project...")
    startProject(context, true)
    connectRuntimeErrorMonitoring()
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
