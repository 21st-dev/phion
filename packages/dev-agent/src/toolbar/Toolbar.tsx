import React, { useEffect, useState } from "react"
import type { ToolbarState } from "../types"
import { ToolbarWebSocketClient } from "./websocket-client"

interface ToolbarProps {
  projectId: string
  websocketUrl: string
  position: "top" | "bottom"
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
  const [isLoading, setIsLoading] = useState(false)
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
      setIsLoading(false)
    }

    const handleDiscardSuccess = () => {
      setIsLoading(false)
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
      isLoading,
    })
  }, [state, isConnected, isLoading])

  const handleSave = () => {
    console.log(
      "[Phion Toolbar] handleSave called - pendingChanges:",
      state.pendingChanges,
      "isLoading:",
      isLoading,
    )
    if (state.pendingChanges > 0 && !isLoading) {
      console.log("[Phion Toolbar] Executing save...")
      setIsLoading(true)
      client.saveAll()
    } else {
      console.log(
        "[Phion Toolbar] Save blocked - pendingChanges:",
        state.pendingChanges,
        "isLoading:",
        isLoading,
      )
    }
  }

  const handleDiscard = () => {
    console.log(
      "[Phion Toolbar] handleDiscard called - pendingChanges:",
      state.pendingChanges,
      "isLoading:",
      isLoading,
    )
    if (state.pendingChanges > 0 && !isLoading) {
      console.log("[Phion Toolbar] Executing discard...")
      setIsLoading(true)
      client.discardAll()
    } else {
      console.log(
        "[Phion Toolbar] Discard blocked - pendingChanges:",
        state.pendingChanges,
        "isLoading:",
        isLoading,
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
    isLoading,
    saveDisabled: state.pendingChanges === 0 || isLoading,
    discardDisabled: state.pendingChanges === 0 || isLoading,
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
          disabled={state.pendingChanges === 0 || isLoading}
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            color: state.pendingChanges > 0 ? "#ef4444" : "rgba(255, 255, 255, 0.5)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: "500",
            cursor: state.pendingChanges > 0 ? "pointer" : "not-allowed",
            transition: "all 0.2s",
          }}
        >
          Discard
        </button>

        <button
          onClick={handleSave}
          disabled={state.pendingChanges === 0 || isLoading}
          style={{
            backgroundColor: state.pendingChanges > 0 ? "#3b82f6" : "rgba(255, 255, 255, 0.1)",
            color: state.pendingChanges > 0 ? "#ffffff" : "rgba(255, 255, 255, 0.5)",
            border: state.pendingChanges > 0 ? "none" : "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: "500",
            cursor: state.pendingChanges > 0 ? "pointer" : "not-allowed",
            transition: "all 0.2s",
            boxShadow: state.pendingChanges > 0 ? "0 1px 2px rgba(0, 0, 0, 0.1)" : "none",
          }}
        >
          {isLoading ? "Saving..." : "Save"}
        </button>

        <button
          onClick={handlePreview}
          disabled={!state.netlifyUrl}
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "6px",
            padding: "8px",
            fontSize: "12px",
            fontWeight: "500",
            cursor: state.netlifyUrl ? "pointer" : "not-allowed",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={state.netlifyUrl ? "#FFF" : "#8D8D8D"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ display: "block" }}
          >
            <path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
            <path d="m21 3-9 9" />
            <path d="M15 3h6v6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
