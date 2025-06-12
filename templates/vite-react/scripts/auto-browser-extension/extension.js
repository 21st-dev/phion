const vscode = require("vscode");
const http = require("http");
const { exec, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Только дефолтный порт Vite
const DEFAULT_VITE_PORT = 5173;

// Флаг для отслеживания состояния автооткрытия
let hasAutoOpened = false;
let serverCheckInterval = null;

let DEBUG_MODE = false;
let AUTO_START_NEW_PROJECT = false;
let AUTO_OPTIMIZE_WORKSPACE = true;

const debugLog = (msg) => {
  if (DEBUG_MODE) {
    console.log(`[Vybcel][DEBUG] ${msg}`);
  }
};

function updateDebugMode() {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return;

    const rootPath = workspaceFolders[0].uri.fsPath;
    const configPath = path.join(rootPath, "vybcel.config.json");

    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      DEBUG_MODE = config?.debug === true;
      AUTO_START_NEW_PROJECT = config?.autoStartOnNewProject === true;
      AUTO_OPTIMIZE_WORKSPACE = config?.autoOptimizeWorkspace !== false; // По умолчанию true
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
 * Проверяет, запускался ли уже проект в этой рабочей области
 */
function hasProjectBeenStarted(context) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) return true;

  const workspaceId = workspaceFolders[0].uri.fsPath;
  const startedProjects = context.globalState.get("vybcelStartedProjects", []);

  debugLog(`Checking if project was started before: ${workspaceId}`);
  debugLog(`Previously started projects: ${JSON.stringify(startedProjects)}`);

  return startedProjects.includes(workspaceId);
}

/**
 * Отмечает проект как запущенный
 */
function markProjectAsStarted(context) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) return;

  const workspaceId = workspaceFolders[0].uri.fsPath;
  const startedProjects = context.globalState.get("vybcelStartedProjects", []);

  if (!startedProjects.includes(workspaceId)) {
    startedProjects.push(workspaceId);
    context.globalState.update("vybcelStartedProjects", startedProjects);
    debugLog(`Marked project as started: ${workspaceId}`);
  }
}

/**
 * Сброс истории запущенных проектов (для тестирования)
 */
function resetProjectHistory(context) {
  context.globalState.update("vybcelStartedProjects", []);
  debugLog("Project history reset");
  vscode.window.showInformationMessage("Vybcel: Project history cleared");
}

/**
 * Убивает процессы на указанных портах
 */
function killPortProcesses(ports) {
  return Promise.all(ports.map((port) => killPortProcess(port)));
}

/**
 * Убивает процесс на конкретном порту
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
 * Проверяет что сайт работает на порту 5173
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
 * Автоматически обнаруживает запуск сервера и открывает браузер
 */
async function autoDetectAndOpen() {
  debugLog("Checking if Vite server is up...");
  if (hasAutoOpened) return;

  const isServerActive = await checkWebsiteServer();

  if (isServerActive) {
    hasAutoOpened = true;
    debugLog("Vite server detected. Opening preview...");

    // Останавливаем проверку
    if (serverCheckInterval) {
      clearInterval(serverCheckInterval);
      serverCheckInterval = null;
    }

    // Небольшая задержка для стабилизации сервера
    setTimeout(async () => {
      await openPreview();
    }, 2000);
  }
}

/**
 * Запускает мониторинг сервера
 */
function startServerMonitoring() {
  debugLog("Started server monitoring loop");
  console.log("🔍 Monitoring for Vite server startup...");

  // Проверяем каждые 2 секунды
  serverCheckInterval = setInterval(autoDetectAndOpen, 2000);

  // Останавливаем через 60 секунд если сервер не найден
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
 * Запускает проект командой pnpm start
 */
async function startProject(context, isAutoStart = false) {
  debugLog(`Command: startProject triggered (auto: ${isAutoStart})`);
  try {
    // Проверяем что мы в правильной папке проекта
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage(
        "No workspace folder found. Please open your project folder first."
      );
      return;
    }

    // Сбрасываем флаг автооткрытия
    hasAutoOpened = false;

    const terminal = vscode.window.createTerminal({
      name: "Project Server",
      cwd: workspaceFolders[0].uri.fsPath,
    });

    // Показываем терминал и запускаем команду
    terminal.show();
    debugLog("Opening terminal and executing 'pnpm start'");
    terminal.sendText("pnpm start");

    // Отмечаем проект как запущенный
    if (context) {
      markProjectAsStarted(context);
    }

    // Запускаем мониторинг сервера
    startServerMonitoring();

    // Показываем уведомление
    const message = isAutoStart
      ? "🚀 Auto-starting your project... Browser will open automatically."
      : "🚀 Starting your project... Browser will open automatically.";

    vscode.window.showInformationMessage(message);
  } catch (error) {
    debugLog(`startProject error: ${error.message}`);
    console.error("Failed to start project:", error);
    vscode.window.showErrorMessage(`Could not start project: ${error.message}`);
  }
}

/**
 * Открывает Simple Browser для предпросмотра сайта
 */
