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
  const [showPendingBadge, setShowPendingBadge] = useState(false);
  const [animationClass, setAnimationClass] = useState("");

  useEffect(() => {
    const connectToServer = async () => {
      const connected = await client.connect();
      setIsConnected(connected);
    };

    connectToServer();

    const handleStateChange = (newState: ToolbarState) => {
      setState(newState);
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

    return () => {
      client.off("stateChange", handleStateChange);
      client.off("saveSuccess", handleSaveSuccess);
      client.off("discardSuccess", handleDiscardSuccess);
      document.removeEventListener("keydown", handleKeyDown);
      client.disconnect();
    };
  }, [client]);

  useEffect(() => {
    if (state.pendingChanges > 0 && !showPendingBadge) {
      // Показываем badge с анимацией появления
      setShowPendingBadge(true);
      setAnimationClass("show");
    } else if (state.pendingChanges === 0 && showPendingBadge) {
      // Скрываем badge с анимацией исчезновения
      setAnimationClass("hide");
      setTimeout(() => {
        setShowPendingBadge(false);
        setAnimationClass("");
      }, 300); // Длительность анимации
    }
  }, [state.pendingChanges, showPendingBadge]);

  const handleSave = () => {
    if (state.pendingChanges > 0 && !isLoading) {
      setIsLoading(true);
      client.saveAll();
    }
  };

  const handleDiscard = () => {
    if (state.pendingChanges > 0 && !isLoading) {
      setIsLoading(true);
      client.discardAll();
    }
  };

  const handlePreview = () => {
    client.openPreview();
  };

  const getDeployStatusColor = () => {
    switch (state.deployStatus) {
      case "ready":
        return "#10b981"; // green
      case "building":
        return "#f59e0b"; // yellow
      case "failed":
        return "#ef4444"; // red
      case "pending":
        return "#6b7280"; // gray
      default:
        return "#6b7280";
    }
  };

  const getDeployStatusText = () => {
    switch (state.deployStatus) {
      case "ready":
        return "Ready";
      case "building":
        return "Building...";
      case "failed":
        return "Failed";
      case "pending":
        return "Pending";
      default:
        return "Unknown";
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <div
      className={`vybcel-toolbar ${
        position === "top" ? "vybcel-toolbar-top" : "vybcel-toolbar-bottom"
      }`}
      style={{
        position: "relative",
        zIndex: 999999,
        backgroundColor: "transparent",
        borderRadius: "0",
        border: "none",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: "14px",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "white",
            fontWeight: 500,
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: isConnected ? "#10b981" : "#ef4444",
            }}
          />
          Vybcel
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            color: "white",
            fontSize: "12px",
          }}
        >
          <span>Deploy:</span>
          <span style={{ color: "#6b7280", fontWeight: 500 }}>
            {getDeployStatusText()}
          </span>
        </div>

        {showPendingBadge && (
          <div
            className={`vybcel-pending-badge ${animationClass}`}
            style={{
              backgroundColor: "#fef3c7",
              color: "#92400e",
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            {state.pendingChanges} unsaved change
            {state.pendingChanges !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          onClick={handleSave}
          disabled={state.pendingChanges === 0 || isLoading}
          style={{
            backgroundColor: state.pendingChanges > 0 ? "white" : "#e5e7eb",
            color: state.pendingChanges > 0 ? "#374151" : "#9ca3af",
            border: "none",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 500,
            cursor: state.pendingChanges > 0 ? "pointer" : "not-allowed",
            transition: "all 0.2s",
          }}
        >
          {isLoading ? "Saving..." : "Save All"}
        </button>

        <button
          onClick={handleDiscard}
          disabled={state.pendingChanges === 0 || isLoading}
          style={{
            backgroundColor: "white",
            color: state.pendingChanges > 0 ? "#dc2626" : "#9ca3af",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 500,
            cursor: state.pendingChanges > 0 ? "pointer" : "not-allowed",
            transition: "all 0.2s",
          }}
        >
          Discard All
        </button>

        <button
          onClick={handlePreview}
          disabled={!state.netlifyUrl}
          style={{
            backgroundColor: "white",
            color: state.netlifyUrl ? "#374151" : "#9ca3af",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 500,
            cursor: state.netlifyUrl ? "pointer" : "not-allowed",
            transition: "all 0.2s",
          }}
        >
          Preview
        </button>
      </div>
    </div>
  );
};
