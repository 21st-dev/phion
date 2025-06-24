import { io, Socket } from "socket.io-client"
import chokidar, { FSWatcher } from "chokidar"
import fs from "fs"
import path from "path"
import crypto from "crypto"
import { exec } from "child_process"
import { promisify } from "util"
import http from "http"
import { openPreview, type VSCodeConfig } from "./vscode-utils.js"

const execAsync = promisify(exec)

export interface AgentConfig {
  projectId: string
  wsUrl: string
  debug?: boolean
  toolbar?: {
    enabled?: boolean
    position?: "top" | "bottom"
    autoOpen?: boolean
  }
}

export interface FileChange {
  projectId: string
  filePath: string
  content: string
  hash: string
  timestamp: number
}

export interface FileDelete {
  projectId: string
  filePath: string
  timestamp: number
}

export interface EnvFileChange {
  projectId: string
  filePath: string
  content: string
  timestamp: number
}

// Интерфейсы для данных от сервера
export interface AuthenticatedData {
  projectId: string
}

export interface FileSavedData {
  filePath: string
}

export interface FileUpdatedData {
  filePath: string
}

export interface GitPullData {
  token: string
  repoUrl: string
}

export interface UpdateFilesData {
  files: Array<{ path: string; content: string }>
}

export class PhionAgent {
  private socket: Socket | null = null
  private watcher: FSWatcher | null = null
  private envWatcher: FSWatcher | null = null // Отдельный watcher для .env файлов
  private httpServer: http.Server | null = null
  private isConnected = false
  private isGitRepo = false
  private config: AgentConfig
  private gitOperationCooldown = false // Новое поле для предотвращения ложных событий

  constructor(config: AgentConfig) {
    this.config = config
  }

  async start(): Promise<void> {
    console.log("🚀 Phion Agent")
    if (this.config.debug) {
      console.log(`📡 Connecting to: ${this.config.wsUrl}`)
      console.log(`🆔 Project ID: ${this.config.projectId}`)
    }

    // Запускаем локальный HTTP сервер для команд
    await this.startLocalServer()

    // Проверяем, что мы в git репозитории
    await this.checkGitRepository()

    // Подключаемся к WebSocket
    await this.connectWebSocket()

    // Запускаем file watcher
    this.startFileWatcher()

    console.log("✅ Agent running - edit files to sync changes")
    if (this.config.debug) {
      console.log("🌐 Local command server: http://localhost:3333")
    }
    console.log("Press Ctrl+C to stop")
  }

