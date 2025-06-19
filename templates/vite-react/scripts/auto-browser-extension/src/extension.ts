import * as fs from "fs"
import * as http from "http"
import * as path from "path"
import * as vscode from "vscode"
import { startCDPRelayServer } from "./utils/cdp-relay.js"
import { dispatchAgentCall } from "./utils/dispatch-agent-call"
import { initializeDiagnosticCollection } from "./utils/inject-prompt-diagnostic-with-callback"

// Default Vite port only
const DEFAULT_VITE_PORT = 5173

// Flag to track auto-open state
let hasAutoOpened = false
let serverCheckInterval: NodeJS.Timeout | null = null

// CDP Bridge server state
let cdpBridgeServer: any = null
let cdpBridgePort = 9223
let consoleLogsChannel: vscode.OutputChannel | null = null

let AUTO_START_NEW_PROJECT = false
let AUTO_OPTIMIZE_WORKSPACE = true

function updateConfigSettings() {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders || workspaceFolders.length === 0) return

    const rootPath = workspaceFolders[0].uri.fsPath
    const configPath = path.join(rootPath, "phion.config.json")

    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"))
      AUTO_START_NEW_PROJECT = config?.autoStartOnNewProject === true
      AUTO_OPTIMIZE_WORKSPACE = config?.autoOptimizeWorkspace !== false // Default true
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
 * Auto-detect server startup and open browser
 */
async function autoDetectAndOpen() {
  if (hasAutoOpened) return

  const isServerActive = await checkWebsiteServer()

  if (isServerActive) {
    hasAutoOpened = true

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
function startServerMonitoring() {
  console.log("🔍 Monitoring for Vite server startup...")

  // Check every 2 seconds
  serverCheckInterval = setInterval(autoDetectAndOpen, 2000)

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

    // Reset auto-open flag
    hasAutoOpened = false

    const terminal = vscode.window.createTerminal({
      name: "Project Server",
      cwd: workspaceFolders[0].uri.fsPath,
    })

    // Show terminal and run command
    terminal.show()

    // Determine OS and run appropriate setup command
    const isWindows = process.platform === "win32"
    if (isWindows) {
      terminal.sendText("setup.bat")
    } else {
      terminal.sendText("chmod +x setup.sh && ./setup.sh")
    }

    // Mark project as started
    if (context) {
      markProjectAsStarted(context)
    }

    // Start server monitoring
    startServerMonitoring()

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

    // Auto-optimize workspace (if enabled)
    if (AUTO_OPTIMIZE_WORKSPACE) {
      setTimeout(async () => {
        try {
          // 1. Close sidebar (Explorer)
          await vscode.commands.executeCommand("workbench.action.closeSidebar")

          // 2. Close terminal
          await vscode.commands.executeCommand("workbench.action.closePanel")

          // 3. Open AI chat (using correct Cursor commands)
          await vscode.commands.executeCommand("cursor.openChat")
          await vscode.commands.executeCommand("cursor.newChat")

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
 * Show console logs output channel
 */
function showConsoleLogs() {
  if (consoleLogsChannel) {
    consoleLogsChannel.show()
  } else {
    vscode.window.showInformationMessage("Console logs not available. Start CDP Bridge first.")
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

  // Check if this is a Phion project and start monitoring
  if (isPhionProject()) {
    // Auto-start CDP bridge for all Phion projects
    setTimeout(() => {
      startCDPBridge()
    }, 1000)

    // First check if server is already running
    checkWebsiteServer().then((isServerActive) => {
      if (isServerActive && !hasAutoOpened) {
        hasAutoOpened = true
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
          startServerMonitoring()
        }, 3000)
      }
    })
  }

  // Register commands
  const startProjectCommand = vscode.commands.registerCommand("phion.startProject", () =>
    startProject(context, false),
  )

  const openPreviewCommand = vscode.commands.registerCommand("phion.openPreview", openPreview)

  const showConsoleLogsCommand = vscode.commands.registerCommand(
    "phion.showConsoleLogs",
    showConsoleLogs,
  )

  // Add to subscriptions
  context.subscriptions.push(startProjectCommand, openPreviewCommand, showConsoleLogsCommand)
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

  console.log("👋 Phion extension deactivated")
}

export { activate, deactivate }
