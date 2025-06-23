import { io, Socket } from "socket.io-client"
import type { ToolbarState, WebSocketEvents, RuntimeErrorPayload } from "../types"

export class ToolbarWebSocketClient {
  private socket: Socket | null = null
  private projectId: string
  private websocketUrl: string
  private listeners: Map<string, Function[]> = new Map()
  private state: ToolbarState = {
    pendingChanges: 0,
    deployStatus: "ready",
    agentConnected: false,
    netlifyUrl: undefined,
  }
  private errorHandlersInstalled = false
  private errorBuffer: RuntimeErrorPayload[] = []
  private readonly MAX_ERROR_BUFFER = 10

  constructor(projectId: string, websocketUrl: string) {
    this.projectId = projectId
    this.websocketUrl = websocketUrl
  }

  connect(): Promise<boolean> {
    return new Promise((resolve) => {
      this.socket = io(this.websocketUrl, {
        transports: ["websocket", "polling"],
        timeout: 30000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        randomizationFactor: 0.5,

        upgrade: true,
        rememberUpgrade: true,

        auth: {
          projectId: this.projectId,
        },
      })

      this.socket.on("connect", () => {
        console.log("[Phion Toolbar] Connected to WebSocket server")
        this.authenticate()
        this.setupErrorHandlers()
        this.flushErrorBuffer()
      })

      this.socket.on("authenticated", (data: { success: boolean }) => {
        if (data.success) {
          console.log("[Phion Toolbar] Authenticated successfully")
          this.setupEventListeners()
          this.requestStatus()
          resolve(true)
        } else {
          console.error("[Phion Toolbar] Authentication failed")
          resolve(false)
        }
      })

      this.socket.on("connect_error", (error) => {
        console.error("[Phion Toolbar] Connection error:", error)
        resolve(false)
      })

      this.socket.on("disconnect", (reason: string) => {
        console.log(`[Phion Toolbar] Disconnected from WebSocket server: ${reason}`)

        // 📊 ENHANCED DISCONNECT HANDLING
        const clientInitiated = ["io client disconnect", "client namespace disconnect"]

        this.state = {
          ...this.state,
          agentConnected: false,
        }
        this.emit("stateChange", this.state)

        // Log disconnect reason for debugging
        if (!clientInitiated.includes(reason)) {
          console.log(`[Phion Toolbar] Unexpected disconnect: ${reason}`)
        }
      })
    })
  }

  private authenticate() {
    if (this.socket) {
      this.socket.emit("authenticate", {
        projectId: this.projectId,
        clientType: "toolbar",
      })
    }
  }