async function openPreview() {
  const url = `http://localhost:${DEFAULT_VITE_PORT}`;
  debugLog(`Attempting to open preview at ${url}`);

  try {
    // Сначала проверяем что сервер активен
    const isServerActive = await checkWebsiteServer();

    if (!isServerActive) {
      vscode.window.showWarningMessage(
        `Your website is not running. Start with 'pnpm start' first.`
      );
      return false;
    }

    // Открываем Simple Browser
    await vscode.commands.executeCommand("simpleBrowser.show", url);
    console.log(`🌐 Opened preview: ${url}`);

    // Автоматически настраиваем рабочее пространство (если включено)
    if (AUTO_OPTIMIZE_WORKSPACE) {
      setTimeout(async () => {
        try {
          debugLog("Setting up optimal workspace layout...");

          // 1. Закрываем боковую панель (Explorer)
          await vscode.commands.executeCommand("workbench.action.closeSidebar");
          debugLog("Closed Explorer sidebar");

          // 2. Закрываем терминал
          await vscode.commands.executeCommand("workbench.action.closePanel");
          debugLog("Closed bottom panel (terminal)");

          // 3. Открываем AI чат (фокус и новый сеанс)
          await vscode.commands.executeCommand("workbench.view.chat");
          await vscode.commands.executeCommand("workbench.action.chat.new");
          debugLog("Opened AI chat view (new session)");

          console.log("✨ Workspace optimized for development");
        } catch (error) {
          debugLog(`Workspace setup error: ${error.message}`);
          // Не показываем ошибку пользователю, это не критично
        }
      }, 1500); // Небольшая задержка для стабильности
    }

    // Показываем уведомление
    vscode.window.showInformationMessage(
      `🚀 Website preview opened: ${url}`,
      "Hide"
    );

    return true;
  } catch (error) {
    debugLog(`openPreview error: ${error.message}`);
    console.error("Failed to open preview:", error);

    // Fallback: показываем уведомление с инструкцией
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
 * Команда для очистки портов и открытия предпросмотра
 */
async function clearPortsAndOpenPreview() {
  try {
    // Показываем прогресс
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

        // Убиваем процессы на портах Vite
        await killPortProcesses([5173, 5174, 5175, 4173]);

        progress.report({
          increment: 50,
          message: "Waiting for system to update...",
        });

        // Ждем немного чтобы порты освободились
        await new Promise((resolve) => setTimeout(resolve, 1000));

        progress.report({ increment: 80, message: "Opening your website..." });

        // Открываем предпросмотр
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
 * Команда для исправления проблем с подключением
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
 * Проверяет если это Vybcel проект
 */
function isVybcelProject() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return false;

  const rootPath = workspaceFolders[0].uri.fsPath;
  const vybcelConfigPath = path.join(rootPath, "vybcel.config.json");
  const packageJsonPath = path.join(rootPath, "package.json");

  // Проверяем наличие vybcel.config.json или vybcel в package.json
  if (fs.existsSync(vybcelConfigPath)) {
    return true;
  }

  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      return !!(
        packageJson.dependencies?.vybcel || packageJson.devDependencies?.vybcel
      );
    } catch (error) {
      return false;
    }
  }

  return false;
}

/**
 * Активация расширения
 */
function activate(context) {
  updateDebugMode();
  debugLog("Extension activated (debug mode ON)");
  console.log("🚀 Vybcel extension activated");

  // Проверяем если это Vybcel проект и запускаем мониторинг
  if (isVybcelProject()) {
    debugLog("🎯 Vybcel project detected!");

    // Сначала проверяем, не запущен ли уже сервер
    checkWebsiteServer().then((isServerActive) => {
      if (isServerActive && !hasAutoOpened) {
        debugLog("Existing server detected on startup - opening preview");
        hasAutoOpened = true;
        setTimeout(async () => {
          await openPreview();
        }, 1000);
        return;
      }

      // Проверяем, нужно ли автоматически запускать новый проект
      if (AUTO_START_NEW_PROJECT && !hasProjectBeenStarted(context)) {
        debugLog("New project detected - auto-starting...");
        vscode.window.showInformationMessage(
          "🎉 New Vybcel project detected! Auto-starting..."
        );

        // Запускаем проект автоматически с небольшой задержкой
        setTimeout(() => {
          startProject(context, true);
        }, 2000);
      } else {
        debugLog(
          "Project already started before or auto-start disabled - only monitoring"
        );
        // Просто запускаем мониторинг сервера
        setTimeout(() => {
          startServerMonitoring();
        }, 3000);
      }
    });
  } else {
    debugLog("Not a Vybcel project - extension inactive");
  }

  // Регистрируем команды
  const startProjectCommand = vscode.commands.registerCommand(
    "vybcel.startProject",
    () => startProject(context, false)
  );

  const openPreviewCommand = vscode.commands.registerCommand(
    "vybcel.openPreview",
    openPreview
  );

  const clearPortsCommand = vscode.commands.registerCommand(
    "vybcel.clearPortsAndOpen",
    clearPortsAndOpenPreview
  );

  const fixConnectionCommand = vscode.commands.registerCommand(
    "vybcel.fixConnection",
    fixConnectionCommand
  );

  const resetHistoryCommand = vscode.commands.registerCommand(
    "vybcel.resetProjectHistory",
    () => resetProjectHistory(context)
  );

  context.subscriptions.push(
    startProjectCommand,
    openPreviewCommand,
    clearPortsCommand,
    fixConnectionCommand,
    resetHistoryCommand
  );

  // Тихая активация - не показываем сообщение пользователю
}

/**
 * Деактивация расширения
 */
function deactivate() {
  console.log("🛑 Vybcel extension deactivated");

  // Очищаем интервал при деактивации
  if (serverCheckInterval) {
    clearInterval(serverCheckInterval);
    serverCheckInterval = null;
  }
}

module.exports = {
  activate,
  deactivate,
};
