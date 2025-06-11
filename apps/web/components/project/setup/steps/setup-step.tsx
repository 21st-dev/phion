"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icons } from "@/components/icons";
import { CheckCircle, Clock, Copy } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

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
  const { success, error } = useToast();
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // WebSocket для отслеживания подключения агента
  const { isConnected } = useWebSocket({
    projectId,
    onAgentConnected: () => {
      console.log("🟢 [SetupStep] Agent connected");
      success("Agent connected", "Your project is now syncing automatically");
    },
    onAgentDisconnected: () => {
      console.log("🔴 [SetupStep] Agent disconnected");
      error(
        "Agent disconnected",
        "Make sure your development server is running"
      );
    },
  });

  // Обратный отсчет после подключения агента
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (agentConnected && countdown === null) {
      // Начинаем отсчет только если агент подключен и отсчет еще не начался
      setCountdown(10);
    }

    if (countdown !== null && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            // Отсчет закончился - редиректим
            onDeploy();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [agentConnected, countdown, onDeploy]);

  const handleOpenCursor = () => {
    try {
      window.open("cursor://", "_self");
      success(
        "Opening Cursor",
        "If Cursor doesn't open automatically, launch it manually"
      );
    } catch (error) {
      console.log("Could not open Cursor automatically");
      success(
        "Open Cursor manually",
        "Launch Cursor from your Applications folder"
      );
    }
  };

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText("pnpm start");
      setCopied(true);
      success("Copied to clipboard", "Command copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleContinueClick = () => {
    // Если пользователь нажал кнопку до окончания отсчета, сразу редиректим
    if (countdown !== null) {
      setCountdown(null);
    }
    onDeploy();
  };

  const getButtonText = () => {
    if (!agentConnected) {
      return "Waiting for Connection...";
    }
    if (countdown !== null && countdown > 0) {
      return `Continue to Development (${countdown})`;
    }
    return "Continue to Development";
  };

  return (
    <Card className="border-border">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Open in Cursor
        </h3>
        <p className="text-muted-foreground mb-6">
          Open your project folder and start the development server to begin
          coding with AI.
        </p>

        <div className="space-y-6">
          {/* Step 1: Extract ZIP */}
          <div>
            <div className="text-sm font-medium text-foreground mb-2">
              1. Extract the downloaded ZIP file
            </div>
            <div className="bg-muted rounded-md p-4 border border-border">
              <div className="text-xs text-muted-foreground">
                Double-click the ZIP file in your Downloads folder to extract it
              </div>
            </div>
          </div>

          {/* Step 2: Open Cursor */}
          <div>
            <div className="text-sm font-medium text-foreground mb-2">
              2. Open Cursor app
            </div>
            <div className="bg-muted rounded-md p-4 border border-border space-y-3">
              <Button
                size="default"
                onClick={handleOpenCursor}
                className="w-auto"
              >
                <Icons.cursor className="w-3.5 h-3.5 mr-2" />
                Open Cursor
              </Button>
              <div className="text-xs text-muted-foreground">
                Or manually launch Cursor from your Applications folder or dock
              </div>
            </div>
          </div>

          {/* Step 3: Open folder dialog */}
          <div>
            <div className="text-sm font-medium text-foreground mb-2">
              3. Open the project folder
            </div>
            <div className="bg-muted rounded-md p-4 border border-border">
              <div className="text-xs text-muted-foreground">
                Press{" "}
                <kbd className="px-2 py-1 bg-background text-foreground rounded text-xs font-mono border border-border">
                  Cmd + O
                </kbd>{" "}
                or go to File → Open Folder
              </div>
            </div>
          </div>

          {/* Step 4: Select project folder */}
          <div>
            <div className="text-sm font-medium text-foreground mb-2">
              4. Select your extracted project folder
            </div>
            <div className="bg-muted rounded-md p-4 border border-border">
              <div className="text-xs text-muted-foreground">
                Navigate to and select the extracted project folder, then click
                "Open"
              </div>
            </div>
          </div>

          {/* Step 5: Open terminal */}
          <div>
            <div className="text-sm font-medium text-foreground mb-2">
              5. Open terminal in Cursor
            </div>
            <div className="bg-muted rounded-md p-4 border border-border">
              <div className="text-xs text-muted-foreground">
                Press{" "}
                <kbd className="px-2 py-1 bg-background text-foreground rounded text-xs font-mono border border-border">
                  Cmd + J
                </kbd>{" "}
                or go to Terminal → New Terminal
              </div>
            </div>
          </div>

          {/* Step 6: Run command */}
          <div>
            <div className="text-sm font-medium text-foreground mb-2">
              6. Start the project
            </div>
            <div className="bg-muted rounded-md p-4 border border-border">
              <div className="flex items-center justify-between">
                <code className="font-mono text-sm text-foreground">
                  pnpm start
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyCommand}
                  className="h-8 w-8 p-0"
                >
                  {copied ? (
                    <CheckCircle className="h-4 w-4 text-primary" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Paste this command in the terminal and press Enter. This will
              install dependencies and start both the dev server and sync.
            </div>
          </div>

          {/* Step 7: Wait for connection */}
          <div>
            <div className="text-sm font-medium text-foreground mb-2">
              7. Waiting for connection
            </div>
            <div
              className={`bg-muted rounded-md p-4 border transition-colors ${
                agentConnected
                  ? "border-primary/50 bg-primary/5"
                  : "border-border"
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {agentConnected ? (
                    <CheckCircle className="h-5 w-5 text-primary" />
                  ) : (
                    <Clock className="h-5 w-5 text-muted-foreground animate-pulse" />
                  )}
                </div>
                <div>
                  <div className="text-xs text-foreground">
                    {agentConnected
                      ? "Connected! Your project is now syncing automatically."
                      : "Waiting for your local development agent to connect..."}
                  </div>
                  {!agentConnected && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Make sure you ran "pnpm start" in your terminal
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <Button
              size="lg"
              onClick={handleContinueClick}
              className="w-full"
              disabled={!agentConnected}
            >
              {getButtonText()}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
