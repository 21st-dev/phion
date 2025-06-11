import React from "react";
import { createRoot } from "react-dom/client";
import { Toolbar } from "./Toolbar";

declare global {
  interface Window {
    VYBCEL_CONFIG: {
      projectId: string;
      websocketUrl: string;
      position: "top" | "bottom";
      version: string;
      autoUpdate: boolean;
      updateChannel: "stable" | "beta" | "dev";
    };
    VYBCEL_TOOLBAR_INSTANCE?: {
      root: any;
      version: string;
      destroy: () => void;
    };
  }
}

// Auto-update functionality
class ToolbarUpdater {
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  start() {
    if (!window.VYBCEL_CONFIG?.autoUpdate) return;

    this.checkInterval = setInterval(() => {
      this.checkForUpdates();
    }, this.CHECK_INTERVAL);

    // Check immediately
    setTimeout(() => this.checkForUpdates(), 10000); // Wait 10s after load
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async checkForUpdates() {
    try {
      const response = await fetch("/vybcel/api/update-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.hasUpdate && result.latestVersion) {
          console.log(
            `[Vybcel Toolbar] Update available: ${result.latestVersion.version}`
          );
          this.performUpdate(result.latestVersion);
        }
      }
    } catch (error) {
      console.warn("[Vybcel Toolbar] Update check failed:", error);
    }
  }

  private async performUpdate(version: any) {
    try {
      // Show update notification
      this.showUpdateNotification(version);

      // Hot reload the toolbar
      await this.hotReloadToolbar();
    } catch (error) {
      console.error("[Vybcel Toolbar] Update failed:", error);
    }
  }

  private showUpdateNotification(version: any) {
    // Create temporary notification
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 1000000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease-out;
    `;
    notification.innerHTML = `
      🚀 Toolbar updated to v${version.version}
    `;

    // Add slide animation
    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = "slideIn 0.3s ease-out reverse";
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  private async hotReloadToolbar() {
    const currentInstance = window.VYBCEL_TOOLBAR_INSTANCE;
    if (currentInstance) {
      // Preserve current state if possible
      const currentState = this.preserveToolbarState();

      // Destroy current instance
      currentInstance.destroy();

      // Wait a moment for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reinitialize with preserved state
      initializeToolbar(currentState);
    }
  }

  private preserveToolbarState(): any {
    // Try to preserve important state
    return {
      timestamp: Date.now(),
    };
  }
}

const updater = new ToolbarUpdater();

// Initialize toolbar when DOM is ready
function initializeToolbar(preservedState?: any) {
  if (!window.VYBCEL_CONFIG) {
    console.error("[Vybcel Toolbar] Configuration not found");
    return;
  }

  const { projectId, websocketUrl, position, version } = window.VYBCEL_CONFIG;

  // Check if toolbar already exists
  if (window.VYBCEL_TOOLBAR_INSTANCE?.version === version) {
    return; // Same version, no need to reinitialize
  }

  // Cleanup existing instance
  if (window.VYBCEL_TOOLBAR_INSTANCE) {
    window.VYBCEL_TOOLBAR_INSTANCE.destroy();
  }

  // Create main wrapper for the entire page
  const wrapper = document.createElement("div");
  wrapper.id = "vybcel-wrapper";
  wrapper.style.cssText = `
    position: fixed;
    inset: 0px;
    z-index: 999998;
    background-color: rgb(0, 0, 0);
    padding: 4px;
    display: flex;
    flex-direction: column;
  `;

  // Create toolbar container
  const toolbarContainer = document.createElement("div");
  toolbarContainer.id = "vybcel-toolbar-root";
  toolbarContainer.style.cssText = `
    all: initial;
    * {
      box-sizing: border-box;
    }
    flex-shrink: 0;
  `;

  // Add CSS animations for toolbar
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideInDown {
      from {
        opacity: 0;
        transform: translateY(-10px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    
    @keyframes slideOutUp {
      from {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      to {
        opacity: 0;
        transform: translateY(-10px) scale(0.95);
      }
    }
    
    .vybcel-pending-badge {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .vybcel-pending-badge.show {
      animation: slideInDown 0.3s ease-out;
    }
    
    .vybcel-pending-badge.hide {
      animation: slideOutUp 0.3s ease-out;
    }
  `;
  document.head.appendChild(style);

  // Create content wrapper
  const contentWrapper = document.createElement("div");
  contentWrapper.className = "vybcel-content";
  contentWrapper.style.cssText = `
    flex: 1 1 0%;
    background-color: rgb(255, 255, 255);
    border-radius: 8px;
    overflow: auto;
    position: relative;
    box-shadow: rgba(0, 0, 0, 0.1) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.06) 0px 2px 4px -1px;
  `;

  // Function to move content with better React support
  const moveContent = () => {
    // Wait a bit more for React to potentially mount
    setTimeout(() => {
      // Get all existing body content except our wrapper
      const existingContent = Array.from(document.body.children).filter(
        (child) => child.id !== "vybcel-wrapper"
      );

      // Move all existing content to the content wrapper
      existingContent.forEach((child) => {
        contentWrapper.appendChild(child);
      });

      // If there's a #root element but it's empty, wait a bit more for React
      const rootElement = contentWrapper.querySelector("#root");
      if (rootElement && rootElement.children.length === 0) {
        setTimeout(() => {
          // Check if React has mounted anything
          if (rootElement.children.length === 0) {
            console.log("[Vybcel] React app may not have mounted yet");
          }
        }, 1000);
      }
    }, 100);
  };

  // Assemble the wrapper first
  wrapper.appendChild(toolbarContainer);
  wrapper.appendChild(contentWrapper);
  document.body.appendChild(wrapper);

  // Reset body styles to prevent conflicts
  document.body.style.margin = "0";
  document.body.style.padding = "0";
  document.body.style.overflow = "hidden";

  // Move content after wrapper is in place
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", moveContent);
  } else {
    moveContent();
  }

  // Create React root and render toolbar
  const root = createRoot(toolbarContainer);
  root.render(
    <Toolbar
      projectId={projectId}
      websocketUrl={websocketUrl}
      position={position}
    />
  );

  // Store instance for updates and cleanup
  window.VYBCEL_TOOLBAR_INSTANCE = {
    root,
    version,
    destroy: () => {
      root.unmount();
      wrapper.remove();
      style.remove();
      updater.stop();
      delete window.VYBCEL_TOOLBAR_INSTANCE;
    },
  };

  // Start auto-updater
  updater.start();

  console.log(
    `[Vybcel Toolbar] Initialized v${version} with auto-update ${
      window.VYBCEL_CONFIG.autoUpdate ? "enabled" : "disabled"
    }`
  );
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initializeToolbar());
} else {
  initializeToolbar();
}
