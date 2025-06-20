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
  const [isVisible, setIsVisible] = React.useState(false);

  // Add CSS styles to head and keyboard handler
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes phion-content-margin-show {
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

      @keyframes phion-content-margin-hide {
        0% {
          margin: 48px 8px 8px 8px;
          width: calc(100% - 16px);
          height: calc(100% - 56px);
          border-radius: 6px;
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        100% {
          margin: 0;
          width: 100%;
          height: 100%;
          border-radius: 0;
          box-shadow: none;
        }
      }

      @keyframes phion-toolbar-appear {
        0% {
          opacity: 0;
          transform: translateY(-100%);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes phion-toolbar-disappear {
        0% {
          opacity: 1;
          transform: translateY(0);
        }
        100% {
          opacity: 0;
          transform: translateY(-100%);
        }
      }

      .phion-container {
        background-color: #000000;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999998;
      }

      .phion-container.hidden {
        display: none;
      }

      .phion-toolbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 999999;
        opacity: 0;
        transform: translateY(-100%);
      }

      .phion-toolbar.visible {
        animation: phion-toolbar-appear 400ms ease-out both;
      }

      .phion-toolbar.hidden {
        animation: phion-toolbar-disappear 400ms ease-out both;
      }

      .phion-content {
        margin: 0;
        width: 100%;
        height: 100%;
        border-radius: 0;
        box-shadow: none;
        box-sizing: border-box;
        background-color: #ffffff;
        overflow: auto;
        position: relative;
      }

      .phion-content.visible {
        animation: phion-content-margin-show 600ms ease-out both;
      }

      .phion-content.hidden {
        animation: phion-content-margin-hide 600ms ease-out both;
      }

      /* Apple-style custom scrollbar */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      ::-webkit-scrollbar-track {
        background: transparent;
      }

      ::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 10px;
        border: 1px solid transparent;
        background-clip: content-box;
      }

      ::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.3);
        background-clip: content-box;
      }

      ::-webkit-scrollbar-thumb:active {
        background: rgba(0, 0, 0, 0.4);
        background-clip: content-box;
      }

      /* Dark mode scrollbar */
      @media (prefers-color-scheme: dark) {
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          background-clip: content-box;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
          background-clip: content-box;
        }

        ::-webkit-scrollbar-thumb:active {
          background: rgba(255, 255, 255, 0.4);
          background-clip: content-box;
        }
      }

      /* Fallback for Firefox */
      * {
        scrollbar-width: thin;
        scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
      }

      @media (prefers-color-scheme: dark) {
        * {
          scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        }
      }
    `;
    document.head.appendChild(style);

    // Keyboard handler for Cmd+/ toggle
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        console.log('[Phion] Toggle toolbar, current state:', isVisible);
        setIsVisible(prev => {
          const newState = !prev;
          
          if (newState) {
            // Show toolbar - move content to wrapper immediately, then show with delay for smooth transition
            moveContentToWrapper();
            setTimeout(() => {
              // Container will be shown by React state change
            }, 50);
          } else {
            // Hide toolbar - move content to body immediately for instant full-screen
            moveContentToBody();
          }
          
          return newState;
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.head.removeChild(style);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Function to move content to body (full screen mode)
  const moveContentToBody = () => {
    const contentWrapper = document.getElementById('phion-content-wrapper');
    const body = document.body;
    
    if (contentWrapper) {
      // Reset body styles for full screen
      body.style.margin = '';
      body.style.padding = '';
      body.style.overflow = '';
      
      // Move all children from wrapper to body
      while (contentWrapper.firstChild) {
        body.appendChild(contentWrapper.firstChild);
      }
      
      console.log('[Phion] Content moved to body for full screen');
    }
  };

  // Function to move content to wrapper (toolbar mode)  
  const moveContentToWrapper = () => {
    const contentWrapper = document.getElementById('phion-content-wrapper');
    const body = document.body;
    
    if (contentWrapper) {
      // Set body styles for toolbar mode
      body.style.margin = '0';
      body.style.padding = '0';
      body.style.overflow = 'hidden';
      
      // Move content from body to wrapper (except phion container and scripts)
      const elementsToMove = Array.from(body.children).filter(child => 
        child.id !== 'phion-root-container' && 
        !child.matches('script, style, link')
      );
      
      elementsToMove.forEach(element => {
        contentWrapper.appendChild(element);
      });
      
      console.log('[Phion] Content moved to wrapper for toolbar mode');
    }
  };

  return React.createElement("div", { key: "main-wrapper" }, [
    // Fixed Toolbar
    React.createElement(
      "div",
      {
        key: "toolbar",
        className: `phion-toolbar ${isVisible ? 'visible' : 'hidden'}`,
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
        className: `phion-container ${isVisible ? '' : 'hidden'}`,
      },
      // Content wrapper
      React.createElement("div", {
        key: "content",
        id: "phion-content-wrapper",
        className: `phion-content ${isVisible ? 'visible' : 'hidden'}`,
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

    // Since toolbar starts hidden, keep content in body initially
    console.log("[Phion Init] Toolbar starts hidden, content remains in body");

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
