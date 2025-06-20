const vscode = require("vscode")
const http = require("http")
const path = require("path")
const fs = require("fs")

// Default Vite port only
const DEFAULT_VITE_PORT = 5173

// Flag to track auto-open state
let hasAutoOpened = false
let serverCheckInterval = null
let simpleBrowserOpen = false

// Persistent storage key for browser opened state
const BROWSER_OPENED_KEY = 'phion-browser-opened'

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
    startServerMonitoring(context)

    // Show notification
    const message = isAutoStart ? "🚀 Auto-starting your project..." : "🚀 Starting your project..."

    vscode.window.showInformationMessage(message)
  } catch (error) {
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
    vscode.commands.executeCommand('setContext', 'phion.simpleBrowserOpen', true)

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

  // Track tab changes to detect Simple Browser state
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    const isSimpleBrowser = editor && editor.document.uri.scheme === 'simple-browser'
    simpleBrowserOpen = isSimpleBrowser
    vscode.commands.executeCommand('setContext', 'phion.simpleBrowserOpen', isSimpleBrowser)
  })

  // Track tab closures
  vscode.workspace.onDidCloseTextDocument((document) => {
    if (document.uri.scheme === 'simple-browser') {
      // Check if any simple browser tabs are still open
      const hasSimpleBrowser = vscode.window.visibleTextEditors.some(
        editor => editor.document.uri.scheme === 'simple-browser'
      )
      simpleBrowserOpen = hasSimpleBrowser
      vscode.commands.executeCommand('setContext', 'phion.simpleBrowserOpen', hasSimpleBrowser)
    }
  })

  // Check if this is a Phion project and start monitoring
  if (isPhionProject()) {
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
  context.subscriptions.push(startProjectCommand, openPreviewCommand, toggleAiChatCommand)
}

/**
 * Extension deactivation
 */
function deactivate() {
  if (serverCheckInterval) {
    clearInterval(serverCheckInterval)
    serverCheckInterval = null
  }
  console.log("👋 Phion extension deactivated")
}

module.exports = {
  activate,
  deactivate,
}
