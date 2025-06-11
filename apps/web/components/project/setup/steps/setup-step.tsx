"use client";

import { Button } from "@/components/geist/button";
import { Material } from "@/components/geist/material";
import { Snippet } from "@/components/geist/snippet";
import { Icons } from "@/components/icons";
import { CheckCircle, Clock } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";

interface SetupStepProps {
  onDeploy: () => void;
  projectId: string;
  agentConnected?: boolean;
}

export function SetupStep({
  onDeploy,
  projectId,
  agentConnected = false,
}: SetupStepProps) {
  const { success: showSuccess, info: showInfo } = useToast();

  // WebSocket для отслеживания подключения агента
  const { isConnected } = useWebSocket({
    projectId,
    onAgentConnected: () => {
      console.log("🟢 [SetupStep] Agent connected");
      showSuccess(
        "Agent connected",
        "Your project is now syncing automatically"
      );
    },
    onAgentDisconnected: () => {
      console.log("🔴 [SetupStep] Agent disconnected");
      showInfo(
        "Agent disconnected",
        "Make sure your development server is running"
      );
    },
  });

  const handleOpenCursor = () => {
    try {
      window.open("cursor://", "_self");
      showSuccess(
        "Opening Cursor",
        "If Cursor doesn't open automatically, launch it manually"
      );
    } catch (error) {
      console.log("Could not open Cursor automatically");
      showInfo(
        "Open Cursor manually",
        "Launch Cursor from your Applications folder"
      );
    }
  };

  return (
    <Material type="base" className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4 font-sans">
        Open in Cursor
      </h3>
      <p className="text-muted-foreground mb-6 font-sans">
        Open your project folder and start the development server to begin
        coding with AI.
      </p>

      <div className="space-y-6">
        {/* Step 1: Extract ZIP */}
        <div>
          <div className="text-sm font-medium text-foreground mb-2 font-sans">
            1. Extract the downloaded ZIP file
          </div>
          <div className="bg-accents-1 rounded-md p-4 border border-border">
            <div className="font-sans text-xs text-muted-foreground">
              Double-click the ZIP file in your Downloads folder to extract it
            </div>
          </div>
        </div>

        {/* Step 2: Open Cursor */}
        <div>
          <div className="text-sm font-medium text-foreground mb-2 font-sans">
            2. Open Cursor app
          </div>
          <div className="bg-accents-1 rounded-md p-4 border border-border space-y-3">
            <Button
              size="medium"
              onClick={handleOpenCursor}
              prefix={<Icons.cursor className="w-3.5 h-3.5" />}
            >
              Open Cursor
            </Button>
            <div className="font-sans text-xs text-muted-foreground">
              Or manually launch Cursor from your Applications folder or dock
            </div>
          </div>
        </div>

        {/* Step 3: Open folder dialog */}
        <div>
          <div className="text-sm font-medium text-foreground mb-2 font-sans">
            3. Open the project folder
          </div>
          <div className="bg-accents-1 rounded-md p-4 border border-border">
            <div className="font-sans text-xs text-muted-foreground">
              Press{" "}
              <kbd className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs font-mono">
                Cmd + O
              </kbd>{" "}
              or go to File → Open Folder
            </div>
          </div>
        </div>

        {/* Step 4: Select project folder */}
        <div>
          <div className="text-sm font-medium text-foreground mb-2 font-sans">
            4. Select your extracted project folder
          </div>
          <div className="bg-accents-1 rounded-md p-4 border border-border">
            <div className="font-sans text-xs text-muted-foreground">
              Navigate to and select the extracted project folder, then click
              "Open"
            </div>
          </div>
        </div>

        {/* Step 5: Open terminal */}
        <div>
          <div className="text-sm font-medium text-foreground mb-2 font-sans">
            5. Open terminal in Cursor
          </div>
          <div className="bg-accents-1 rounded-md p-4 border border-border">
            <div className="font-sans text-xs text-muted-foreground">
              Press{" "}
              <kbd className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs font-mono">
                Cmd + J
              </kbd>{" "}
              or go to Terminal → New Terminal
            </div>
          </div>
        </div>

        {/* Step 6: Run command */}
        <div>
          <div className="text-sm font-medium text-foreground mb-2 font-sans">
            6. Start the project
          </div>
          <Snippet text="pnpm start" />
          <div className="mt-2 text-xs text-muted-foreground font-sans">
            Paste this command in the terminal and press Enter. This will
            install dependencies and start both the dev server and sync.
          </div>
        </div>

        {/* Step 7: Wait for connection */}
        <div>
          <div className="text-sm font-medium text-foreground mb-2 font-sans">
            7. Waiting for connection
          </div>
          <div
            className={`bg-accents-1 rounded-md p-4 border border-border ${
              agentConnected ? "border-green-500/20 bg-green-50/50" : ""
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {agentConnected ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <Clock className="h-5 w-5 text-muted-foreground animate-pulse" />
                )}
              </div>
              <div>
                <div className="font-sans text-xs text-muted-foreground">
                  {agentConnected
                    ? "✅ Connected! Your project is now syncing automatically."
                    : "⏳ Waiting for your local development agent to connect..."}
                </div>
                {!agentConnected && (
                  <div className="font-sans text-xs text-muted-foreground/70 mt-1">
                    Make sure you ran "pnpm start" in your terminal
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <Button
            size="large"
            onClick={onDeploy}
            fullWidth
            disabled={!agentConnected}
          >
            {agentConnected
              ? "Continue to Development"
              : "Waiting for Connection..."}
          </Button>
        </div>
      </div>
    </Material>
  );
}
