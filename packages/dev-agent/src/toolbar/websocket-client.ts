import safeJsonStringify from "safe-json-stringify"
import { io, Socket } from "socket.io-client"
import type { ToolbarState } from "../types"

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
  private errorBuffer: string[] = []
  private readonly MAX_ERROR_BUFFER = 10
  private onErrorBufferChange?: (count: number) => void
  private changedFiles: Set<string> = new Set()

  constructor(projectId: string, websocketUrl: string) {
    this.projectId = projectId
    this.websocketUrl = websocketUrl
  }

  connect(): Promise<boolean> {
    return new Promise((resolve) => {
      // Prevent multiple simultaneous connection attempts
      if (this.socket && this.socket.connected) {
        console.log("[Phion Toolbar] Already connected, returning existing connection")
        resolve(true)
        return
      }

      this.socket = io(this.websocketUrl, {
        transports: ["websocket", "polling"],
        timeout: 30000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        randomizationFactor: 0.5,

        // Enhanced stability settings
        upgrade: true,
        rememberUpgrade: true,
        forceNew: false, // Reuse existing connection if available

        auth: {
          projectId: this.projectId,
        },
      })

      let resolved = false
      const resolveOnce = (result: boolean) => {
        if (!resolved) {
          resolved = true
          resolve(result)
        }
      }

      // Set a timeout for the entire connection process
      const connectionTimeout = setTimeout(() => {
        console.log("[Phion Toolbar] Connection timeout after 25 seconds")
        resolveOnce(false)
      }, 25000)

      this.socket.on("connect", () => {
        console.log("[Phion Toolbar] Connected to WebSocket server")
        this.authenticate()
        this.setupErrorHandlers()
        this.flushErrorBuffer()
      })

      this.socket.on("authenticated", (data: { success: boolean }) => {
        clearTimeout(connectionTimeout)
        if (data.success) {
          console.log("[Phion Toolbar] Authenticated successfully")
          this.setupEventListeners()
          this.requestStatus()
          resolveOnce(true)
        } else {
          console.error("[Phion Toolbar] Authentication failed")
          resolveOnce(false)
        }
      })

      this.socket.on("connect_error", (error) => {
        console.error("[Phion Toolbar] Connection error:", error)
        clearTimeout(connectionTimeout)
        resolveOnce(false)
      })

      this.socket.on("disconnect", (reason: string) => {
        console.log(`[Phion Toolbar] Disconnected from WebSocket server: ${reason}`)

        // Enhanced disconnect handling with more context
        const disconnectReasons = {
          "transport close": "Network connection lost",
          "client namespace disconnect": "Client initiated disconnect",
          "server namespace disconnect": "Server initiated disconnect",
          "ping timeout": "Connection became unresponsive",
          "transport error": "Transport-level error occurred",
        }

        const reasonDescription =
          disconnectReasons[reason as keyof typeof disconnectReasons] || reason
        console.log(`[Phion Toolbar] Disconnect reason: ${reasonDescription}`)

        // 📊 ENHANCED DISCONNECT HANDLING
        const clientInitiated = ["io client disconnect", "client namespace disconnect"]

        this.state = {
          ...this.state,
          agentConnected: false,
        }
        this.emit("stateChange", this.state)

        // Only attempt reconnection for unexpected disconnects
        if (!clientInitiated.includes(reason)) {
          console.log(
            `[Phion Toolbar] Will attempt to reconnect after unexpected disconnect: ${reason}`,
          )
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

    this.socket.on(
      "file_change_staged",
      (data: { file?: string; filePath?: string; action: string; timestamp?: number }) => {
        console.log("[Phion Toolbar] File change staged:", data)

        const filePath = data.filePath || data.file || "unknown"

        // Add file to set of changed files
        this.changedFiles.add(filePath)

        // Clear error buffer on file changes since errors might be fixed
        if (this.errorBuffer.length > 0) {
          console.log("[Phion Toolbar] Clearing error buffer due to file change")
          this.clearErrorBuffer()
        }

        // Update counter based on number of unique files
        this.state = {
          ...this.state,
          pendingChanges: this.changedFiles.size,
        }
        this.emit("stateChange", this.state)
      },
    )

    this.socket.on(
      "commit_created",
      (data: { commitId: string; message: string; commit?: any }) => {
        // Clear set of changed files after commit
        this.changedFiles.clear()

        this.state = {
          ...this.state,
          pendingChanges: 0,
          lastCommit: data.commit || this.state.lastCommit,
        }
        this.emit("stateChange", this.state)
        this.emit("commitCreated", data)
      },
    )

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
      this.emit("saveSuccess")
    })

    this.socket.on("discard_success", () => {
      console.log("[Phion Toolbar] Discard success")

      // Clear set of changed files after cancellation
      this.changedFiles.clear()

      this.state = {
        ...this.state,
        pendingChanges: 0,
      }
      this.emit("stateChange", this.state)
      this.emit("discardSuccess")
    })

    this.socket.on("toolbar_status", (status: ToolbarState) => {
      console.log("[Phion Toolbar] Status update:", status)

      // Synchronize local set with server state
      if (status.pendingChanges === 0) {
        this.changedFiles.clear()
      }

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

    // Add error confirmation handler
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

    // Intercept synchronous JavaScript errors
    window.addEventListener(
      "error",
      (event: ErrorEvent) => {
        this.handleRuntimeError({
          eventType: "error",
          event: event,
          error: event.error,
          source: "window.error",
        })
      },
      true,
    )

    // Intercept unhandled Promise errors
    window.addEventListener(
      "unhandledrejection",
      (event: PromiseRejectionEvent) => {
        this.handleRuntimeError({
          eventType: "unhandledrejection",
          event: event,
          reason: event.reason,
          source: "unhandledrejection",
        })
      },
      true,
    )

    // Intercept resource errors (images, scripts, etc.)
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
            eventType: "resource.error",
            event: event,
            target: target,
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
  private handleRuntimeError(errorInfo: any) {
    try {
      // Try to extract filename for filtering (fallback to empty string if not available)
      const errorFilename = errorInfo?.event?.filename || errorInfo?.filename || ""

      // Ignore errors that have "chunk" in filename
      if (errorFilename.toLowerCase().includes("chunk")) {
        return
      }

      // Log raw error info before serialization
      console.log("[Phion Toolbar] Raw error info before serialization:", errorInfo)

      // Extract error properties that might not be enumerable
      const enhancedErrorInfo = {
        ...errorInfo,
        // Extract error properties from nested error objects
        ...(errorInfo.error && {
          error: {
            ...errorInfo.error,
            message: errorInfo.error.message,
            stack: errorInfo.error.stack,
            name: errorInfo.error.name,
          },
        }),
        // Extract error properties from event.error if available
        ...(errorInfo.event?.error && {
          event: {
            ...errorInfo.event,
            error: {
              ...errorInfo.event.error,
              message: errorInfo.event.error.message,
              stack: errorInfo.event.error.stack,
              name: errorInfo.event.error.name,
            },
          },
        }),
        // Extract message from event if available
        ...(errorInfo.event?.message && {
          event: {
            ...errorInfo.event,
            message: errorInfo.event.message,
            filename: errorInfo.event.filename,
            lineno: errorInfo.event.lineno,
            colno: errorInfo.event.colno,
          },
        }),
        // Extract reason if it's an error object (for unhandledrejection)
        ...(errorInfo.reason &&
          typeof errorInfo.reason === "object" && {
            reason: {
              ...errorInfo.reason,
              message: errorInfo.reason.message,
              stack: errorInfo.reason.stack,
              name: errorInfo.reason.name,
            },
          }),
      }

      // Serialize the enhanced error info
      const serializedErrorInfo = safeJsonStringify(enhancedErrorInfo)

      console.log("[Phion Toolbar] Serialized error info:", serializedErrorInfo)

      const payload = serializedErrorInfo

      // ALWAYS buffer error locally for "Fix errors" button
      this.bufferError(payload as any)

      // If WebSocket is connected, also send to server for logging
      if (this.socket && this.socket.connected) {
        this.sendRuntimeError(payload as any)
      }
    } catch (err) {
      console.error("[Phion Toolbar] Error handling runtime error:", err)
    }
  }

  /**
   * Отправка runtime ошибки на сервер (теперь буферизуется вместо прямой отправки)
   */
  private sendRuntimeError(payload: string) {
    if (this.socket && this.socket.connected) {
      console.log("[Phion Toolbar] Sending runtime error with serialized data")
      this.socket.emit("toolbar_runtime_error", payload)
    }
  }

  /**
   * Отправка события insert_prompt с буферизованными ошибками
   */
  sendInsertPrompt() {
    console.log(`[Phion Toolbar] sendInsertPrompt called. Buffer size: ${this.errorBuffer.length}`)

    if (!this.socket || !this.socket.connected) {
      console.error("[Phion Toolbar] Cannot send insert_prompt - not connected")
      return
    }

    if (this.errorBuffer.length === 0) {
      console.log("[Phion Toolbar] No errors in buffer to send")
      return
    }

    // Log the raw error buffer before processing
    console.log("[Phion Toolbar] Raw error buffer before processing:", this.errorBuffer)

    // Create prompt from all errors in buffer (using serialized data)
    const errorMessages = this.errorBuffer
      .map((errorData, index) => {
        return `${index + 1}. Runtime Error:
${errorData}`
      })
      .join("\n\n")

    const prompt = `Fix these runtime errors that occurred in my application:

${errorMessages}

Please analyze these serialized errors and provide fixes for the underlying issues. Focus on the root causes and provide specific code changes needed.`

    console.log(`[Phion Toolbar] Sending insert_prompt with ${this.errorBuffer.length} errors`)
    console.log("[Phion Toolbar] Generated prompt:", prompt)

    this.socket.emit("insert_prompt", {
      projectId: this.projectId,
      prompt: prompt,
    })

    // Clear buffer after sending
    this.clearErrorBuffer()
  }

  /**
   * Очистка буфера ошибок с уведомлением UI
   */
  private clearErrorBuffer() {
    this.errorBuffer = []

    // Notify UI about error buffer being cleared
    if (this.onErrorBufferChange) {
      this.onErrorBufferChange(0)
    }
  }

  /**
   * Буферизация ошибки для отправки после подключения
   */
  private bufferError(payload: string) {
    this.errorBuffer.push(payload)

    // Limit buffer size
    if (this.errorBuffer.length > this.MAX_ERROR_BUFFER) {
      this.errorBuffer.shift()
    }

    console.log(
      `[Phion Toolbar] Buffered runtime error (${this.errorBuffer.length}/${this.MAX_ERROR_BUFFER})`,
    )

    // Log the actual error data being buffered
    console.log("[Phion Toolbar] Error buffer entry:", payload)

    // Notify UI about error count change via callback
    if (this.onErrorBufferChange) {
      this.onErrorBufferChange(this.errorBuffer.length)
    }
  }

  /**
   * Отправка буферизованных ошибок после подключения
   */
  private flushErrorBuffer() {
    if (this.errorBuffer.length === 0) return

    console.log(`[Phion Toolbar] Flushing ${this.errorBuffer.length} buffered errors to server`)

    // Send all buffered errors to server, but DON'T clear buffer
    // (errors should remain for "Fix errors" button)
    this.errorBuffer.forEach((error) => {
      this.sendRuntimeError(error)
    })
  }

  /**
   * Публичный метод для ручной отправки ошибки
   */
  reportError(error: Error, context?: string) {
    this.handleRuntimeError({
      eventType: "manual",
      error: error,
      context: context,
      source: "manual",
    })
  }

  /**
   * Получить текущий размер буфера ошибок (для отладки)
   */
  getErrorBufferSize(): number {
    return this.errorBuffer.length
  }

  /**
   * Установить callback для уведомления об изменении буфера ошибок
   */
  setErrorBufferChangeCallback(callback: (count: number) => void) {
    this.onErrorBufferChange = callback
  }
}
