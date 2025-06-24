"use client"

import { useProject } from "@/components/project/project-layout-client"
import NumberFlow from "@number-flow/react"
import type { ProjectRow } from "@shipvibes/database"
import { CheckCircle, Clock } from "lucide-react"
import { useCallback, useEffect } from "react"

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
  // Use project context instead of creating a new WebSocket connection
  const { project: contextProject, initializationProgress, isConnected } = useProject()

  // Check if project is initializing based on deploy status
  const isInitializing = contextProject.deploy_status === "pending"
  const isReady = contextProject.deploy_status === "ready" && !contextProject.netlify_url

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

  // Auto-complete this step when project is ready
  useEffect(() => {
    if (isReady && !isCompleted) {
      console.log("✅ [DownloadStep] Auto-completing step as project is ready")
      // Add a small delay to show the success message briefly before moving to next step
      onDownload()
    }
  }, [isReady, isCompleted, onDownload])

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground font-sans">Project Initialization</h3>

      {/* Initialization Progress Section */}
      {isInitializing && (
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex-shrink-0">
            <Clock className="w-5 h-5 text-muted-foreground animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">
                {initializationProgress.stage || "Initializing project..."}
              </span>
              <div className="text-sm font-mono text-muted-foreground">
                <NumberFlow
                  value={initializationProgress.progress / 100}
                  format={{
                    style: "percent",
                    maximumFractionDigits: 0,
                  }}
                />
              </div>
            </div>
            {initializationProgress.message && (
              <p className="text-sm text-muted-foreground">{initializationProgress.message}</p>
            )}
            <div className="mt-2 w-full bg-border rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${initializationProgress.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Ready State */}
      {isReady && (
        <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex-shrink-0">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <span className="text-sm font-medium text-green-800 dark:text-green-200">
              Project initialized successfully
            </span>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              Your project is ready for the next step.
            </p>
          </div>
        </div>
      )}

      {/* Waiting State */}
      {!isInitializing && !isReady && (
        <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex-shrink-0">
            <Clock className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <span className="text-sm font-medium text-foreground">
              Waiting for project initialization...
            </span>
            <p className="text-sm text-muted-foreground mt-1">
              Please wait while we prepare your project files.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