  private setupEventListeners() {
    if (!this.socket) return

    const processedFiles = new Set<string>()

    this.socket.on(
      "file_change_staged",
      (data: { file?: string; filePath?: string; action: string; timestamp?: number }) => {
        console.log("[Phion Toolbar] File change staged:", data)

        const filePath = data.filePath || data.file || "unknown"
        const changeKey = `${filePath}:${data.timestamp || Date.now()}`

        if (processedFiles.has(changeKey)) {
          console.log("[Phion Toolbar] Skipping duplicate file change:", changeKey)
          return
        }

        processedFiles.add(changeKey)

        if (processedFiles.size > 100) {
          const entries = Array.from(processedFiles)
          entries.slice(0, 50).forEach((key) => processedFiles.delete(key))
        }

        this.state = {
          ...this.state,
          pendingChanges: this.state.pendingChanges + 1,
        }
        this.emit("stateChange", this.state)
      },
    )

    this.socket.on("commit_created", (data: { commitId: string; message: string }) => {
      this.state = {
        ...this.state,
        pendingChanges: 0,
      }
      this.emit("stateChange", this.state)
      this.emit("commitCreated", data)
    })

    this.socket.on("deploy_status_update", (data: { status: string; url?: string }) => {
      this.state = {
        ...this.state,
        deployStatus: data.status as ToolbarState["deployStatus"],
        netlifyUrl: data.url || this.state.netlifyUrl,
      }
      this.emit("stateChange", this.state)
    })

    this.socket.on("save_success", () => {
      console.log("[Phion Toolbar] Save success")
      this.state = {
        ...this.state,
        pendingChanges: 0,
      }
      this.emit("stateChange", this.state)
      this.emit("saveSuccess")
    })

    this.socket.on("discard_success", () => {
      console.log("[Phion Toolbar] Discard success")
      this.state = {
        ...this.state,
        pendingChanges: 0,
      }
      this.emit("stateChange", this.state)
      this.emit("discardSuccess")
    })

    this.socket.on("toolbar_status", (status: ToolbarState) => {
      console.log("[Phion Toolbar] Status update:", status)
      this.state = { ...this.state, ...status }
      this.emit("stateChange", this.state)
    })

    this.socket.on("agent_connected", () => {
      this.state = {
        ...this.state,
        agentConnected: true,
      }
      this.emit("stateChange", this.state)
    })

    this.socket.on("agent_disconnected", () => {
      this.state = {
        ...this.state,
        agentConnected: false,
      }
      this.emit("stateChange", this.state)
    })

    this.socket.on(
      "toolbar_update_available",
      (data: { version: string; forceUpdate?: boolean; releaseNotes?: string }) => {
        console.log(`[Phion Toolbar] Update available: ${data.version}`)
        this.emit("updateAvailable", data)
      },
    )

    this.socket.on("toolbar_force_update", (data: { version: string; reason?: string }) => {
      console.log(`[Phion Toolbar] Force update required: ${data.version}`)
      this.emit("forceUpdate", data)
    })

    this.socket.on("toolbar_reload", (data: { reason?: string }) => {
      console.log("[Phion Toolbar] Reload requested from server")
      this.emit("reloadRequested", data)
    })

    this.socket.on(
      "server_maintenance",
      (data: { message: string; estimatedDuration?: number; maintenanceStart?: string }) => {
        this.emit("serverMaintenance", data)
      },
    )

    this.socket.on(
      "toolbar_preview_response",
      (data: { success: boolean; url?: string; error?: string; projectId?: string }) => {
        console.log("[Phion Toolbar] Preview response:", data)
        this.emit("previewResponse", data)
      },
    )

    // Добавляем обработчик подтверждения получения ошибки
    this.socket.on("runtime_error_received", (data: { success: boolean; errorId?: string }) => {
      if (data.success) {
        console.log("[Phion Toolbar] Runtime error sent successfully:", data.errorId)
      } else {
        console.error("[Phion Toolbar] Failed to send runtime error")
      }
    })
  }

  private requestStatus() {
    if (this.socket) {
      this.socket.emit("toolbar_get_status")
    }
  }

  saveAll() {
    if (this.socket) {
      this.socket.emit("save_all_changes")
    }
  }

  discardAll() {
    if (this.socket) {
      this.socket.emit("discard_all_changes")
    }
  }

  openPreview() {
    if (this.state.netlifyUrl) {
      window.open(this.state.netlifyUrl, "_blank")
    }
  }

  requestPreview() {
    if (this.socket) {
      console.log("[Phion Toolbar] Requesting preview via WebSocket...")
      this.socket.emit("toolbar_open_preview")
    }
  }

  checkForUpdates() {
    if (this.socket) {
      this.socket.emit("toolbar_check_updates")
    }
  }

  acknowledgeUpdate(version: string) {
    if (this.socket) {
      this.socket.emit("toolbar_update_acknowledged", { version })
    }
  }

  reportUpdateSuccess(version: string) {
    if (this.socket) {
      this.socket.emit("toolbar_update_success", { version })
    }
  }

  reportUpdateError(version: string, error: string) {
    if (this.socket) {
      this.socket.emit("toolbar_update_error", { version, error })
    }
  }

