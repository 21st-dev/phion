const vscode = require("vscode");
const http = require("http");
const { exec, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Default Vite port only
const DEFAULT_VITE_PORT = 5173;

// Flag to track auto-open state
let hasAutoOpened = false;
let serverCheckInterval = null;

let DEBUG_MODE = false;
let AUTO_START_NEW_PROJECT = false;
let AUTO_OPTIMIZE_WORKSPACE = true;

const debugLog = (msg) => {
  if (DEBUG_MODE) {
    console.log(`[Phion][DEBUG] ${msg}`);
  }
};

function updateDebugMode() {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return;

    const rootPath = workspaceFolders[0].uri.fsPath;
    const configPath = path.join(rootPath, "phion.config.json");

    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      DEBUG_MODE = config?.debug === true;
      AUTO_START_NEW_PROJECT = config?.autoStartOnNewProject === true;
      AUTO_OPTIMIZE_WORKSPACE = config?.autoOptimizeWorkspace !== false; // Default true
      debugLog(
        `Config loaded: debug=${DEBUG_MODE}, autoStartOnNewProject=${AUTO_START_NEW_PROJECT}, autoOptimizeWorkspace=${AUTO_OPTIMIZE_WORKSPACE}`
      );
    }
  } catch (error) {
    debugLog(`Error reading config: ${error.message}`);
    // Ignore errors, keep DEBUG_MODE as false
  }
}

/**
 * Check if project has been started before in this workspace
 */
function hasProjectBeenStarted(context) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) return true;

  const workspaceId = workspaceFolders[0].uri.fsPath;
  const startedProjects = context.globalState.get("phionStartedProjects", []);

  debugLog(`Checking if project was started before: ${workspaceId}`);
  debugLog(`Previously started projects: ${JSON.stringify(startedProjects)}`);

  return startedProjects.includes(workspaceId);
}

/**
 * Mark project as started
 */
function markProjectAsStarted(context) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) return;

  const workspaceId = workspaceFolders[0].uri.fsPath;
  const startedProjects = context.globalState.get("phionStartedProjects", []);

  if (!startedProjects.includes(workspaceId)) {
    startedProjects.push(workspaceId);
    context.globalState.update("phionStartedProjects", startedProjects);
    debugLog(`Marked project as started: ${workspaceId}`);
  }
}

/**
 * Reset started project history (for testing)
 */
function resetProjectHistory(context) {
  context.globalState.update("phionStartedProjects", []);
  debugLog("Project history reset");
  vscode.window.showInformationMessage("Phion: Project history cleared");
}

/**
 * Kill processes on specified ports
 */
function killPortProcesses(ports) {
  return Promise.all(ports.map((port) => killPortProcess(port)));
}

/**
 * Kill process on specific port
 */
function killPortProcess(port) {
  return new Promise((resolve) => {
    debugLog(`Killing processes on port ${port}`);
    const command =
      process.platform === "win32"
        ? `netstat -ano | findstr :${port} | for /f "tokens=5" %a in ('findstr LISTENING') do taskkill /F /PID %a`
        : `lsof -ti:${port} | xargs kill -9`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        debugLog(`Port ${port} was already free or error: ${error.message}`);
      } else {
        debugLog(`Successfully killed process on port ${port}`);
      }
      resolve();
    });
  });
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
        resolve(true);
      }
    );

    req.on("error", () => {
      resolve(false);
    });

    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * Auto-detect server startup and open browser
 */
async function autoDetectAndOpen() {
  debugLog("Checking if Vite server is up...");
  if (hasAutoOpened) return;

  const isServerActive = await checkWebsiteServer();

  if (isServerActive) {
    hasAutoOpened = true;
    debugLog("Vite server detected. Opening preview...");

    // Stop checking
    if (serverCheckInterval) {
      clearInterval(serverCheckInterval);
      serverCheckInterval = null;
    }

    // Small delay for server stabilization
    setTimeout(async () => {
      await openPreview();
    }, 2000);
  }
}

/**
 * Start server monitoring
 */
