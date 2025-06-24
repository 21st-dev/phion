import React, { useEffect, useState } from "react"
import type { ToolbarState } from "../types"
import { ToolbarWebSocketClient } from "./websocket-client"

interface ToolbarProps {
  projectId: string
  websocketUrl: string
  position: "top" | "bottom"
}

// Add spin animation keyframes to document if not already added
if (typeof document !== "undefined" && !document.getElementById("phion-toolbar-styles")) {
  const style = document.createElement("style")
  style.id = "phion-toolbar-styles"
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `
  document.head.appendChild(style)
}

export const Toolbar: React.FC<ToolbarProps> = ({ projectId, websocketUrl, position }) => {
  const [client] = useState(() => new ToolbarWebSocketClient(projectId, websocketUrl))
  const [state, setState] = useState<ToolbarState>({
    pendingChanges: 0,
    deployStatus: "ready",
    agentConnected: false,
    netlifyUrl: undefined,
  })
  const [isConnected, setIsConnected] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDiscarding, setIsDiscarding] = useState(false)
  const [projectName, setProjectName] = useState("Project")
  const [isSimpleBrowser, setIsSimpleBrowser] = useState(false)
  const [debugMessage, setDebugMessage] = useState<string>("")
  const [errorCount, setErrorCount] = useState(0)

  // Get version from global config
  const version = ((window as any).PHION_CONFIG?.version as string) || "unknown"
  const isDebugMode = ((window as any).PHION_CONFIG?.debug as boolean) || false

  useEffect(() => {
    const connectToServer = async () => {
      const connected = await client.connect()
      setIsConnected(connected)
      // Initialize error count
      setErrorCount(client.getErrorBufferSize())
    }

    connectToServer()

    if (isDebugMode) {
      // Force show version on load - use dynamic version
      showDebugMessage(`Phion v${version} loaded`)

      // Also force show detection result immediately
      setTimeout(() => {
        const userAgent = navigator.userAgent
        const isInCursor =
          userAgent.includes("Cursor") ||
          userAgent.includes("vscode") ||
          !!(window as any).acquireVsCodeApi
        showDebugMessage(`Browser: ${isInCursor ? "Cursor detected" : "Regular browser"}`)
      }, 1000)

      // Test debug messages work
      setTimeout(() => {
        showDebugMessage("Debug system working! Click preview to test APIs")
      }, 2000)
    }

    const handleStateChange = (newState: ToolbarState) => {
      console.log("[Phion Toolbar] State change:", newState)
      setState((prevState) => {
        console.log("[Phion Toolbar] Current state before update:", prevState)
        console.log("[Phion Toolbar] setState called with:", newState)
        return newState
      })
    }

    const handleSaveSuccess = () => {
      setIsSaving(false)
    }

    const handleDiscardSuccess = () => {
      setIsDiscarding(false)
    }

    client.on("stateChange", handleStateChange)
    client.on("saveSuccess", handleSaveSuccess)
    client.on("discardSuccess", handleDiscardSuccess)

    // Set callback for error buffer changes
    client.setErrorBufferChangeCallback((count: number) => {
      console.log("[Phion Toolbar] Error buffer changed:", count)
      setErrorCount(count)
    })

    // Handle preview response from server
    const handlePreviewResponse = (data: { success: boolean; url?: string; error?: string }) => {
      console.log("[Phion Toolbar] Preview response received:", data)

      if (data.success && data.url) {
        showDebugMessage("Got URL, trying to open...")

        // Try multiple methods to open external URL in Cursor
        let opened = false

        try {
          if (isSimpleBrowser) {
            // Method 1: Try VS Code command palette approach
            if ((window as any).acquireVsCodeApi) {
              const vscode = (window as any).acquireVsCodeApi()

              // Try different VS Code commands
              const commands = [
                { command: "vscode.open", text: data.url },
                { command: "vscode.env.openExternal", arguments: [data.url] },
                { command: "simpleBrowser.show", arguments: [data.url] },
                {
                  command: "vscode.openWith",
                  arguments: [data.url, "vscode.open"],
                },
              ]

              for (const cmd of commands) {
                try {
                  console.log(`[Phion Toolbar] Trying command:`, cmd)
                  vscode.postMessage(cmd)
                  showDebugMessage(`Tried: ${cmd.command}`)
                  opened = true
                  break
                } catch (e) {
                  console.log(`[Phion Toolbar] Command failed:`, cmd.command, e)
                }
              }
            }

            // Method 2: Try window.open with different targets
            if (!opened) {
              const targets = ["_blank", "_top", "_parent", ""]
              for (const target of targets) {
                try {
                  const result = window.open(data.url, target)
                  if (result) {
                    showDebugMessage(`Opened with target: ${target || "default"}`)
                    opened = true
                    break
                  }
                } catch (e) {
                  console.log(`[Phion Toolbar] Target failed:`, target, e)
                }
              }
            }

            // Method 3: Copy to clipboard as fallback
            if (!opened) {
              navigator.clipboard
                .writeText(data.url)
                .then(() => {
                  showDebugMessage("URL copied to clipboard! Paste to open.")
                })
                .catch(() => {
                  showDebugMessage("Manual: " + data.url!.substring(0, 30) + "...")
                })
            }
          } else {
            // Regular browser - simple approach
            window.open(data.url, "_blank")
            showDebugMessage("Opened in new tab")
            opened = true
          }
        } catch (error) {
          console.error("[Phion Toolbar] All methods failed:", error)
          showDebugMessage(`All methods failed. Manual: ${data.url}`)
        }

        if (!opened) {
          showDebugMessage("Could not auto-open. Check logs for URL.")
        }
      } else {
        showDebugMessage(data.error || "Preview not available")
      }
    }

    client.on("previewResponse", handlePreviewResponse)

    // Detect Simple Browser in Cursor
    const detectSimpleBrowser = () => {
      const userAgent = navigator.userAgent
      console.log("[Phion Toolbar] User Agent:", userAgent)

      const apis = {
        acquireVsCodeApi: !!(window as any).acquireVsCodeApi,
        vscode: !!(window as any).vscode,
        cursor: !!(window as any).cursor,
      }
      console.log("[Phion Toolbar] Available APIs:", apis)

      const isInCursor =
        userAgent.includes("Cursor") ||
        userAgent.includes("vscode") ||
        userAgent.includes("VSCode") ||
        window.location.href.includes("vscode-webview") ||
        window.location.href.includes("vscode-webview-resource") ||
        (window.location.href.includes("localhost") &&
          (userAgent.includes("Electron") || userAgent.includes("Chrome"))) ||
        !!(window as any).acquireVsCodeApi ||
        !!(window as any).vscode ||
        !!(window as any).cursor

      console.log("[Phion Toolbar] Simple Browser detection result:", isInCursor)
      setIsSimpleBrowser(isInCursor)

      // Show visual feedback (only in debug mode)
      if (isDebugMode) {
        if (isInCursor) {
          const availableApis = Object.entries(apis)
            .filter(([_, available]) => available)
            .map(([name]) => name)
          showDebugMessage(`Cursor detected! APIs: ${availableApis.join(", ") || "none"}`)
        } else {
          showDebugMessage("Regular browser detected")
        }
      }
    }

    detectSimpleBrowser()

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        switch (e.key) {
          case "S":
            e.preventDefault()
            handleSave()
            break
          case "D":
            e.preventDefault()
            handleDiscard()
            break
          case "P":
            e.preventDefault()
            handlePreview()
            break
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    // Get project name
    const getProjectName = async () => {
      try {
        const response = await fetch("/package.json")
        if (response.ok) {
          const packageJson = await response.json()
          const name = packageJson.name || "Project"
          setProjectName(name)
        }
      } catch (e) {
        // Use default project name
        setProjectName("Project")
      }
    }

    getProjectName()

    return () => {
      client.off("stateChange", handleStateChange)
      client.off("saveSuccess", handleSaveSuccess)
      client.off("discardSuccess", handleDiscardSuccess)
      client.off("previewResponse", handlePreviewResponse)
      document.removeEventListener("keydown", handleKeyDown)
      client.disconnect()
    }
  }, [client])

  // Debug: Log every state change
  useEffect(() => {
    console.log("[Phion Toolbar] Component re-rendered with state:", {
      pendingChanges: state.pendingChanges,
      deployStatus: state.deployStatus,
      agentConnected: state.agentConnected,
      netlifyUrl: state.netlifyUrl,
      isConnected,
      isSaving,
      isDiscarding,
    })
  }, [state, isConnected, isSaving, isDiscarding])

  const handleSave = () => {
    console.log(
      "[Phion Toolbar] handleSave called - pendingChanges:",
      state.pendingChanges,
      "isSaving:",
      isSaving,
    )
    if (state.pendingChanges > 0 && !isSaving && !isDiscarding) {
      console.log("[Phion Toolbar] Executing save...")
      setIsSaving(true)
      client.saveAll()
    } else {
      console.log(
        "[Phion Toolbar] Save blocked - pendingChanges:",
        state.pendingChanges,
        "isSaving:",
        isSaving,
      )
    }
  }

  const handleDiscard = () => {
    console.log(
      "[Phion Toolbar] handleDiscard called - pendingChanges:",
      state.pendingChanges,
      "isDiscarding:",
      isDiscarding,
    )
    if (state.pendingChanges > 0 && !isSaving && !isDiscarding) {
      console.log("[Phion Toolbar] Executing discard...")
      setIsDiscarding(true)
      client.discardAll()
    } else {
      console.log(
        "[Phion Toolbar] Discard blocked - pendingChanges:",
        state.pendingChanges,
        "isDiscarding:",
        isDiscarding,
      )
    }
  }

  const handleFixErrors = () => {
    console.log(`[Phion Toolbar] Fixing errors (${errorCount} in buffer)`)
    client.sendInsertPrompt()
    showDebugMessage(`Sending ${errorCount} errors to AI for fixing...`)
  }

  const handlePreview = () => {
    console.log("[Phion Toolbar] handlePreview called - using local HTTP server approach")
    showDebugMessage("Requesting preview via local server...")

    // Try local HTTP server first (ports 3333 or 3334)
    const tryOpenWithLocalServer = async (port: number) => {
      try {
        const response = await fetch(`http://localhost:${port}/open-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: state.netlifyUrl }),
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            showDebugMessage("✅ Opened via local server!")
            return true
          } else {
            showDebugMessage("❌ Local server failed: " + result.message)
            return false
          }
        }
        return false
      } catch (error) {
        showDebugMessage(
          `❌ Port ${port} failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        )
        return false
      }
    }

    // Try both possible ports
    const openPreview = async () => {
      if (!state.netlifyUrl) {
        showDebugMessage("❌ No preview URL available")
        return
      }

      showDebugMessage("🔍 Trying local server port 3333...")
      const port3333Success = await tryOpenWithLocalServer(3333)

      if (!port3333Success) {
        showDebugMessage("🔍 Trying local server port 3334...")
        const port3334Success = await tryOpenWithLocalServer(3334)

        if (!port3334Success) {
          showDebugMessage("❌ Local server not available")
          // Fallback to WebSocket approach
          console.log("[Phion Toolbar] Falling back to WebSocket approach")
          client.requestPreview()
        }
      }
    }

    openPreview()
  }

  // Format relative time for last commit
  const getRelativeTime = (dateString: string) => {
    if (!dateString) return null

    const now = new Date()
    const past = new Date(dateString)

    // Проверяем валидность даты
    if (isNaN(past.getTime())) return null

    const diffMs = now.getTime() - past.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return "just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  // Get deploy status display
  const getDeployStatusDisplay = () => {
    // Если нет netlify_url, значит еще не деплоился
    if (!state.netlifyUrl) {
      return { text: "Not deployed", color: "#9ca3af" }
    }

    switch (state.deployStatus) {
      case "ready":
        return { text: "Live", color: "#10b981" }
      case "building":
        return { text: "Publishing", color: "#f59e0b" }
      case "failed":
        return { text: "Failed", color: "#ef4444" }
      case "pending":
        // Если есть netlify_url но статус pending - скорее всего уже готово
        return state.netlifyUrl
          ? { text: "Live", color: "#10b981" }
          : { text: "Pending", color: "#9ca3af" }
      default:
        return { text: "Unknown", color: "#9ca3af" }
    }
  }

  // Show debug message in UI
  const showDebugMessage = (message: string) => {
    if (!isDebugMode) return // Only show debug messages when debug mode is enabled

    setDebugMessage(message)
    setTimeout(() => setDebugMessage(""), 3000) // Clear after 3 seconds
  }

  if (!isConnected) {
    return null
  }

  // Debug: Log button states before render
  console.log("[Phion Toolbar] Rendering buttons with:", {
    pendingChanges: state.pendingChanges,
    isSaving,
    isDiscarding,
    saveDisabled: state.pendingChanges === 0 || isSaving || isDiscarding,
    discardDisabled: state.pendingChanges === 0 || isSaving || isDiscarding,
    saveButtonColor: state.pendingChanges > 0 ? "#3b82f6" : "rgba(255, 255, 255, 0.1)",
    discardButtonColor: state.pendingChanges > 0 ? "#ef4444" : "rgba(255, 255, 255, 0.5)",
  })

  return (
    <div
      style={{
        backgroundColor: "transparent",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: "14px",
        flexShrink: 0,
        position: "relative",
      }}
    >
      {/* Left side - Project name and status */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "white",
            fontWeight: "500",
          }}
        >
          {projectName}{" "}
          <span style={{ fontSize: "10px", opacity: 0.7 }}>
            v{version}
            {isDebugMode && debugMessage && (
              <span
                style={{
                  color: "#ff6b35",
                  fontWeight: "bold",
                  marginLeft: "8px",
                  padding: "2px 4px",
                  backgroundColor: "rgba(255, 107, 53, 0.1)",
                  borderRadius: "3px",
                }}
              >
                🔍 {debugMessage}
              </span>
            )}
          </span>
        </div>

        {state.pendingChanges > 0 && (
          <div
            style={{
              backgroundColor: "rgba(251, 191, 36, 0.15)",
              color: "#fbbf24",
              border: "1px solid rgba(251, 191, 36, 0.3)",
              padding: "2px 4px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "500",
              backdropFilter: "blur(8px)",
            }}
          >
            {state.pendingChanges} unsaved
          </div>
        )}
      </div>

      {/* Right side - Action buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* Last save time and deploy status */}
        {state.lastCommit && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "2px 4px",
            }}
          >
            <span
              style={{
                opacity: 0.7,
                color: "rgba(255, 255, 255, 0.8)",
                fontSize: "11px",
                fontWeight: "400",
              }}
            >
              Updated {getRelativeTime(state.lastCommit.createdAt)}
            </span>
            {state.netlifyUrl && (
              <>
                <span style={{ opacity: 0.5, fontSize: "8px", color: "rgba(255, 255, 255, 0.8)" }}>
                  •
                </span>
                <button
                  onClick={handlePreview}
                  style={{
                    backgroundColor: "transparent",
                    border: "none",
                    color: getDeployStatusDisplay().color,
                    fontSize: "11px",
                    fontWeight: "500",
                    cursor: state.deployStatus === "building" ? "default" : "pointer",
                    transition: "all 0.2s",
                    textDecoration: state.deployStatus === "building" ? "none" : "underline",
                    padding: "0",
                  }}
                  title={
                    state.deployStatus === "building"
                      ? "Publishing in progress..."
                      : "Click to open live preview"
                  }
                >
                  {getDeployStatusDisplay().text}
                </button>
              </>
            )}
          </div>
        )}

        {errorCount > 0 && (
          <button
            onClick={handleFixErrors}
            style={{
              backgroundColor: "rgba(255, 165, 0, 0.1)",
              color: "#ffa500",
              border: "1px solid rgba(255, 165, 0, 0.3)",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            Fix errors ({errorCount})
          </button>
        )}

        <button
          onClick={handleDiscard}
          disabled={state.pendingChanges === 0 || isSaving || isDiscarding}
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            color:
              state.pendingChanges > 0 && !isSaving && !isDiscarding
                ? "#ef4444"
                : "rgba(255, 255, 255, 0.5)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: "500",
            cursor:
              state.pendingChanges > 0 && !isSaving && !isDiscarding ? "pointer" : "not-allowed",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {isDiscarding && (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255, 255, 255, 0.5)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: "spin 1s linear infinite" }}
            >
              <path d="M12 2v4" />
              <path d="m16.2 7.8 2.9-2.9" />
              <path d="M18 12h4" />
              <path d="m16.2 16.2 2.9 2.9" />
              <path d="M12 18v4" />
              <path d="m4.9 19.1 2.9-2.9" />
              <path d="M2 12h4" />
              <path d="m4.9 4.9 2.9 2.9" />
            </svg>
          )}
          Discard
        </button>

        <button
          onClick={handleSave}
          disabled={state.pendingChanges === 0 || isSaving || isDiscarding}
          style={{
            backgroundColor:
              state.pendingChanges > 0 && !isSaving && !isDiscarding
                ? "#3b82f6"
                : "rgba(255, 255, 255, 0.1)",
            color:
              state.pendingChanges > 0 && !isSaving && !isDiscarding
                ? "#ffffff"
                : "rgba(255, 255, 255, 0.5)",
            border:
              state.pendingChanges > 0 && !isSaving && !isDiscarding
                ? "none"
                : "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: "500",
            cursor:
              state.pendingChanges > 0 && !isSaving && !isDiscarding ? "pointer" : "not-allowed",
            transition: "all 0.2s",
            boxShadow:
              state.pendingChanges > 0 && !isSaving && !isDiscarding
                ? "0 1px 2px rgba(0, 0, 0, 0.1)"
                : "none",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {isSaving && (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255, 255, 255, 0.5)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: "spin 1s linear infinite" }}
            >
              <path d="M12 2v4" />
              <path d="m16.2 7.8 2.9-2.9" />
              <path d="M18 12h4" />
              <path d="m16.2 16.2 2.9 2.9" />
              <path d="M12 18v4" />
              <path d="m4.9 19.1 2.9-2.9" />
              <path d="M2 12h4" />
              <path d="m4.9 4.9 2.9 2.9" />
            </svg>
          )}
          {state.lastCommit ? "Save" : "Publish"}
        </button>
      </div>
    </div>
  )
}