  getState(): ToolbarState {
    return { ...this.state }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  off(event: string, callback: Function) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      const index = eventListeners.indexOf(callback)
      if (index > -1) {
        eventListeners.splice(index, 1)
      }
    }
  }

  private emit(event: string, data?: any) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach((callback) => callback(data))
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.listeners.clear()
  }

  /**
   * Настройка глобальных обработчиков ошибок браузера
   */
  private setupErrorHandlers() {
    if (this.errorHandlersInstalled) return

    console.log("[Phion Toolbar] Setting up runtime error handlers")

    // Перехват синхронных JavaScript ошибок
    window.addEventListener(
      "error",
      (event: ErrorEvent) => {
        this.handleRuntimeError({
          message: event.message,
          stack: event.error?.stack,
          fileName: event.filename,
          lineNumber: event.lineno,
          columnNumber: event.colno,
          source: "window.error",
        })
      },
      true,
    )

    // Перехват необработанных Promise ошибок
    window.addEventListener(
      "unhandledrejection",
      (event: PromiseRejectionEvent) => {
        const error = event.reason
        this.handleRuntimeError({
          message: error?.message || String(error),
          stack: error?.stack,
          source: "unhandledrejection",
        })
      },
      true,
    )

    // Перехват ошибок ресурсов (изображения, скрипты и т.д.)
    window.addEventListener(
      "error",
      (event: Event) => {
        const target = event.target
        if (
          target &&
          target !== window &&
          target instanceof HTMLElement &&
          (target.tagName === "IMG" || target.tagName === "SCRIPT" || target.tagName === "LINK")
        ) {
          this.handleRuntimeError({
            message: `Resource failed to load: ${target.tagName}`,
            fileName: (target as any).src || (target as any).href,
            source: "resource.error",
          })
        }
      },
      true,
    )

    this.errorHandlersInstalled = true
  }

  /**
   * Обработка runtime ошибки и отправка на сервер
   */
  private handleRuntimeError(errorInfo: {
    message: string
    stack?: string
    fileName?: string
    lineNumber?: number
    columnNumber?: number
    source?: string
  }) {
    try {
      // Фильтруем некоторые распространенные и неважные ошибки
      if (this.shouldIgnoreError(errorInfo.message)) {
        return
      }

      const payload: RuntimeErrorPayload = {
        projectId: this.projectId,
        clientType: "toolbar",
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        error: errorInfo,
        context: {
          toolbarVersion: (window as any).PHION_CONFIG?.version || "unknown",
          browserInfo: {
            language: navigator.language,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine,
          },
          pageInfo: {
            title: document.title,
            referrer: document.referrer,
            pathname: window.location.pathname,
          },
        },
      }

      // Если WebSocket не подключен, буферизуем ошибку
      if (!this.socket || !this.socket.connected) {
        this.bufferError(payload)
        return
      }

      this.sendRuntimeError(payload)
    } catch (err) {
      console.error("[Phion Toolbar] Error handling runtime error:", err)
    }
  }

  /**
   * Отправка runtime ошибки на сервер
   */
  private sendRuntimeError(payload: RuntimeErrorPayload) {
    if (this.socket && this.socket.connected) {
      console.log("[Phion Toolbar] Sending runtime error:", payload.error.message)
      this.socket.emit("toolbar_runtime_error", payload)
    }
  }

  /**
   * Буферизация ошибки для отправки после подключения
   */
  private bufferError(payload: RuntimeErrorPayload) {
    this.errorBuffer.push(payload)

    // Ограничиваем размер буфера
    if (this.errorBuffer.length > this.MAX_ERROR_BUFFER) {
      this.errorBuffer.shift()
    }

    console.log(
      `[Phion Toolbar] Buffered runtime error (${this.errorBuffer.length}/${this.MAX_ERROR_BUFFER}):`,
      payload.error.message,
    )
  }

  /**
   * Отправка буферизованных ошибок после подключения
   */
  private flushErrorBuffer() {
    if (this.errorBuffer.length === 0) return

    console.log(`[Phion Toolbar] Flushing ${this.errorBuffer.length} buffered errors`)

    const errors = [...this.errorBuffer]
    this.errorBuffer = []

    errors.forEach((error) => {
      this.sendRuntimeError(error)
    })
  }

  /**
   * Фильтрация неважных ошибок
   */
  private shouldIgnoreError(message: string): boolean {
    const ignoredPatterns = [
      "Script error",
      "Non-Error promise rejection captured",
      "ResizeObserver loop limit exceeded",
      "Network request failed",
      "Loading chunk",
      "ChunkLoadError",
      // Добавьте другие паттерны ошибок, которые нужно игнорировать
    ]

    return ignoredPatterns.some((pattern) => message.toLowerCase().includes(pattern.toLowerCase()))
  }

  /**
   * Публичный метод для ручной отправки ошибки
   */
  reportError(error: Error, context?: string) {
    this.handleRuntimeError({
      message: error.message,
      stack: error.stack,
      source: context || "manual",
    })
  }
}