function startServerMonitoring() {
  debugLog("Started server monitoring loop");
  console.log("🔍 Monitoring for Vite server startup...");

  // Check every 2 seconds
  serverCheckInterval = setInterval(autoDetectAndOpen, 2000);

  // Stop after 60 seconds if server not found
  setTimeout(() => {
    if (serverCheckInterval && !hasAutoOpened) {
      clearInterval(serverCheckInterval);
      serverCheckInterval = null;
      debugLog("Monitoring timeout - server not detected");
      console.log("⏰ Server monitoring timeout - no server detected");
    }
  }, 60000);
}

/**
 * Start project with pnpm start command
 */
async function startProject(context, isAutoStart = false) {
  debugLog(`Command: startProject triggered (auto: ${isAutoStart})`);
  try {
    // Check if we're in the right project folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage(
        "No workspace folder found. Please open your project folder first."
      );
      return;
    }

    // Reset auto-open flag
    hasAutoOpened = false;

    const terminal = vscode.window.createTerminal({
      name: "Project Server",
      cwd: workspaceFolders[0].uri.fsPath,
    });

    // Show terminal and run command
    terminal.show();
    debugLog("Opening terminal and executing 'pnpm start'");
    terminal.sendText("pnpm start");

    // Mark project as started
    if (context) {
      markProjectAsStarted(context);
    }

    // Start server monitoring
    startServerMonitoring();

    // Show notification
    const message = isAutoStart
      ? "🚀 Auto-starting your project..."
      : "🚀 Starting your project...";

    vscode.window.showInformationMessage(message);
  } catch (error) {
    debugLog(`startProject error: ${error.message}`);
    console.error("Failed to start project:", error);
    vscode.window.showErrorMessage(`Could not start project: ${error.message}`);
  }
}

/**
 * Open Simple Browser for website preview
 */
async function openPreview() {
  const url = `http://localhost:${DEFAULT_VITE_PORT}`;
  debugLog(`Attempting to open preview at ${url}`);

  try {
    // First check if server is active
    const isServerActive = await checkWebsiteServer();

    if (!isServerActive) {
      vscode.window.showWarningMessage(
        `Your website is not running. Start with 'pnpm start' first.`
      );
      return false;
    }

    // Open Simple Browser
    await vscode.commands.executeCommand("simpleBrowser.show", url);
    console.log(`🌐 Opened preview: ${url}`);

    // Auto-optimize workspace (if enabled)
    if (AUTO_OPTIMIZE_WORKSPACE) {
      setTimeout(async () => {
        try {
          debugLog("Setting up optimal workspace layout...");

          // 1. Close sidebar (Explorer)
          await vscode.commands.executeCommand("workbench.action.closeSidebar");
          debugLog("Closed Explorer sidebar");

          // 2. Close terminal
          await vscode.commands.executeCommand("workbench.action.closePanel");
          debugLog("Closed bottom panel (terminal)");

          // 3. Open AI chat (using correct Cursor commands)
          await vscode.commands.executeCommand("cursor.openChat");
          await vscode.commands.executeCommand("cursor.newChat");
          debugLog("Opened Cursor AI chat (new session)");

          console.log("✨ Workspace optimized for development");
        } catch (error) {
          debugLog(`Workspace setup error: ${error.message}`);
          // Don't show error to user, it's not critical
        }
      }, 1500); // Small delay for stability
    }

    // Show notification
    vscode.window.showInformationMessage(
      `🚀 Website preview opened: ${url}`,
      "Hide"
    );

    return true;
  } catch (error) {
    debugLog(`openPreview error: ${error.message}`);
    console.error("Failed to open preview:", error);

    // Fallback: show notification with instruction
    const action = await vscode.window.showWarningMessage(
      `Could not open preview. Try again?`,
      "Copy URL",
      "Try Again"
    );

    if (action === "Copy URL") {
      await vscode.env.clipboard.writeText(url);
      vscode.window.showInformationMessage("URL copied to clipboard");
    } else if (action === "Try Again") {
      return await openPreview();
    }

    return false;
  }
}

/**
 * Command to clear ports and open preview
 */
