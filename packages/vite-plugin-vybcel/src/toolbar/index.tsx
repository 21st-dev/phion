import React from "react";
import { createRoot } from "react-dom/client";
import { Toolbar } from "./Toolbar";

declare global {
  interface Window {
    VYBCEL_CONFIG: {
      projectId: string;
      websocketUrl: string;
      position: "top" | "bottom";
    };
  }
}

// Initialize toolbar when DOM is ready
function initializeToolbar() {
  if (!window.VYBCEL_CONFIG) {
    console.error("[Vybcel Toolbar] Configuration not found");
    return;
  }

  const { projectId, websocketUrl, position } = window.VYBCEL_CONFIG;

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
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeToolbar);
} else {
  initializeToolbar();
}
