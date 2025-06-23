import { io, Socket } from "socket.io-client"
import * as vscode from "vscode"

interface RuntimeError {
  errorId: string
  projectId: string
  timestamp: number
  error: {
    message: string
    source?: string
    fileName?: string
    lineNumber?: number
  }
  context: {
    url: string
    toolbarVersion?: string
  }
}

export class PhionWebSocketClient {
  private socket: Socket | null = null
  private projectId: string | null = null
  private websocketUrl: string
  private outputChannel: vscode.OutputChannel
  private isConnected: boolean = false

  constructor(websocketUrl: string = "ws://localhost:8080") {
    this.websocketUrl = websocketUrl
    this.outputChannel = vscode.window.createOutputChannel("Phion Runtime Errors")
  }

  async connect(projectId: string): Promise<boolean> {
    if (this.isConnected && this.projectId === projectId) {
      console.log(`[Phion VSCode] Already connected to project ${projectId}`)
      return true
    }

    console.log(`[Phion VSCode] Attempting to connect to WebSocket server for project ${projectId}`)
    console.log(`[Phion VSCode] WebSocket URL: ${this.websocketUrl}`)

    this.projectId = projectId

    return new Promise((resolve) => {
      this.socket = io(this.websocketUrl, {
        transports: ["websocket", "polling"],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 2000,
        auth: {
          projectId: this.projectId,
        },
      })

      console.log(`[Phion VSCode] Socket.IO client created, waiting for connection...`)

      this.socket.on("connect", () => {
        console.log("[Phion VSCode] ✅ Connected to WebSocket server, sending authentication...")
        this.authenticate()
      })

      this.socket.on("authenticated", (data: { success: boolean }) => {
        console.log("[Phion VSCode] 🔐 Authentication response received:", data)
        if (data.success) {
          console.log("[Phion VSCode] ✅ Authenticated successfully")
          this.isConnected = true
          this.setupEventListeners()
          resolve(true)
        } else {
          console.error("[Phion VSCode] ❌ Authentication failed")
          this.isConnected = false
          resolve(false)
        }
      })

      this.socket.on("connect_error", (error) => {
        console.error("[Phion VSCode] ❌ Connection error:", error)
        this.isConnected = false
        resolve(false)
      })

      this.socket.on("disconnect", (reason: string) => {
        console.log(`[Phion VSCode] ❌ Disconnected from WebSocket server: ${reason}`)
        this.isConnected = false
      })
    })
  }

  private authenticate() {
    if (this.socket && this.projectId) {
      console.log(
        `[Phion VSCode] 🔐 Sending authentication for project ${this.projectId} as vscode-extension`,
      )
      this.socket.emit("authenticate", {
        projectId: this.projectId,
        clientType: "vscode-extension",
      })
    }
  }

