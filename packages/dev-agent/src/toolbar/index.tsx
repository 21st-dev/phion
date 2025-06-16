import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Toolbar } from "./Toolbar";

declare global {
  interface Window {
    PHION_CONFIG: {
      projectId: string;
      websocketUrl: string;
      position: "top" | "bottom";
      version: string;
      autoUpdate: boolean;
      updateChannel: "stable" | "beta" | "dev";
    };
    PHION_TOOLBAR_INSTANCE?: {
      root: any;
      version: string;
      destroy: () => void;
    };
  }
}

// Simple wrapper component with animations
const SimpleWrapper: React.FC<{
  projectId: string;
  websocketUrl: string;
  position: "top" | "bottom";
}> = ({ projectId, websocketUrl, position }) => {
  // Add CSS styles to head
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes phion-content-margin {
        0% {
          margin: 0;
          width: 100%;
          height: 100%;
          border-radius: 0;
          box-shadow: none;
        }
        100% {
          margin: 48px 8px 8px 8px;
          width: calc(100% - 16px);
          height: calc(100% - 56px);
          border-radius: 6px;
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
      }

      @keyframes phion-toolbar-appear {
        0% {
          opacity: 0;
        }
        100% {
          opacity: 1;
        }
      }

      .phion-container {
        background-color: #000000;
      }

      .phion-toolbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 999999;
        opacity: 0;
        animation: phion-toolbar-appear 400ms ease-out 1.6s both;
      }

      .phion-content {
        margin: 0;
        width: 100%;
        height: 100%;
        border-radius: 0;
        box-shadow: none;
        box-sizing: border-box;
        animation: phion-content-margin 600ms ease-out 1s both;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return React.createElement("div", { key: "main-wrapper" }, [
    // Fixed Toolbar
    React.createElement(
      "div",
      {
        key: "toolbar",
        className: "phion-toolbar",
        style: {
          backgroundColor: "#000000",
        },
      },
      React.createElement(Toolbar, {
        projectId,
        websocketUrl,
        position,
      })
    ),

    // Container
    React.createElement(
      "div",
      {
        key: "container",
        className: "phion-container",
        style: {
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999998,
        },
      },
      // Content wrapper
      React.createElement("div", {
        key: "content",
        id: "phion-content-wrapper",
        className: "phion-content",
        style: {
          width: "100%",
          height: "100%",
          backgroundColor: "#ffffff",
          overflow: "auto",
          position: "relative",
        },
      })
    ),
  ]);
};

// Initialize toolbar when DOM is ready
function initializeToolbar() {
  if (!window.PHION_CONFIG) {
    console.error("[Phion Toolbar] Configuration not found");
    return;
  }

  const { projectId, websocketUrl, position, version } = window.PHION_CONFIG;

  // Check if toolbar already exists and is the same version
  if (window.PHION_TOOLBAR_INSTANCE?.version === version) {
    console.log("[Phion Toolbar] Already initialized with version", version);
    return;
  }

  // Check if initialization is already in progress
  if ((window as any).PHION_TOOLBAR_INITIALIZING) {
    console.log("[Phion Toolbar] Initialization already in progress");
    return;
  }

  // Mark as initializing
  (window as any).PHION_TOOLBAR_INITIALIZING = true;

  try {
    // Cleanup existing instance
    if (window.PHION_TOOLBAR_INSTANCE) {
      console.log("[Phion Toolbar] Cleaning up existing instance");
      window.PHION_TOOLBAR_INSTANCE.destroy();
    }

    console.log("[Phion Init] Starting simple toolbar initialization...");

    // Store original body content
    const originalContent = Array.from(document.body.children) as Element[];

    // Create main container for React rendering
    const rootContainer = document.createElement("div");
    rootContainer.id = "phion-root-container";

    // Reset body styles to prevent conflicts
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflow = "hidden";

    // Add container to body
    document.body.appendChild(rootContainer);

    // Create React root and render
    const root = createRoot(rootContainer);

    console.log("[Phion Init] Rendering simple wrapper...");
    root.render(
      React.createElement(SimpleWrapper, {
        projectId,
        websocketUrl,
        position,
      })
    );

    // Move original content to the content wrapper after render
    setTimeout(() => {
      const contentWrapper = document.getElementById("phion-content-wrapper");
      if (contentWrapper) {
        originalContent.forEach((child: Element) => {
          if ((child as HTMLElement).id !== "phion-root-container") {
            contentWrapper.appendChild(child);
          }
        });
        console.log("[Phion Init] Content moved successfully");
      }
    }, 100);

    // Store instance for cleanup
    window.PHION_TOOLBAR_INSTANCE = {
      root,
      version,
      destroy: () => {
        root.unmount();
        rootContainer.remove();
        delete window.PHION_TOOLBAR_INSTANCE;
      },
    };

    console.log(
      `[Phion Init] Simple toolbar v${version} initialized successfully`
    );
  } catch (error) {
    console.error("[Phion Toolbar] Initialization failed:", error);
  } finally {
    // Always clear initialization flag
    delete (window as any).PHION_TOOLBAR_INITIALIZING;
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initializeToolbar());
} else {
  initializeToolbar();
}
