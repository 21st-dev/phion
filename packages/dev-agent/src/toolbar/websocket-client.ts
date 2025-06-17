import { io, Socket } from "socket.io-client"
import type { ToolbarState, WebSocketEvents, CommitInfo } from "../types"

// Browser-compatible EventEmitter replacement
class EventEmitter {
  private listeners = new Map<string, Function[]>()

  on(event: string, listener: Function): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
    return this
  }

  off(event: string, listener: Function): this {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      const index = eventListeners.indexOf(listener)
      if (index > -1) {
        eventListeners.splice(index, 1)
      }
    }
    return this
  }

  emit(event: string, ...args: any[]): boolean {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach((listener) => {
        try {
          listener(...args)
        } catch (error) {
          console.error("Error in event listener:", error)
        }
      })
      return true
    }
    return false
  }
}

export class ToolbarWebSocketClient extends EventEmitter {
  private socket: Socket | null = null
  private projectId: string
  private websocketUrl: string
  public state: ToolbarState

  constructor(projectId: string, websocketUrl: string) {
    super()
    this.projectId = projectId
    this.websocketUrl = websocketUrl
    this.state = {
      pendingChanges: 0,
      deployStatus: "ready",
      agentConnected: false,
      netlifyUrl: undefined,
      lastCommit: undefined,
      commitHistory: [],
    }
  }

  async connect(): Promise<boolean> {
    try {
      console.log("[Phion Toolbar] Connecting to:", this.websocketUrl)

      this.socket = io(this.websocketUrl, {
        transports: ["websocket", "polling"],
        timeout: 10000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      })

      this.socket.on("connect", () => {
        console.log("[Phion Toolbar] Connected to WebSocket server")
        this.authenticate()
        this.getInitialStatus()
        this.getCommitHistory()
      })

      this.socket.on("disconnect", (reason) => {
        console.log("[Phion Toolbar] Disconnected from WebSocket server:", reason)
      })

      this.socket.on("connect_error", (error) => {
        console.error("[Phion Toolbar] Connection error:", error)
      })

      this.setupEventListeners()

      return new Promise((resolve) => {
        if (this.socket) {
          this.socket.on("connect", () => resolve(true))
          this.socket.on("connect_error", () => resolve(false))
        } else {
          resolve(false)
        }
      })
    } catch (error) {
      console.error("[Phion Toolbar] Failed to connect:", error)
      return false
    }
  }

  private authenticate() {
    if (this.socket) {
      this.socket.emit("authenticate", {
        projectId: this.projectId,
        clientType: "toolbar",
      })
    }
  }

  private getInitialStatus() {
    if (this.socket) {
      this.socket.emit("toolbar_get_status")
    }
  }

  private getCommitHistory(limit = 10, offset = 0) {
    if (this.socket) {
      this.socket.emit("toolbar_get_commit_history", { limit, offset })
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

    this.socket.on(
      "commit_created",
      (data: { commitId: string; message: string; commit: CommitInfo }) => {
        console.log("[Phion Toolbar] Commit created:", data)

        this.state = {
          ...this.state,
          pendingChanges: 0,
          lastCommit: data.commit,
          commitHistory: [data.commit, ...(this.state.commitHistory || [])].slice(0, 10),
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

    this.socket.on(
      "commit_history_response",
      (data: { commits: CommitInfo[]; stats: any; pagination: any }) => {
        console.log("[Phion Toolbar] Commit history received:", data)
        this.state = {
          ...this.state,
          commitHistory: data.commits,
          lastCommit: data.commits[0] || this.state.lastCommit,
        }
        this.emit("stateChange", this.state)
        this.emit("commitHistoryReceived", data)
      },
    )

    this.socket.on("revert_progress", (data) => {
      console.log("[Phion Toolbar] Revert progress:", data)
      this.emit("revertProgress", data)
    })

    this.socket.on("ai_commit_message_generated", (data) => {
      console.log("[Phion Toolbar] AI commit message generated:", data)
      this.emit("aiCommitMessageGenerated", data)
    })

    this.socket.on("pending_changes_updated", (data: { count: number }) => {
      console.log("[Phion Toolbar] Pending changes updated:", data)
      this.state = {
        ...this.state,
        pendingChanges: data.count,
      }
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
  }

  saveAll() {
    if (this.socket) {
      this.socket.emit("save_all_changes")
    }
  }

  saveWithAIMessage() {
    if (this.socket) {
      this.socket.emit("toolbar_save_with_ai_message", { projectId: this.projectId })
    }
  }

  discardAll() {
    if (this.socket) {
      this.socket.emit("discard_all_changes")
    }
  }

  revertToCommit(targetCommitSha: string, commitMessage?: string) {
    if (this.socket) {
      this.socket.emit("toolbar_revert_to_commit", {
        projectId: this.projectId,
        targetCommitSha,
        commitMessage,
      })
    }
  }

  refreshCommitHistory() {
    this.getCommitHistory()
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

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }
}
