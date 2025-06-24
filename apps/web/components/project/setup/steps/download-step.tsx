"use client"

import { Button } from "@/components/geist/button"
import { Material } from "@/components/geist/material"
import { useProject } from "@/components/project/project-layout-client"
import { CLIProjectInstall } from "@/components/ui/cli-project-install"
import NumberFlow from "@number-flow/react"
import type { ProjectRow } from "@shipvibes/database"
import { Download } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

interface DownloadStepProps {
  project: ProjectRow
  projectId: string
  onDownload: () => void
  isCompleted?: boolean
  onInitializationComplete?: () => void
}

export function DownloadStep({
  project,
  projectId,
  onDownload,
  isCompleted = false,
  onInitializationComplete,
}: DownloadStepProps) {
  const [isDownloading, setIsDownloading] = useState(false)

  // Use project context instead of creating a new WebSocket connection
  const { project: contextProject, initializationProgress, isConnected } = useProject()

  // Check if project is initializing based on deploy status
  const isInitializing = contextProject.deploy_status === "pending"

  // Memoize the completion callback to prevent infinite re-renders
  const stableOnInitializationComplete = useCallback(() => {
    onInitializationComplete?.()
  }, [onInitializationComplete])

  // Watch for initialization completion via progress
  useEffect(() => {
    console.log("📊 [DownloadStep] Progress state changed:", {
      progress: initializationProgress.progress,
      stage: initializationProgress.stage,
      message: initializationProgress.message,
      isInitializing,
    })

    if (initializationProgress.progress >= 100 && isInitializing) {
      console.log("✅ [DownloadStep] Initialization completed via progress")
      stableOnInitializationComplete()
    }
  }, [initializationProgress.progress, isInitializing, stableOnInitializationComplete])

  // Watch for deploy status changes
  useEffect(() => {
    if (contextProject.deploy_status !== "pending" && contextProject.deploy_status !== null) {
      console.log("✅ [DownloadStep] Initialization completed via deploy status")
      stableOnInitializationComplete()
    }
  }, [contextProject.deploy_status, stableOnInitializationComplete])

  const handleDownload = () => {
    if (isInitializing || isDownloading) return

    setIsDownloading(true)

    const url = `/api/projects/${project.id}/download`
    console.log(`🔽 [DownloadStep] Opening download in new tab: ${url}`)

    // Simply open the download URL in a new tab
    window.open(url, "_blank")

    // Mark as downloaded immediately
    onDownload()

    // Reset state after a short delay
    setTimeout(() => {
      setIsDownloading(false)
      console.log("✅ [DownloadStep] Download state reset")
    }, 1000)
  }

  const getDownloadButtonText = () => {
    if (isInitializing) return "Preparing..."
    if (isDownloading) return "Downloading..."
    return "Download"
  }

  return (
    <Material type="base" className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4 font-sans">Download Project</h3>
      <div className="space-y-6">
        {/* Download Button Section */}
        <div className="flex items-center gap-4">
          <Button
            type="primary"
            size="medium"
            onClick={handleDownload}
            loading={isDownloading || isInitializing}
            disabled={isInitializing}
            className="pr-1"
            prefix={!isDownloading && !isInitializing ? <Download size={16} /> : undefined}
          >
            <div className="flex items-center gap-2">
              {getDownloadButtonText()}

              {isInitializing && (
                <div className="text-sm text-muted-foreground min-w-[50px]">
                  <NumberFlow
                    value={initializationProgress.progress / 100}
                    format={{
                      style: "percent",
                      maximumFractionDigits: 0,
                    }}
                  />
                </div>
              )}
            </div>
          </Button>

          <div className="flex-1">
            {!isInitializing && !isCompleted && (
              <div className="text-sm text-muted-foreground">
                Download your project files to get started with local development.
              </div>
            )}

            {isDownloading && (
              <div className="text-sm text-muted-foreground">Opening download...</div>
            )}
          </div>
        </div>

        {/* CLI Commands Section */}
        {!isInitializing && <CLIProjectInstall projectId={projectId} />}
      </div>
    </Material>
  )
}
