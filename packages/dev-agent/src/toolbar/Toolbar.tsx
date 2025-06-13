import React, { useState, useEffect } from "react";
import { ToolbarWebSocketClient } from "./websocket-client";
import type { ToolbarState } from "../types";

interface ToolbarProps {
  projectId: string;
  websocketUrl: string;
  position: "top" | "bottom";
}

export const Toolbar: React.FC<ToolbarProps> = ({
  projectId,
  websocketUrl,
  position,
}) => {
  const [client] = useState(
    () => new ToolbarWebSocketClient(projectId, websocketUrl)
  );
  const [state, setState] = useState<ToolbarState>({
    pendingChanges: 0,
    deployStatus: "ready",
    agentConnected: false,
    netlifyUrl: undefined,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [projectName, setProjectName] = useState("Project");
  const [isSimpleBrowser, setIsSimpleBrowser] = useState(false);

  useEffect(() => {
    const connectToServer = async () => {
      const connected = await client.connect();
      setIsConnected(connected);
    };

    connectToServer();

    const handleStateChange = (newState: ToolbarState) => {
      console.log("[Vybcel Toolbar] State change:", newState);
      setState((prevState) => {
        console.log("[Vybcel Toolbar] Current state before update:", prevState);
        console.log("[Vybcel Toolbar] setState called with:", newState);
        return newState;
      });
    };

    const handleSaveSuccess = () => {
      setIsLoading(false);
    };

    const handleDiscardSuccess = () => {
      setIsLoading(false);
    };

    client.on("stateChange", handleStateChange);
    client.on("saveSuccess", handleSaveSuccess);
    client.on("discardSuccess", handleDiscardSuccess);

    // Detect Simple Browser in Cursor
    const detectSimpleBrowser = () => {
      const userAgent = navigator.userAgent;
      const isInCursor =
        userAgent.includes("Cursor") ||
        userAgent.includes("vscode") ||
        window.location.href.includes("vscode-webview") ||
        !!(window as any).acquireVsCodeApi ||
        !!(window as any).cursor;
      setIsSimpleBrowser(isInCursor);
    };

    detectSimpleBrowser();

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        switch (e.key) {
          case "S":
            e.preventDefault();
            handleSave();
            break;
          case "D":
            e.preventDefault();
            handleDiscard();
            break;
          case "P":
            e.preventDefault();
            handlePreview();
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Get project name
    const getProjectName = async () => {
      try {
        const response = await fetch("/package.json");
        if (response.ok) {
          const packageJson = await response.json();
          const name = packageJson.name || "Project";
          setProjectName(name);
        }
      } catch (e) {
        // Use default project name
        setProjectName("Project");
      }
    };

    getProjectName();

    return () => {
      client.off("stateChange", handleStateChange);
      client.off("saveSuccess", handleSaveSuccess);
      client.off("discardSuccess", handleDiscardSuccess);
      document.removeEventListener("keydown", handleKeyDown);
      client.disconnect();
    };
  }, [client]);

  // Debug: Log every state change
  useEffect(() => {
    console.log("[Vybcel Toolbar] Component re-rendered with state:", {
      pendingChanges: state.pendingChanges,
      deployStatus: state.deployStatus,
      agentConnected: state.agentConnected,
      netlifyUrl: state.netlifyUrl,
      isConnected,
      isLoading,
    });
  }, [state, isConnected, isLoading]);

  const handleSave = () => {
    console.log(
      "[Vybcel Toolbar] handleSave called - pendingChanges:",
      state.pendingChanges,
      "isLoading:",
      isLoading
    );
    if (state.pendingChanges > 0 && !isLoading) {
      console.log("[Vybcel Toolbar] Executing save...");
      setIsLoading(true);
      client.saveAll();
    } else {
      console.log(
        "[Vybcel Toolbar] Save blocked - pendingChanges:",
        state.pendingChanges,
        "isLoading:",
        isLoading
      );
    }
  };

  const handleDiscard = () => {
    console.log(
      "[Vybcel Toolbar] handleDiscard called - pendingChanges:",
      state.pendingChanges,
      "isLoading:",
      isLoading
    );
    if (state.pendingChanges > 0 && !isLoading) {
      console.log("[Vybcel Toolbar] Executing discard...");
      setIsLoading(true);
      client.discardAll();
    } else {
      console.log(
        "[Vybcel Toolbar] Discard blocked - pendingChanges:",
        state.pendingChanges,
        "isLoading:",
        isLoading
      );
    }
  };

  const handlePreview = () => {
    if (state.netlifyUrl) {
      if (isSimpleBrowser) {
        // В Simple Browser пытаемся открыть во внешнем браузере
        try {
          // Попытка через VS Code API (если доступно)
          const vscode = (window as any).acquireVsCodeApi?.();
          if (vscode) {
            vscode.postMessage({
              command: "openExternal",
              url: state.netlifyUrl,
            });
            return;
          }

          // Fallback: обычное открытие в новом окне
          window.open(state.netlifyUrl, "_blank");
        } catch (e) {
          // Fallback на случай ошибки
          window.open(state.netlifyUrl, "_blank");
        }
      } else {
        // Обычное открытие в новом окне
        window.open(state.netlifyUrl, "_blank");
      }
    }
  };

  if (!isConnected) {
    return null;
  }

  // Debug: Log button states before render
  console.log("[Vybcel Toolbar] Rendering buttons with:", {
    pendingChanges: state.pendingChanges,
    isLoading,
    saveDisabled: state.pendingChanges === 0 || isLoading,
    discardDisabled: state.pendingChanges === 0 || isLoading,
    saveButtonColor:
      state.pendingChanges > 0 ? "#3b82f6" : "rgba(255, 255, 255, 0.1)",
    discardButtonColor:
      state.pendingChanges > 0 ? "#ef4444" : "rgba(255, 255, 255, 0.5)",
  });

  return (
    <div
      style={{
        backgroundColor: "transparent",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: "14px",
        flexShrink: 0,
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
          {projectName}
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
        <button
          onClick={handleDiscard}
          disabled={state.pendingChanges === 0 || isLoading}
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            color:
              state.pendingChanges > 0 ? "#ef4444" : "rgba(255, 255, 255, 0.5)",
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
            backgroundColor:
              state.pendingChanges > 0 ? "#3b82f6" : "rgba(255, 255, 255, 0.1)",
            color:
              state.pendingChanges > 0 ? "#ffffff" : "rgba(255, 255, 255, 0.5)",
            border:
              state.pendingChanges > 0
                ? "none"
                : "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: "500",
            cursor: state.pendingChanges > 0 ? "pointer" : "not-allowed",
            transition: "all 0.2s",
            boxShadow:
              state.pendingChanges > 0
                ? "0 1px 2px rgba(0, 0, 0, 0.1)"
                : "none",
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
  );
};
