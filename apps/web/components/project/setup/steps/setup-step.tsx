"use client"

import { Icons } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useWebSocket } from "@/hooks/use-websocket"
import { Copy } from "lucide-react"
import { useEffect, useState } from "react"

interface SetupStepProps {
  onDeploy: () => void
  projectId: string
  agentConnected?: boolean
}

export function SetupStep({ onDeploy, projectId, agentConnected = false }: SetupStepProps) {
  const { success, error } = useToast()
  const [countdown, setCountdown] = useState<number | null>(null)

  // WebSocket для отслеживания подключения агента
  const { isConnected } = useWebSocket({
    projectId,
    onAgentConnected: () => {
      console.log("🟢 [SetupStep] Agent connected")
      success("Agent connected", "Your project is now syncing automatically")
    },
    onAgentDisconnected: () => {
      console.log("🔴 [SetupStep] Agent disconnected")
      error("Agent disconnected", "Make sure your development server is running")
    },
  })

  // Обратный отсчет после подключения агента
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (agentConnected && countdown === null) {
      // Начинаем отсчет только если агент подключен и отсчет еще не начался
      setCountdown(5)
    }

    if (countdown !== null && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null) return null
          if (prev <= 1) {
            // Отсчет закончился - редиректим
            onDeploy()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [agentConnected, countdown, onDeploy])

  const handleOpenCursor = () => {
    try {
      window.open("cursor://", "_self")
      success("Opening Cursor", "If Cursor doesn't open automatically, launch it manually")
    } catch (error) {
      console.log("Could not open Cursor automatically")
      success("Open Cursor manually", "Launch Cursor from your Applications folder")
    }
  }

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText("chmod +x setup.sh && ./setup.sh")
      success("Copied to clipboard", "Command copied successfully")
    } catch (err) {
      error("Failed to copy", "Please copy the command manually")
    }
  }

  const handleContinueClick = () => {
    // Если пользователь нажал кнопку до окончания отсчета, сразу редиректим
    if (countdown !== null) {
      setCountdown(null)
    }
    onDeploy()
  }

  const getButtonText = () => {
    if (!agentConnected) {
      return "Waiting for Connection..."
    }
    if (countdown !== null && countdown > 0) {
      return `Continue to Development ${countdown}`
    }
    return "Continue to Development"
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-6 bg-card">
        <h3 className="text-lg font-semibold text-foreground mb-4">Open in Cursor</h3>
        <p className="text-muted-foreground mb-6">
          Open your project folder in Cursor and wait for the automatic setup to complete.
        </p>

        <div className="space-y-6">
          {/* Step 1: Extract ZIP */}
          <div>
            <div className="text-sm font-medium text-foreground mb-2">
              1. Extract the downloaded ZIP file
            </div>
            <div className="bg-muted/50 rounded-md p-4 border border-border">
              <div className="text-xs text-muted-foreground">
                Double-click the ZIP file in your Downloads folder to extract it
              </div>
            </div>
          </div>

          {/* Step 2: Open Cursor */}
          <div>
            <div className="text-sm font-medium text-foreground mb-2">2. Open Cursor app</div>
            <div className="bg-muted/50 rounded-md p-4 border border-border space-y-3">
              <Button size="default" onClick={handleOpenCursor} className="w-auto">
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
            <div className="bg-muted/50 rounded-md p-4 border border-border">
              <div className="text-xs text-muted-foreground">
                Press{" "}
                <kbd className="px-2 py-1 bg-muted text-foreground rounded text-xs font-mono border border-border shadow-sm">
                  Cmd + O
                </kbd>{" "}
                or go to File → Open Folder, then select your extracted project folder
              </div>
            </div>
          </div>

          {/* Step 4: Run setup command */}
          <div>
            <div className="text-sm font-medium text-foreground mb-2">4. Run this command</div>
            <div className="bg-muted/50 rounded-md p-4 border border-border space-y-3">
              <div className="text-xs text-muted-foreground">
                Open a terminal by pressing{" "}
                <kbd className="px-2 py-1 bg-muted text-foreground rounded text-xs font-mono border border-border shadow-sm">
                  Cmd + J
                </kbd>{" "}
                or go to Terminal → New Terminal from the menu bar
              </div>
              <div className="bg-background border border-border rounded p-3 flex items-center justify-between">
                <code className="text-xs font-mono text-foreground">
                  chmod +x setup.sh && ./setup.sh
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyCommand}
                  className="h-6 w-6 p-0 ml-2 hover:bg-muted/50 transition-colors"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Paste this command and press Enter
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <Button
              size="lg"
              onClick={handleContinueClick}
              className="w-full"
              disabled={!agentConnected}
            >
              {getButtonText()}
            </Button>
            {agentConnected && countdown !== null && countdown > 0 && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Auto redirect in {countdown} seconds
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