  private async startLocalServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer((req, res) => {
        // Enable CORS
        res.setHeader("Access-Control-Allow-Origin", "*")
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        res.setHeader("Access-Control-Allow-Headers", "Content-Type")

        if (req.method === "OPTIONS") {
          res.writeHead(200)
          res.end()
          return
        }

        if (req.method === "POST" && req.url === "/open-url") {
          let body = ""
          req.on("data", (chunk) => {
            body += chunk.toString()
          })

          req.on("end", async () => {
            try {
              const { url } = JSON.parse(body)

              const success = await this.openUrlInSystem(url)

              res.writeHead(200, { "Content-Type": "application/json" })
              res.end(
                JSON.stringify({
                  success,
                  message: success ? "URL opened successfully" : "Failed to open URL",
                }),
              )
            } catch (error) {
              if (this.config.debug) {
                console.error("❌ Local server: Error opening URL:", error)
              }
              res.writeHead(500, { "Content-Type": "application/json" })
              res.end(
                JSON.stringify({
                  success: false,
                  error: (error as Error).message,
                }),
              )
            }
          })
          return
        }

        if (req.method === "GET" && req.url === "/status") {
          res.writeHead(200, { "Content-Type": "application/json" })
          res.end(
            JSON.stringify({
              status: "running",
              projectId: this.config.projectId,
              connected: this.isConnected,
            }),
          )
          return
        }

        // 404 for other routes
        res.writeHead(404, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Not found" }))
      })

      this.httpServer.listen(3333, "localhost", () => {
        if (this.config.debug) {
          console.log("🌐 Local command server started on http://localhost:3333")
        }
        resolve()
      })

      this.httpServer.on("error", (error: any) => {
        if (error.code === "EADDRINUSE") {
          if (this.config.debug) {
            console.log("⚠️ Port 3333 already in use, trying 3334...")
          }
          this.httpServer?.listen(3334, "localhost", () => {
            if (this.config.debug) {
              console.log("🌐 Local command server started on http://localhost:3334")
            }
            resolve()
          })
        } else {
          console.error("❌ Failed to start local server:", error)
          reject(error)
        }
      })
    })
  }

  private async openUrlInSystem(url: string): Promise<boolean> {
    try {
      const platform = process.platform
      let command: string

      switch (platform) {
        case "darwin":
          // Try multiple approaches on macOS
          try {
            // Method 1: Try to open in Cursor if it's running
            const cursorAppleScript = `
              tell application "System Events"
                if exists (processes where name is "Cursor") then
                  tell application "Cursor" to activate
                  delay 0.5
                  keystroke "l" using {command down}
                  delay 0.2
                  keystroke "${url}"
                  delay 0.2
                  keystroke return
                  return true
                else
                  return false
                end if
              end tell
            `

            if (this.config.debug) {
              console.log(`🍎 Trying AppleScript for Cursor: ${url}`)
            }

            await execAsync(`osascript -e '${cursorAppleScript}'`)
            if (this.config.debug) {
              console.log(`✅ Opened in Cursor via AppleScript: ${url}`)
            }
            return true
          } catch (cursorError) {
            if (this.config.debug) {
              console.log(`⚠️ Cursor AppleScript failed, falling back to system browser`)
            }
            // Fallback to system browser
            command = `open "${url}"`
          }
          break
        case "win32":
          command = `start "" "${url}"`
          break
        default:
          command = `xdg-open "${url}"`
          break
      }

      if (command) {
        await execAsync(command)
        if (this.config.debug) {
          console.log(`✅ Opened URL in system browser: ${url}`)
        }
      }

      return true
    } catch (error) {
      console.error("❌ Failed to open URL:", (error as Error).message)
      if (this.config.debug) {
        console.error("❌ Full error details:", error)
      }
      return false
    }
  }

  private async checkGitRepository(): Promise<void> {
    try {
      await execAsync("git rev-parse --git-dir")
      this.isGitRepo = true
      if (this.config.debug) {
        console.log("✅ Git repository detected")

        // Проверяем remote origin
        try {
          const { stdout } = await execAsync("git remote get-url origin")
          console.log(`🔗 Remote origin: ${stdout.trim()}`)
        } catch (error) {
          console.log("⚠️ No remote origin configured")
        }
      }
    } catch (error) {
      // Git репозиторий не найден - инициализируем
      if (this.config.debug) {
        console.log("⚠️ Not a git repository - initializing...")
      }
      await this.initializeGitRepository()
    }
  }

  private async initializeGitRepository(): Promise<void> {
    try {
      if (this.config.debug) {
        console.log("🔧 Initializing git repository...")
      }

      // 1. Инициализируем git
      await execAsync("git init")

      // 2. Настраиваем remote origin для GitHub репозитория проекта
      const repoUrl = `https://github.com/phion-dev/phion-project-${this.config.projectId}.git`
      await execAsync(`git remote add origin ${repoUrl}`)

      // 3. Создаем initial commit если файлы уже есть
      try {
        await execAsync("git add .")
        await execAsync('git commit -m "Initial commit from Phion template"')
      } catch (commitError) {
        // Files may be empty
      }

      this.isGitRepo = true
      if (this.config.debug) {
        console.log("✅ Git repository setup completed")
      }
    } catch (error) {
      console.error("❌ Failed to initialize git repository:", (error as Error).message)
      this.isGitRepo = false
      if (this.config.debug) {
        console.log("⚠️ Git commands will be disabled")
      }
    }
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve) => {
      this.socket = io(this.config.wsUrl, {
        transports: ["websocket", "polling"], // Support both transports for reliability
        timeout: 30000, // 30 seconds - increased from 10 seconds for production
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000, // Max 10 seconds between attempts
        randomizationFactor: 0.5, // Add jitter to reconnection attempts

        // 🚀 PRODUCTION SETTINGS - match server configuration
        upgrade: true,
        rememberUpgrade: true,

        // Enable connection state recovery
        auth: {
          projectId: this.config.projectId, // Include projectId in handshake
        },
      })

      this.socket.on("connect", () => {
        if (this.config.debug) {
          console.log("✅ Connected to Phion")
        }
        this.socket!.emit("authenticate", {
          projectId: this.config.projectId,
          clientType: "agent",
        })
      })

      this.socket.on("authenticated", (data: AuthenticatedData) => {
        if (this.config.debug) {
          console.log(`🔐 Authenticated for project: ${data.projectId}`)
        }
        this.isConnected = true

        // Открываем превью в VS Code после успешного подключения
        this.openPreviewIfEnabled()

        resolve()
      })

      // Таймаут для подключения
      setTimeout(() => {
        if (!this.isConnected) {
          if (this.config.debug) {
            console.log("⏰ Connection timeout, but continuing anyway...")
          }
          resolve()
        }
      }, 15000)

      this.setupEventHandlers()
    })
  }

  private setupEventHandlers(): void {
    if (!this.socket) return

    // Добавляем логирование всех входящих событий для отладки
    this.socket.onAny((eventName, ...args) => {
      if (this.config.debug) {
        console.log(`📡 [Agent] Received event: ${eventName}`, args.length > 0 ? args[0] : "")
      }
    })

    this.socket.on("file_saved", (data: FileSavedData) => {
      if (this.config.debug) {
        console.log(`💾 File saved: ${data.filePath}`)
      }
    })

    this.socket.on("file_updated", (data: FileUpdatedData) => {
      if (this.config.debug) {
        console.log(`🔄 File updated by another client: ${data.filePath}`)
      }
    })

    this.socket.on("discard_local_changes", async (data) => {
      if (this.config.debug) {
        console.log("🔄 [AGENT] Received discard_local_changes command from server")
        console.log("🔄 Discarding local changes...")
      }
      await this.discardLocalChanges()
    })

    this.socket.on("git_pull_with_token", async (data: GitPullData) => {
      if (this.config.debug) {
        console.log("📥 [AGENT] Received git_pull_with_token command from server")
        console.log("📥 Syncing with latest changes...")
      }
      await this.gitPullWithToken(data.token, data.repoUrl)
    })

    this.socket.on("update_local_files", async (data: UpdateFilesData) => {
      if (this.config.debug) {
        console.log("📄 [AGENT] Received update_local_files command from server")
        console.log("📄 Updating local files...")
      }
      await this.updateLocalFiles(data.files)
    })

    // Добавляем обработчики для save событий
    this.socket.on("save_success", (data) => {
      if (this.config.debug) {
        console.log("💾 [AGENT] Save operation completed successfully")
      }
    })

    this.socket.on("discard_success", (data) => {
      if (this.config.debug) {
        console.log("🔄 [AGENT] Discard operation completed successfully")
      }
    })

    this.socket.on("error", (error: Error) => {
      console.error("❌ WebSocket error:", error.message)
    })

    this.socket.on("disconnect", (reason: string) => {
      if (this.config.debug) {
        console.log(`❌ Disconnected: ${reason}`)
      }
      this.isConnected = false

      // 📊 ENHANCED DISCONNECT HANDLING - match web client logic
      const serverInitiated = ["io server disconnect", "server namespace disconnect"]
      const networkIssues = ["ping timeout", "transport close", "transport error"]
      const clientInitiated = ["io client disconnect", "client namespace disconnect"]

      if (serverInitiated.includes(reason)) {
        if (this.config.debug) {
          console.log("🔄 Server-initiated disconnect, will attempt reconnection")
        }
      } else if (networkIssues.includes(reason)) {
        if (this.config.debug) {
          console.log("⚠️ Network issue detected, checking connection quality")
        }
      } else if (clientInitiated.includes(reason)) {
        if (this.config.debug) {
          console.log("👋 Client-initiated disconnect, normal closure")
        }
        return // Don't attempt automatic reconnection for intentional disconnects
      }

      // Only reconnect for unexpected disconnects
      if (!clientInitiated.includes(reason)) {
        setTimeout(() => {
          if (this.config.debug) {
            console.log("🔄 Attempting to reconnect...")
          }
          this.socket?.connect()
        }, 5000)
      }
    })

    this.socket.on("connect_error", (error: Error) => {
      if (this.config.debug) {
        console.error("❌ Connection failed:", error.message)
        console.log("🔄 Will retry connection...")
      }
    })
  }

  private async discardLocalChanges(): Promise<void> {
    if (!this.isGitRepo) {
      if (this.config.debug) {
        console.log("⚠️ Not a git repository - cannot discard changes")
      }
      this.socket?.emit("git_command_result", {
        projectId: this.config.projectId,
        command: "discard",
        success: false,
        error: "Not a git repository",
      })
      return
    }

    try {
      if (this.watcher) {
        this.watcher.close()
        this.watcher = null
      }

      await execAsync("git reset --hard HEAD")
      await execAsync("git clean -fd")

      this.socket?.emit("git_command_result", {
        projectId: this.config.projectId,
        command: "discard",
        success: true,
      })

      // Устанавливаем cooldown период ПОСЛЕ git операций но ДО запуска file watcher
      this.gitOperationCooldown = true
      if (this.config.debug) {
        console.log("✅ Changes discarded")
        console.log("🔄 Git operation cooldown started (5s)")
      }

      // Запускаем file watcher
      this.startFileWatcher()

      // Снимаем cooldown через 5 секунд
      setTimeout(() => {
        this.gitOperationCooldown = false
        if (this.config.debug) {
          console.log("🔄 Git operation cooldown ended")
        }
      }, 5000)
    } catch (error) {
      console.error("❌ Error discarding changes:", (error as Error).message)
      this.socket?.emit("git_command_result", {
        projectId: this.config.projectId,
        command: "discard",
        success: false,
        error: (error as Error).message,
      })
      this.gitOperationCooldown = false
      this.startFileWatcher()
    }
  }

  private async gitPullWithToken(token: string, repoUrl: string): Promise<void> {
    if (!this.isGitRepo) {
      if (this.config.debug) {
        console.log("⚠️ Not a git repository - cannot pull")
      }
      this.socket?.emit("git_command_result", {
        projectId: this.config.projectId,
        command: "pull",
        success: false,
        error: "Not a git repository",
      })
      return
    }

    try {
      if (this.watcher) {
        this.watcher.close()
        this.watcher = null
      }

      const authenticatedUrl = repoUrl.replace(
        "https://github.com/",
        `https://x-access-token:${token}@github.com/`,
      )

      await execAsync(`git fetch ${authenticatedUrl} main`)
      await execAsync(`git reset --hard FETCH_HEAD`)

      if (this.config.debug) {
        console.log("✅ Synced with latest changes")
      }

      this.socket?.emit("git_command_result", {
        projectId: this.config.projectId,
        command: "pull",
        success: true,
      })

      // Устанавливаем cooldown период ПОСЛЕ git операций но ДО запуска file watcher
      this.gitOperationCooldown = true
      if (this.config.debug) {
        console.log("🔄 Git operation cooldown started (5s)")
      }

      // Запускаем file watcher
      this.startFileWatcher()

      // Снимаем cooldown через 5 секунд
      setTimeout(() => {
        this.gitOperationCooldown = false
        if (this.config.debug) {
          console.log("🔄 Git operation cooldown ended")
        }
      }, 5000)
    } catch (error) {
      console.error("❌ Error syncing:", (error as Error).message)
      this.socket?.emit("git_command_result", {
        projectId: this.config.projectId,
        command: "pull",
        success: false,
        error: (error as Error).message,
      })
      this.gitOperationCooldown = false
      this.startFileWatcher()
    }
  }

  private async updateLocalFiles(files: Array<{ path: string; content: string }>): Promise<void> {
    try {
      if (this.watcher) {
        this.watcher.close()
        this.watcher = null
      }

      for (const file of files) {
        try {
          const dir = path.dirname(file.path)
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
          }

          fs.writeFileSync(file.path, file.content, "utf8")
          if (this.config.debug) {
            console.log(`✅ Updated: ${file.path}`)
          }
        } catch (fileError) {
          console.error(`❌ Error updating file ${file.path}:`, (fileError as Error).message)
        }
      }

      this.socket?.emit("git_command_result", {
        projectId: this.config.projectId,
        command: "update_files",
        success: true,
      })

      this.startFileWatcher()
      if (this.config.debug) {
        console.log("✅ Files updated")
      }
    } catch (error) {
      console.error("❌ Error updating files:", (error as Error).message)
      this.socket?.emit("git_command_result", {
        projectId: this.config.projectId,
        command: "update_files",
        success: false,
        error: (error as Error).message,
      })
      this.startFileWatcher()
    }
  }

  private startFileWatcher(): void {
    if (this.watcher) {
      return
    }

    if (this.config.debug) {
      console.log("👀 Watching for file changes...")
    }

    this.watcher = chokidar.watch(".", {
      ignored: [
        "node_modules/**",
        ".git/**",
        "dist/**",
        "build/**",
        ".next/**",
        ".turbo/**",
        "*.log",
        "phion.js",
        ".env*",
        "*.timestamp-*.mjs",
        "vite.config.*.timestamp-*.mjs",
        "**/*timestamp-*",
        "**/*.timestamp-*.*",
        "*.tmp",
        "*.temp",
        ".vite/**",
      ],
      ignoreInitial: true,
      persistent: true,
    })

    this.watcher.on("change", (filePath: string) => {
      this.handleFileChange(filePath)
    })

    this.watcher.on("add", (filePath: string) => {
      this.handleFileChange(filePath)
    })

    this.watcher.on("unlink", (filePath: string) => {
      this.handleFileDelete(filePath)
    })

    this.watcher.on("error", (error: Error) => {
      console.error("❌ File watcher error:", error)
    })

    // Запускаем отдельный watcher для .env файлов
    this.startEnvWatcher()
  }

  private startEnvWatcher(): void {
    if (this.envWatcher) {
      return
    }

    if (this.config.debug) {
      console.log("🔐 Watching for .env file changes...")
    }

    // Отслеживаем только .env файлы
    this.envWatcher = chokidar.watch(
      [
        ".env",
        ".env.local",
        ".env.development",
        ".env.production",
        ".env.development.local",
        ".env.production.local",
        ".env.test",
        ".env.test.local",
      ],
      {
        ignoreInitial: true,
        persistent: true,
      },
    )

    this.envWatcher.on("change", (filePath: string) => {
      this.handleEnvFileChange(filePath)
    })

    this.envWatcher.on("add", (filePath: string) => {
      this.handleEnvFileChange(filePath)
    })

    this.envWatcher.on("unlink", (filePath: string) => {
      this.handleEnvFileDelete(filePath)
    })

    this.envWatcher.on("error", (error: Error) => {
      console.error("❌ Env watcher error:", error)
    })
  }

  private async handleFileChange(filePath: string): Promise<void> {
    if (!this.isConnected) {
      if (this.config.debug) {
        console.log(`⏳ Not connected, skipping: ${filePath}`)
      }
      return
    }

    // Игнорируем изменения файлов во время git операций
    if (this.gitOperationCooldown) {
      if (this.config.debug) {
        console.log(`🔄 Git operation in progress, skipping file change: ${filePath}`)
      }
      return
    }

    // Additional check to ignore timestamp files that might slip through chokidar
    if (filePath.includes(".timestamp-") || filePath.includes("timestamp-")) {
      if (this.config.debug) {
        console.log(`⏭️ Ignoring timestamp file: ${filePath}`)
      }
      return
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8")
      const hash = crypto.createHash("sha256").update(content).digest("hex")

      if (this.config.debug) {
        console.log(`📝 Syncing: ${filePath}`)
      }

      const fileChange: FileChange = {
        projectId: this.config.projectId,
        filePath: filePath.replace(/\\/g, "/"),
        content: content,
        hash: hash,
        timestamp: Date.now(),
      }

      this.socket?.emit("file_change", fileChange)
    } catch (error) {
      console.error(`❌ Error reading file ${filePath}:`, (error as Error).message)
    }
  }

  private handleFileDelete(filePath: string): void {
    if (!this.isConnected) {
      if (this.config.debug) {
        console.log(`⏳ Queuing deletion: ${filePath} (not connected)`)
      }
      return
    }

    if (this.config.debug) {
      console.log(`🗑️ Deleted: ${filePath}`)
    }

    const fileDelete: FileDelete = {
      projectId: this.config.projectId,
      filePath: filePath.replace(/\\/g, "/"),
      timestamp: Date.now(),
    }

    this.socket?.emit("file_delete", fileDelete)
  }

  private async handleEnvFileChange(filePath: string): Promise<void> {
    if (!this.isConnected) {
      if (this.config.debug) {
        console.log(`⏳ Not connected, skipping env file: ${filePath}`)
      }
      return
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8")

      if (this.config.debug) {
        console.log(`🔐 Syncing env file: ${filePath}`)
      }

      const envFileChange: EnvFileChange = {
        projectId: this.config.projectId,
        filePath: filePath.replace(/\\/g, "/"),
        content: content,
        timestamp: Date.now(),
      }

      this.socket?.emit("env_file_change", envFileChange)
    } catch (error) {
      console.error(`❌ Error reading env file ${filePath}:`, (error as Error).message)
    }
  }

  private handleEnvFileDelete(filePath: string): void {
    if (!this.isConnected) {
      if (this.config.debug) {
        console.log(`⏳ Not connected, skipping env file deletion: ${filePath}`)
      }
      return
    }

    if (this.config.debug) {
      console.log(`🗑️ Env file deleted: ${filePath}`)
    }

    this.socket?.emit("env_file_delete", {
      projectId: this.config.projectId,
      filePath: filePath.replace(/\\/g, "/"),
      timestamp: Date.now(),
    })
  }

  private async openPreviewIfEnabled(): Promise<void> {
    if (this.config.debug) {
      console.log("🔍 Checking if preview should be opened...")
      console.log("📋 Toolbar config:", JSON.stringify(this.config.toolbar, null, 2))
    }

    // Проверяем, включен ли toolbar и autoOpen
    const toolbarConfig = this.config.toolbar
    if (!toolbarConfig?.enabled) {
      if (this.config.debug) {
        console.log("⏭️ Toolbar disabled, skipping preview")
      }
      return
    }

    if (!toolbarConfig?.autoOpen) {
      if (this.config.debug) {
        console.log("⏭️ Auto-open disabled, skipping preview")
      }
      return
    }

    if (this.config.debug) {
      console.log("✅ Preview will be opened in 3 seconds...")
    }

    // Настройки для VS Code
    const vsCodeConfig: VSCodeConfig = {
      autoOpen: true,
      port: 5173, // Vite default port
    }

    // Увеличенная задержка чтобы дать время dev-серверу запуститься
    // и избежать race condition с browser extension
    setTimeout(async () => {
      if (this.config.debug) {
        console.log("🚀 Opening preview now...")
      }
      try {
        await openPreview(vsCodeConfig, this.config.debug)
      } catch (error) {
        if (this.config.debug) {
          console.log("⚠️ Failed to open preview from agent:", (error as Error).message)
        }
        // Don't throw error, just log it - preview might already be opened by extension
      }
    }, 3000) // Increased from 2000 to 3000ms
  }

  stop(): void {
    console.log("🛑 Stopping agent...")

    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }

    if (this.envWatcher) {
      this.envWatcher.close()
      this.envWatcher = null
    }

    if (this.socket) {
      this.socket.disconnect()
    }

    if (this.httpServer) {
      this.httpServer.close()
      this.httpServer = null
    }

    console.log("✅ Stopped")
  }
}