  private setupEventListeners() {
    if (!this.socket) return

    // Log all incoming messages for debugging
    this.socket.onAny((eventName: string, ...args: any[]) => {
      console.log(`[Phion VSCode] 📨 Received WebSocket event: ${eventName}`, args)
    })

    // Listen for runtime errors broadcasted by the server (now proxied directly)
    this.socket.on("toolbar_runtime_error", (payload: string) => {
      console.log("[Phion VSCode] 🐛 Runtime error event received (serialized):", payload)
      this.handleRuntimeError(payload)
    })

    // Listen for other common events and log them
    this.socket.on("file_change_staged", (data: any) => {
      console.log("[Phion VSCode] 📝 File change staged:", data)
    })

    this.socket.on("commit_created", (data: any) => {
      console.log("[Phion VSCode] 📋 Commit created:", data)
    })

    this.socket.on("deploy_status_update", (data: any) => {
      console.log("[Phion VSCode] 🚀 Deploy status update:", data)
    })

    this.socket.on("save_success", (data: any) => {
      console.log("[Phion VSCode] 💾 Save success:", data)
    })

    this.socket.on("discard_success", (data: any) => {
      console.log("[Phion VSCode] 🗑️ Discard success:", data)
    })

    this.socket.on("toolbar_status", (data: any) => {
      console.log("[Phion VSCode] 📊 Toolbar status:", data)
    })

    this.socket.on("agent_connected", (data: any) => {
      console.log("[Phion VSCode] 🤖 Agent connected:", data)
    })

    this.socket.on("agent_disconnected", (data: any) => {
      console.log("[Phion VSCode] 🤖 Agent disconnected:", data)
    })

    this.socket.on("error", (data: any) => {
      console.error("[Phion VSCode] ❌ WebSocket error:", data)
    })

    // Log connection status changes
    this.socket.on("connect", () => {
      console.log("[Phion VSCode] ✅ WebSocket connected")
    })

    this.socket.on("disconnect", (reason: string) => {
      console.log(`[Phion VSCode] ❌ WebSocket disconnected: ${reason}`)
    })

    this.socket.on("reconnect", (attemptNumber: number) => {
      console.log(`[Phion VSCode] 🔄 WebSocket reconnected after ${attemptNumber} attempts`)
    })

    this.socket.on("reconnect_attempt", (attemptNumber: number) => {
      console.log(`[Phion VSCode] 🔄 WebSocket reconnection attempt ${attemptNumber}`)
    })

    this.socket.on("reconnect_error", (error: any) => {
      console.error("[Phion VSCode] ❌ WebSocket reconnection error:", error)
    })

    this.socket.on("reconnect_failed", () => {
      console.error("[Phion VSCode] ❌ WebSocket reconnection failed")
    })

    // Listen for insert_prompt events
    this.socket.on("insert_prompt", (data: { projectId: string; prompt: string }) => {
      console.log("[Phion VSCode] 💬 Insert prompt event received:", data.prompt)
      this.handleInsertPrompt(data.prompt)
    })
  }

  private handleRuntimeError(serializedPayload: string) {
    try {
      console.log("[Phion VSCode] Runtime error received (serialized):", serializedPayload)

      // Format error message for output channel - just print the serialized string as-is
      const timestamp = new Date().toLocaleTimeString()
      const formattedMessage = `[${timestamp}] Runtime Error (Serialized):\n${serializedPayload}\n\n`

      // Show in output channel
      this.outputChannel.appendLine(formattedMessage)

      // Show notification with error preview
      const errorPreview =
        serializedPayload.length > 100
          ? serializedPayload.substring(0, 100) + "..."
          : serializedPayload

      vscode.window
        .showInformationMessage(`Runtime Error: ${errorPreview}`, "Show Details", "Dismiss")
        .then((selection) => {
          if (selection === "Show Details") {
            this.outputChannel.show()
          }
        })
    } catch (err) {
      console.error("[Phion VSCode] Error handling runtime error:", err)
      // Fallback: just log the raw payload
      this.outputChannel.appendLine(
        `[${new Date().toLocaleTimeString()}] Handler Error: ${serializedPayload}\n`,
      )
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.isConnected = false
    this.projectId = null
  }

  isConnectedToProject(projectId: string): boolean {
    return this.isConnected && this.projectId === projectId
  }

  showOutputChannel() {
    this.outputChannel.show()
  }

  private async handleInsertPrompt(prompt: string) {
    try {
      console.log("[Phion VSCode] Handling insert prompt:", prompt)

      // Import dispatchAgentCall dynamically to avoid circular dependencies
      const { dispatchAgentCall } = await import("./dispatch-agent-call")

      await dispatchAgentCall({
        prompt: prompt,
        mode: "agent",
      })

      console.log("[Phion VSCode] ✅ Prompt dispatched successfully")
    } catch (error) {
      console.error("[Phion VSCode] ❌ Failed to dispatch prompt:", error)
      vscode.window.showErrorMessage(`Failed to dispatch prompt: ${(error as Error).message}`)
    }
  }
}
