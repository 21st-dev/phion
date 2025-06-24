"use client"

import { StatusDot } from "@/components/geist/status-dot"

interface ProjectSetupSidebarProps {
  agentConnected?: boolean
}

export function ProjectSetupSidebar({ agentConnected = false }: ProjectSetupSidebarProps) {
  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="p-4 border border-border rounded-lg">
        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
          Agent Status
        </div>
        <div className="flex items-center gap-3">
          <StatusDot state={agentConnected ? "READY" : "QUEUED"} />
          <div>
            <div className="text-sm font-medium">
              {agentConnected ? "Connected" : "Waiting for connection"}
            </div>
            <div className="text-xs text-muted-foreground">
              {agentConnected
                ? "Cursor agent is connected and ready"
                : "Open project in Cursor to connect"}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
