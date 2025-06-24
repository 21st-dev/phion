"use client"

import { Icons } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CLIProjectInstall } from "@/components/ui/cli-project-install"
import { useToast } from "@/hooks/use-toast"
import { useWebSocket } from "@/hooks/use-websocket"
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
    <Card className="border-none bg-card">
      <CardContent className="bg-card p-0">
        <h3 className="text-lg font-semibold text-foreground mb-4">Open in Cursor</h3>

        <div className="space-y-6">
          {/* Step 1: Open Cursor */}
          <div>
            <div className="text-sm font-medium text-foreground mb-2">1. Open Cursor app</div>
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

          {/* Step 2: Open folder dialog */}
          <div>
            <div className="text-sm font-medium text-foreground mb-2">
              2. Create a new folder for your project
            </div>
            <div className="bg-muted/50 rounded-md p-4 border border-border">
              <div className="text-xs text-muted-foreground">
                Press{" "}
                <kbd className="px-2 py-1 bg-muted text-foreground rounded text-xs font-mono border border-border shadow-sm">
                  Cmd + O
                </kbd>{" "}
                or go to File → Open Folder, then choose an empty folder for your project
              </div>
            </div>
          </div>

          {/* Step 3: Download and Setup Project */}
          <div>
            <div className="text-sm font-medium text-foreground mb-2">
              3. Download and setup your project
            </div>
            <div className="bg-muted/50 rounded-md p-4 border border-border">
              <div className="text-xs text-muted-foreground mb-3">
                Open a terminal in Cursor{" "}
                <kbd className="px-2 py-1 bg-muted text-foreground rounded text-xs font-mono border border-border shadow-sm">
                  Cmd + J
                </kbd>{" "}
                and run these command to download and set up the project:
              </div>
              <CLIProjectInstall projectId={projectId} />
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
