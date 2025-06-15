"use client"

import { useState, useEffect } from "react"
import NumberFlow from "@number-flow/react"
import { Button } from "@/components/geist/button"
import { Material } from "@/components/geist/material"
import { useWebSocket } from "@/hooks/use-websocket"
import type { ProjectRow } from "@shipvibes/database"

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
  const [isInitializing, setIsInitializing] = useState(project.deploy_status === "pending")
  const [downloadError, setDownloadError] = useState(false)
  const [initializationProgress, setInitializationProgress] = useState({
    progress: 0,
    stage: "",
    message: "Initializing...",
  })

  // WebSocket для отслеживания статуса инициализации в реальном времени
  const { isConnected } = useWebSocket({
    projectId: project.id,
    onDeployStatusUpdate: (data) => {
      console.log("🔄 [DownloadStep] Deploy status update:", data)
      if (data.projectId === project.id) {
        // Если статус изменился с "pending" на что-то другое - инициализация завершена
        if (data.status !== "pending" && isInitializing) {
          console.log("✅ [DownloadStep] Initialization completed via WebSocket")
          setIsInitializing(false)
          onInitializationComplete?.()
        }
        // Если статус стал "pending" - началась инициализация
        else if (data.status === "pending" && !isInitializing) {
          console.log("⏳ [DownloadStep] Initialization started via WebSocket")
          setIsInitializing(true)
        }
      }
    },
    onInitializationProgress: (data) => {
      console.log("📊 [DownloadStep] Initialization progress:", data)
      if (data.projectId === project.id) {
        setInitializationProgress({
          progress: data.progress,
          stage: data.stage,
          message: data.message,
        })

        // Если прогресс завершен (100%) - инициализация закончена
        if (data.progress >= 100) {
          console.log("✅ [DownloadStep] Initialization completed via progress")
          setIsInitializing(false)
          onInitializationComplete?.()
        }
      }
    },
  })

  // Проверяем начальный статус при монтировании компонента
  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        const response = await fetch(`/api/projects/${project.id}/status`)
        if (response.ok) {
          const statusData = await response.json()
          const isPending = statusData.deploy_status === "pending"
          setIsInitializing(isPending)

          console.log("🔍 [DownloadStep] Initial status check:", {
            status: statusData.deploy_status,
            isInitializing: isPending,
          })
        }
      } catch (error) {
        console.error("Error checking initial project status:", error)
      }
    }

    checkInitialStatus()
  }, [project.id])

  const handleDownload = () => {
    if (isInitializing || isDownloading) return

    setIsDownloading(true)
    setDownloadError(false) // Reset any previous errors

    const url = `/api/projects/${project.id}/download`
    console.log(`🔽 [DownloadStep] Starting download from: ${url}`)

    // Use proper fetch + blob approach for reliable downloads
    const downloadFile = async () => {
      try {
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`Download failed: ${response.status} ${response.statusText}`)
        }

        // Get the blob from response
        const blob = await response.blob()

        // Create download URL and trigger download
        const downloadUrl = window.URL.createObjectURL(blob)
        const downloadLink = document.createElement("a")
        downloadLink.href = downloadUrl

        // Extract filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get("Content-Disposition")
        let filename = `${project.name || "project"}-${project.id}.zip`

        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="([^"]+)"/)
          if (filenameMatch) {
            filename = filenameMatch[1]
          }
        }

        downloadLink.download = filename
        downloadLink.style.display = "none"
        document.body.appendChild(downloadLink)

        // Trigger download
        downloadLink.click()

        // Cleanup
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
        // Reset downloading state after a short delay
        setTimeout(() => {
          setIsDownloading(false)
          console.log("✅ [DownloadStep] Download state reset")
        }, 2000)
      }
    }

    // Execute the download
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
            {isCompleted && !isInitializing && !downloadError && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="20,6 9,17 4,12" />
                </svg>
                Files downloaded successfully!
              </div>
            )}

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
                {!isCompleted && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Click "Download" to get your project ZIP file.
                  </div>
                )}
              </div>
            )}

            {isDownloading && <div className="text-sm text-muted-foreground">Downloading...</div>}
          </div>
        </div>
      </div>
    </Material>
  )
}