async function clearPortsAndOpenPreview() {
  try {
    // Show progress
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Fixing connection issues...",
        cancellable: false,
      },
      async (progress) => {
        progress.report({
          increment: 0,
          message: "Clearing connection issues...",
        });

        // Kill processes on Vite ports
        await killPortProcesses([5173, 5174, 5175, 4173]);

        progress.report({
          increment: 50,
          message: "Waiting for system to update...",
        });

        // Wait a bit for ports to be freed
        await new Promise((resolve) => setTimeout(resolve, 1000));

        progress.report({ increment: 80, message: "Opening your website..." });

        // Open preview
        await openPreview();

        progress.report({ increment: 100, message: "Done!" });
      }
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Could not fix connection: ${error.message}`
    );
  }
}

/**
 * Command to fix connection issues
 */
async function fixConnectionCommand() {
  try {
    const action = await vscode.window.showWarningMessage(
      "Fix connection issues? This will restart your website connection.",
      "Yes, fix it",
      "Cancel"
    );

    if (action === "Yes, fix it") {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Fixing connection issues...",
          cancellable: false,
        },
        async (progress) => {
          await killPortProcesses([5173, 5174, 5175, 4173]);
          vscode.window.showInformationMessage("✅ Connection issues fixed!");
        }
      );
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `Could not fix connection: ${error.message}`
    );
  }
}

/**
 * Check if this is a Phion project
 */
function isPhionProject() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return false;

  const rootPath = workspaceFolders[0].uri.fsPath;
  const phionConfigPath = path.join(rootPath, "phion.config.json");
  const packageJsonPath = path.join(rootPath, "package.json");

  // Check for phion.config.json or phion in package.json
  if (fs.existsSync(phionConfigPath)) {
    return true;
  }

  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      return !!(
        packageJson.dependencies?.phion || packageJson.devDependencies?.phion
      );
    } catch (error) {
      return false;
    }
  }

  return false;
}

/**
 * Extension activation
 */
function activate(context) {
  updateDebugMode();
  debugLog("Extension activated (debug mode ON)");
  console.log("🚀 Phion extension activated");

  // Check if this is a Phion project and start monitoring
  if (isPhionProject()) {
    debugLog("🎯 Phion project detected!");

    // First check if server is already running
    checkWebsiteServer().then((isServerActive) => {
      if (isServerActive && !hasAutoOpened) {
        debugLog("Existing server detected on startup - opening preview");
        hasAutoOpened = true;
        setTimeout(async () => {
          await openPreview();
        }, 1000);
        return;
      }

      // Check if we need to auto-start new project
      if (AUTO_START_NEW_PROJECT && !hasProjectBeenStarted(context)) {
        debugLog("New project detected - auto-starting...");
        vscode.window.showInformationMessage(
          "🎉 New Phion project detected! Auto-starting..."
        );

        // Auto-start project with small delay
        setTimeout(() => {
          startProject(context, true);
        }, 2000);
      } else {
        debugLog(
          "Project already started before or auto-start disabled - only monitoring"
        );
        // Just start server monitoring
        setTimeout(() => {
          startServerMonitoring();
        }, 3000);
      }
    });
  } else {
    debugLog("Not a Phion project - extension inactive");
  }

  // Register commands
  const startProjectCommand = vscode.commands.registerCommand(
    "phion.startProject",
    () => startProject(context, false)
  );

  const openPreviewCommand = vscode.commands.registerCommand(
    "phion.openPreview",
    openPreview
  );

  const clearPortsCommand = vscode.commands.registerCommand(
    "phion.clearPortsAndOpen",
    clearPortsAndOpenPreview
  );

  const fixConnectionCommand = vscode.commands.registerCommand(
    "phion.fixConnection",
    fixConnectionCommand
  );

  const resetHistoryCommand = vscode.commands.registerCommand(
    "phion.resetProjectHistory",
    () => resetProjectHistory(context)
  );

  // Add to subscriptions
  context.subscriptions.push(
    startProjectCommand,
    openPreviewCommand,
    clearPortsCommand,
    fixConnectionCommand,
    resetHistoryCommand
  );
}

/**
 * Extension deactivation
 */
function deactivate() {
  if (serverCheckInterval) {
    clearInterval(serverCheckInterval);
    serverCheckInterval = null;
  }
  console.log("👋 Phion extension deactivated");
}

module.exports = {
  activate,
  deactivate,
};
