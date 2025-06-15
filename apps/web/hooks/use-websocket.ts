"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { io, Socket } from "socket.io-client"

interface UseWebSocketOptions {
  projectId?: string
  onFileTracked?: (data: any) => void
  onSaveSuccess?: (data: any) => void
  onError?: (error: any) => void
  onAgentConnected?: (data: { projectId: string; clientId: string; timestamp: string }) => void
  onAgentDisconnected?: (data: { projectId: string; clientId: string; timestamp: string }) => void
  onDeployStatusUpdate?: (data: {
    projectId: string
    status: string
    url?: string
    error?: string
    timestamp: string
  }) => void
  onInitializationProgress?: (data: {
    projectId: string
    stage: string
    progress: number
    message: string
  }) => void
  onCommitCreated?: (data: { projectId: string; commit: any; timestamp: number }) => void
}

export function useWebSocket({
  projectId,
  onFileTracked,
  onSaveSuccess,
  onError,
  onAgentConnected,
  onAgentDisconnected,
  onDeployStatusUpdate,
  onInitializationProgress,
  onCommitCreated,
}: UseWebSocketOptions) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const isConnecting = useRef(false)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  // 🚫 DEDUPLICATION: Track connection state to prevent multiple connections
  const connectionId = useRef<string>() // Unique connection ID
  const lastProjectId = useRef<string>()
  const connectionTimeout = useRef<NodeJS.Timeout>()

  // 🎯 GENERATE UNIQUE CONNECTION ID for deduplication
  useEffect(() => {
    if (projectId && projectId !== lastProjectId.current) {
      connectionId.current = `${projectId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      lastProjectId.current = projectId
      console.log(`🔑 [WebSocket] Generated connection ID: ${connectionId.current}`)
    }
  }, [projectId])

  // Create stable callbacks to avoid reconnections on callback changes
  const stableCallbacks = useRef({
    onFileTracked,
    onSaveSuccess,
    onError,
    onAgentConnected,
    onAgentDisconnected,
    onDeployStatusUpdate,
    onInitializationProgress,
    onCommitCreated,
  })

  // Update stable callbacks without causing reconnection
  useEffect(() => {
    stableCallbacks.current = {
      onFileTracked,
      onSaveSuccess,
      onError,
      onAgentConnected,
      onAgentDisconnected,
      onDeployStatusUpdate,
      onInitializationProgress,
      onCommitCreated,
    }
  })

  const disconnect = useCallback(() => {
    if (socket) {
      console.log("🛑 [WebSocket] Manually disconnecting...")
      socket.disconnect()
      setSocket(null)
      setIsConnected(false)
      isConnecting.current = false
    }
  }, [socket])

  useEffect(() => {
    // 🚫 PREVENT MULTIPLE CONNECTIONS
    if (!projectId || isConnecting.current) {
      console.log(
        `⏭️ [WebSocket] Skipping connection - projectId: ${!!projectId}, isConnecting: ${isConnecting.current}`,
      )
      return
    }

    // 🚫 PREVENT DUPLICATE CONNECTIONS from React Strict Mode
    if (socket && socket.connected) {
      console.log(`⏭️ [WebSocket] Already connected for project ${projectId}, skipping`)
      return
    }

    console.log(
      `🔌 [WebSocket] Initializing connection for project: ${projectId} (ID: ${connectionId.current})`,
    )
    isConnecting.current = true

    // 🕐 DEBOUNCE: Delay connection to handle rapid re-renders
    if (connectionTimeout.current) {
      clearTimeout(connectionTimeout.current)
    }

    connectionTimeout.current = setTimeout(() => {
      if (!isConnecting.current) {
        console.log("🚫 [WebSocket] Connection cancelled during debounce")
        return
      }

      console.log(`🚀 [WebSocket] Creating socket connection (ID: ${connectionId.current})`)

      // Создаем новое подключение
      const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080", {
        transports: ["websocket", "polling"], // Support both transports for reliability
        autoConnect: true,
        timeout: 30000, // 30 seconds - increased from 5 seconds for production
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000, // Max 10 seconds between attempts
        randomizationFactor: 0.5, // Add jitter to reconnection attempts
        forceNew: false, // Allow connection reuse

        // 🚀 PRODUCTION SETTINGS - match server configuration
        upgrade: true,
        rememberUpgrade: true,

        // Enable connection state recovery
        auth: {
          projectId, // Include projectId in handshake for better routing
          connectionId: connectionId.current, // Add unique connection ID
        },
      })

      newSocket.on("connect", () => {
        console.log("✅ [WebSocket] Connected to server")
        setIsConnected(true)
        setConnectionError(null)
        reconnectAttempts.current = 0
        isConnecting.current = false

        // Аутентификация при подключении
        console.log("🔐 [WebSocket] Authenticating for project:", projectId)
        newSocket.emit("authenticate", {
          projectId,
          clientType: "web",
        })
      })

      newSocket.on("authenticated", (data) => {
        console.log("✅ [WebSocket] Authenticated:", data)
      })

      newSocket.on("disconnect", (reason) => {
        console.log("❌ [WebSocket] Disconnected:", reason)
        setIsConnected(false)
        isConnecting.current = false

        // 📊 ENHANCED DISCONNECT HANDLING with reason analysis
        const serverInitiated = ["io server disconnect", "server namespace disconnect"]
        const networkIssues = ["ping timeout", "transport close", "transport error"]
        const clientInitiated = ["io client disconnect", "client namespace disconnect"]

        if (serverInitiated.includes(reason)) {
          console.log("🔄 [WebSocket] Server-initiated disconnect, will attempt reconnection")
          setConnectionError("Server disconnected, reconnecting...")
        } else if (networkIssues.includes(reason)) {
          console.log("⚠️ [WebSocket] Network issue detected, checking connection quality")
          setConnectionError("Connection issue detected, reconnecting...")
        } else if (clientInitiated.includes(reason)) {
          console.log("👋 [WebSocket] Client-initiated disconnect, normal closure")
          setConnectionError(null)
          return // Don't attempt reconnection for intentional disconnects
        }

        // Smart reconnection logic - only for unexpected disconnects
        if (!clientInitiated.includes(reason) && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000) // Exponential backoff, max 10s
          setTimeout(() => {
            reconnectAttempts.current++
            console.log(
              `🔄 [WebSocket] Reconnection attempt ${reconnectAttempts.current}/${maxReconnectAttempts} (delay: ${delay}ms)`,
            )
            newSocket.connect()
          }, delay)
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.error("❌ [WebSocket] Max reconnection attempts reached")
          setConnectionError("Unable to reconnect. Please refresh the page.")
        }
      })

      newSocket.on("connect_error", (error) => {
        console.error("❌ [WebSocket] Connection error:", error)
        setConnectionError("Failed to connect to server")
        setIsConnected(false)
        isConnecting.current = false
      })

      // Обработчики событий файлов
      newSocket.on("file_tracked", (data) => {
        console.log("📝 [WebSocket] File tracked:", data)
        stableCallbacks.current.onFileTracked?.(data)
      })

      // Новое событие для staged изменений
      newSocket.on("file_change_staged", (data) => {
        console.log("📝 [WebSocket] File change staged received:", {
          projectId: data.projectId,
          filePath: data.filePath,
          action: data.action,
          status: data.status,
          contentLength: data.content?.length || 0,
        })
        stableCallbacks.current.onFileTracked?.(data)
      })

      newSocket.on("save_success", (data) => {
        console.log("💾 [WebSocket] Save success:", data)
        stableCallbacks.current.onSaveSuccess?.(data)
      })

      // Обработчик для discard_success (очистка pending changes при откате)
      newSocket.on("discard_success", (data) => {
        console.log("🔄 [WebSocket] Discard success:", data)
        stableCallbacks.current.onSaveSuccess?.(data) // Используем тот же callback для очистки pending changes
      })

      newSocket.on("agent_connected", (data) => {
        console.log("🟢 [WebSocket] Agent connected:", data)
        stableCallbacks.current.onAgentConnected?.(data)
      })

      newSocket.on("agent_disconnected", (data) => {
        console.log("🔴 [WebSocket] Agent disconnected:", data)
        stableCallbacks.current.onAgentDisconnected?.(data)
      })

      newSocket.on("deploy_status_update", (data) => {
        console.log("🚀 [WebSocket] Deploy status update:", data)
        stableCallbacks.current.onDeployStatusUpdate?.(data)
      })

      newSocket.on("commit_created", (data) => {
        console.log("📝 [WebSocket] Commit created:", data)
        stableCallbacks.current.onCommitCreated?.(data)
      })

      newSocket.on("initialization_progress", (data) => {
        console.log("📊 [WebSocket] Initialization progress:", data)
        stableCallbacks.current.onInitializationProgress?.(data)
      })

      newSocket.on("file_updated", (data) => {
        console.log("📄 [WebSocket] File updated:", data)
        // Файл обновлен другим пользователем
      })

      newSocket.on("files_saved", (data) => {
        console.log("💾 [WebSocket] Files saved:", data)
        // Файлы сохранены другим пользователем
      })

      newSocket.on("error", (error) => {
        console.error("❌ [WebSocket] Error:", error)
        stableCallbacks.current.onError?.(error)
      })

      setSocket(newSocket)
    }, 100) // 100ms debounce delay

    // Cleanup при размонтировании
    return () => {
      console.log("🛑 [WebSocket] Disconnecting...")
      isConnecting.current = false

      if (connectionTimeout.current) {
        clearTimeout(connectionTimeout.current)
      }

      if (socket) {
        socket.disconnect()
        setSocket(null)
        setIsConnected(false)
      }
    }
  }, [projectId]) // Только projectId в зависимостях

  // Методы для отправки событий
  const saveAllChanges = useCallback(
    (commitMessage?: string) => {
      if (socket && isConnected) {
        socket.emit("save_all_changes", {
          projectId,
          commitMessage,
        })
      } else {
        stableCallbacks.current.onError?.({
          message: "Not connected to server",
        })
      }
    },
    [socket, isConnected, projectId],
  )

  const discardAllChanges = useCallback(() => {
    if (socket && isConnected) {
      socket.emit("discard_all_changes", {
        projectId,
      })
    } else {
      stableCallbacks.current.onError?.({ message: "Not connected to server" })
    }
  }, [socket, isConnected, projectId])

  return {
    socket,
    isConnected,
    connectionError,
    saveAllChanges,
    discardAllChanges,
    disconnect,
  }
}
