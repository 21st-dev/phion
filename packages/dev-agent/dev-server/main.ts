/// <reference lib="dom" />
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

// Simple mock toolbar component for testing the UI
const MockToolbar: React.FC = () => {
  const [pendingChanges, setPendingChanges] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [projectName] = useState("Demo Project");

  const handleSave = () => {
    if (pendingChanges > 0 && !isLoading) {
      setIsLoading(true);
      setTimeout(() => {
        setPendingChanges(0);
        setIsLoading(false);
      }, 3000);
    }
  };

  const handleDiscard = () => {
    if (pendingChanges > 0 && !isLoading) {
      setPendingChanges(0);
    }
  };

  const handlePreview = () => {
    window.open("https://demo-project.netlify.app", "_blank");
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if ((keyEvent.ctrlKey || keyEvent.metaKey) && keyEvent.shiftKey) {
        switch (keyEvent.key) {
          case "S":
            keyEvent.preventDefault();
            handleSave();
            break;
          case "D":
            keyEvent.preventDefault();
            handleDiscard();
            break;
          case "P":
            keyEvent.preventDefault();
            handlePreview();
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pendingChanges, isLoading]);

  // Add test controls to window
  useEffect(() => {
    (window as any).phionTest = {
      setPendingChanges,
      addPendingChange: () => setPendingChanges(prev => prev + 1),
      resetPendingChanges: () => setPendingChanges(0),
    };

    console.log('[Test Mode] Test controls available:');
    console.log('window.phionTest.setPendingChanges(3) - Set pending changes count');
    console.log('window.phionTest.addPendingChange() - Add one pending change');
    console.log('window.phionTest.resetPendingChanges() - Reset to 0');
  }, []);

  return React.createElement(
    'div',
    {
      style: {
        backgroundColor: "transparent",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: "14px",
        flexShrink: 0,
      }
    },
    [
      // Left side - Project name and status
      React.createElement(
        'div',
        { 
          key: 'left-side',
          style: { display: "flex", alignItems: "center", gap: "12px" }
        },
        [
          // Project name
          React.createElement(
            'div',
            {
              key: 'project-name',
              style: { 
                display: "flex", 
                alignItems: "center", 
                gap: "6px", 
                color: "white", 
                fontWeight: "500" 
              }
            },
            projectName
          ),
          
          // Pending changes badge
          pendingChanges > 0 && React.createElement(
            'div',
            {
              key: 'pending-badge',
              style: {
                backgroundColor: "rgba(251, 191, 36, 0.15)",
                color: "#fbbf24",
                border: "1px solid rgba(251, 191, 36, 0.3)",
                padding: "2px 4px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: "500",
                backdropFilter: "blur(8px)",
              }
            },
            `${pendingChanges} unsaved`
          )
        ]
      ),

      // Right side - Action buttons
      React.createElement(
        'div',
        {
          key: 'right-side',
          style: { display: "flex", alignItems: "center", gap: "8px" }
        },
        [
          // Discard button
          React.createElement('button', {
            key: 'discard-btn',
            onClick: handleDiscard,
            disabled: pendingChanges === 0 || isLoading,
            style: {
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              color: pendingChanges > 0 ? "#ef4444" : "rgba(255, 255, 255, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: "500",
              cursor: pendingChanges > 0 ? "pointer" : "not-allowed",
              transition: "all 0.2s",
            }
          }, "Discard"),

          // Save button
          React.createElement('button', {
            key: 'save-btn',
            onClick: handleSave,
            disabled: pendingChanges === 0 || isLoading,
            style: {
              backgroundColor: pendingChanges > 0 ? "#3b82f6" : "rgba(255, 255, 255, 0.1)",
              color: pendingChanges > 0 ? "#ffffff" : "rgba(255, 255, 255, 0.5)",
              border: pendingChanges > 0 ? "none" : "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: "500",
              cursor: pendingChanges > 0 ? "pointer" : "not-allowed",
              transition: "all 0.2s",
              boxShadow: pendingChanges > 0 ? "0 1px 2px rgba(0, 0, 0, 0.1)" : "none",
            }
          }, isLoading ? "Saving..." : "Save"),

          // Preview button with icon
          React.createElement('button', {
            key: 'preview-btn',
            onClick: handlePreview,
            style: {
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "6px",
              padding: "6px 8px",
              fontSize: "12px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }
          }, 
          // SVG Icon
          React.createElement('svg', {
            key: 'preview-icon',
            xmlns: "http://www.w3.org/2000/svg",
            width: "14",
            height: "14",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "#FFF",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            style: { display: "block" }
          }, [
            React.createElement('path', {
              key: 'path1',
              d: "M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"
            }),
            React.createElement('path', {
              key: 'path2', 
              d: "m21 3-9 9"
            }),
            React.createElement('path', {
              key: 'path3',
              d: "M15 3h6v6"
            })
          ]))
        ]
      )
    ]
  );
};

// Simple wrapper component
const TestWrapper: React.FC = () => {
  // Add CSS styles to head
  useEffect(() => {
    const style = document.createElement('style');
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

  return React.createElement(
    'div',
    { key: 'main-wrapper' },
    [
      // Fixed Toolbar
      React.createElement(
        'div',
        { 
          key: 'toolbar', 
          className: 'phion-toolbar',
          style: { 
            backgroundColor: "#000000",
          } 
        },
        React.createElement(MockToolbar)
      ),

      // Container
      React.createElement(
        'div',
        {
          key: 'container',
          className: 'phion-container',
          style: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999998,
          }
        },
        // Content wrapper
        React.createElement(
          'div',
          {
            key: 'content',
            id: 'phion-content-wrapper',
            className: 'phion-content',
            style: {
              width: "100%",
              height: "100%",
              backgroundColor: "#ffffff",
              overflow: "auto",
              position: "relative",
            }
          }
        )
      )
    ]
  );
};

// Initialize the test environment
function initializeTestToolbar() {
  console.log('[Test Mode] Initializing Phion Toolbar Test Environment');
  
  // Store original body content
  const originalContent = Array.from(document.body.children) as Element[];
  
  // Create main container
  const rootContainer = document.createElement('div');
  rootContainer.id = 'phion-test-container';
  
  // Reset body styles
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.overflow = 'hidden';
  
  // Add container to body
  document.body.appendChild(rootContainer);
  
  // Create React root and render
  const root = createRoot(rootContainer);
  root.render(React.createElement(TestWrapper));
  
  // Move original content after render
  setTimeout(() => {
    const contentWrapper = document.getElementById('phion-content-wrapper');
    if (contentWrapper) {
      originalContent.forEach((child: Element) => {
        if ((child as HTMLElement).id !== 'phion-test-container') {
          contentWrapper.appendChild(child);
        }
      });
      console.log('[Test Mode] Content moved to wrapper');
      console.log('[Test Mode] Test environment ready!');
    }
  }, 100);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeTestToolbar);
} else {
  initializeTestToolbar();
} 