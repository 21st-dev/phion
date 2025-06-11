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
  const [updateNotification, setUpdateNotification] = useState<{
    show: boolean;
    version?: string;
    forceUpdate?: boolean;
    releaseNotes?: string;
  }>({ show: false });

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

    // Auto-update event handlers
    const handleUpdateAvailable = (data: {
      version: string;
      forceUpdate?: boolean;
      releaseNotes?: string;
    }) => {
      console.log("[Toolbar] Update available:", data);
      setUpdateNotification({
        show: true,
        version: data.version,
        forceUpdate: data.forceUpdate,
        releaseNotes: data.releaseNotes,
      });

      // Auto-acknowledge the update
      client.acknowledgeUpdate(data.version);

      // If it's a force update, trigger reload after short delay
      if (data.forceUpdate) {
        setTimeout(() => {
          handleForceUpdate(data);
        }, 3000);
      }
    };

    const handleForceUpdate = (data: { version: string; reason?: string }) => {
      console.log("[Toolbar] Force update triggered:", data);

      // Show force update notification
      setUpdateNotification({
        show: true,
        version: data.version,
        forceUpdate: true,
      });

      // Trigger reload after 2 seconds
      setTimeout(() => {
        try {
          client.reportUpdateSuccess(data.version);
          window.location.reload();
        } catch (error) {
          client.reportUpdateError(
            data.version,
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      }, 2000);
    };

    const handleReloadRequested = (data: { reason?: string }) => {
      console.log("[Toolbar] Reload requested:", data);

      // Show brief notification
      setUpdateNotification({
        show: true,
        version: "reload",
      });

      // Reload after short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    };

    client.on("stateChange", handleStateChange);
    client.on("saveSuccess", handleSaveSuccess);
    client.on("discardSuccess", handleDiscardSuccess);
    client.on("updateAvailable", handleUpdateAvailable);
    client.on("forceUpdate", handleForceUpdate);
    client.on("reloadRequested", handleReloadRequested);

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
          case "U":
            e.preventDefault();
            handleCheckUpdates();
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      client.off("stateChange", handleStateChange);
      client.off("saveSuccess", handleSaveSuccess);
      client.off("discardSuccess", handleDiscardSuccess);
      client.off("updateAvailable", handleUpdateAvailable);
      client.off("forceUpdate", handleForceUpdate);
      client.off("reloadRequested", handleReloadRequested);
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

  // Auto-hide update notification
  useEffect(() => {
    if (updateNotification.show && !updateNotification.forceUpdate) {
      const timer = setTimeout(() => {
        setUpdateNotification({ show: false });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [updateNotification]);

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

  const handleCheckUpdates = () => {
    client.checkForUpdates();
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

  const renderUpdateNotification = () => {
    if (!updateNotification.show) return null;

    if (updateNotification.version === "reload") {
      return (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            background: "#3b82f6",
            color: "white",
            padding: "12px 16px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            zIndex: 1000000,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            animation: "vybcel-slideIn 0.3s ease-out",
          }}
        >
          🔄 Reloading toolbar...
        </div>
      );
    }

    return (
      <div
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          background: updateNotification.forceUpdate ? "#ef4444" : "#10b981",
          color: "white",
          padding: "12px 16px",
          borderRadius: "8px",
          fontSize: "14px",
          fontWeight: 500,
          zIndex: 1000000,
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          animation: "vybcel-slideIn 0.3s ease-out",
          maxWidth: "300px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>
            {updateNotification.forceUpdate ? "⚠️" : "🚀"}
            {updateNotification.forceUpdate ? " Updating..." : " Updated!"}
          </span>
          {updateNotification.version &&
            updateNotification.version !== "reload" && (
              <span style={{ opacity: 0.8, fontSize: "12px" }}>
                v{updateNotification.version}
              </span>
            )}
        </div>
        {updateNotification.releaseNotes && (
          <div style={{ marginTop: "4px", fontSize: "12px", opacity: 0.9 }}>
            {updateNotification.releaseNotes}
          </div>
        )}
      </div>
    );
  };

  if (!isConnected) {
    return null;
  }

  return (
    <>
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

      {renderUpdateNotification()}

      {/* CSS for slide animation */}
      <style>
        {`
          @keyframes vybcel-slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}
      </style>
    </>
  );
};
