"use client"

import { Button } from "@/components/geist/button"
import { Material } from "@/components/geist/material"
import { useProject } from "@/components/project/project-layout-client"
import NumberFlow from "@number-flow/react"
import type { ProjectRow } from "@shipvibes/database"
import { useCallback, useEffect, useState } from "react"

interface DownloadStepProps {
  project: ProjectRow
  onDownload: () => void
  isCompleted?: boolean
  onInitializationComplete?: () => void
}

export function DownloadStep({
  project,
  onDownload,
  isCompleted = false,
  onInitializationComplete,
}: DownloadStepProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(false)

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
    setDownloadError(false)

    const url = `/api/projects/${project.id}/download`
    console.log(`🔽 [DownloadStep] Starting download from: ${url}`)

    const downloadFile = async () => {
      try {
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`Download failed: ${response.status} ${response.statusText}`)
        }

        const blob = await response.blob()
        const downloadUrl = window.URL.createObjectURL(blob)
        const downloadLink = document.createElement("a")
        downloadLink.href = downloadUrl

        const contentDisposition = response.headers.get("Content-Disposition")
        const filename = contentDisposition?.match(/filename="([^"]+)"/)?.[1] || "project.zip"

        downloadLink.download = filename
        downloadLink.style.display = "none"
        document.body.appendChild(downloadLink)
        downloadLink.click()

        setTimeout(() => {
          window.URL.revokeObjectURL(downloadUrl)
          document.body.removeChild(downloadLink)
        }, 100)

        console.log(`✅ [DownloadStep] Download triggered successfully: ${filename}`)
        onDownload()
      } catch (error) {
        console.error("❌ [DownloadStep] Download error:", error)
        setDownloadError(true)
        throw error
      } finally {
        setTimeout(() => {
          setIsDownloading(false)
          console.log("✅ [DownloadStep] Download state reset")
        }, 2000)
      }
    }

    downloadFile().catch((error) => {
      console.error("❌ [DownloadStep] Download failed:", error)
      setDownloadError(true)
      setIsDownloading(false)
    })
  }

  const getDownloadButtonText = () => {
    if (isInitializing) return "Preparing..."
    if (isDownloading) return "Downloading..."
    return "Download"
  }

  return (
    <Material type="base" className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4 font-sans">Download Project</h3>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            type="primary"
            size="medium"
            onClick={handleDownload}
            loading={isDownloading || isInitializing}
            disabled={isInitializing}
            className="pr-1"
            prefix={
              !isDownloading && !isInitializing ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7,10 12,15 17,10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              ) : undefined
            }
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
            {downloadError && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Download failed. Please try again or check browser settings.
              </div>
            )}

            {!isInitializing && !isCompleted && !downloadError && (
              <div className="text-sm text-muted-foreground">
                Download your project files to get started with local development.
              </div>
            )}

            {isDownloading && <div className="text-sm text-muted-foreground">Downloading...</div>}
          </div>
        </div>
      </div>
    </Material>
  )
}
