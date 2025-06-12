"use client";

import { useState, useEffect } from "react";
import NumberFlow from "@number-flow/react";
import { Button } from "@/components/geist/button";
import { Material } from "@/components/geist/material";
import { useWebSocket } from "@/hooks/use-websocket";
import type { DatabaseTypes } from "@shipvibes/database";

interface DownloadStepProps {
  project: DatabaseTypes.ProjectRow;
  onDownload: () => void;
  isCompleted?: boolean;
  onInitializationComplete?: () => void;
}

export function DownloadStep({
  project,
  onDownload,
  isCompleted = false,
  onInitializationComplete,
}: DownloadStepProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(
    project.deploy_status === "pending"
  );
  const [initializationProgress, setInitializationProgress] = useState({
    progress: 0,
    stage: "",
    message: "Initializing...",
  });

  // WebSocket для отслеживания статуса инициализации в реальном времени
  const { isConnected } = useWebSocket({
    projectId: project.id,
    onDeployStatusUpdate: (data) => {
      console.log("🔄 [DownloadStep] Deploy status update:", data);
      if (data.projectId === project.id) {
        // Если статус изменился с "pending" на что-то другое - инициализация завершена
        if (data.status !== "pending" && isInitializing) {
          console.log(
            "✅ [DownloadStep] Initialization completed via WebSocket"
          );
          setIsInitializing(false);
          onInitializationComplete?.();
        }
        // Если статус стал "pending" - началась инициализация
        else if (data.status === "pending" && !isInitializing) {
          console.log("⏳ [DownloadStep] Initialization started via WebSocket");
          setIsInitializing(true);
        }
      }
    },
    onInitializationProgress: (data) => {
      console.log("📊 [DownloadStep] Initialization progress:", data);
      if (data.projectId === project.id) {
        setInitializationProgress({
          progress: data.progress,
          stage: data.stage,
          message: data.message,
        });

        // Если прогресс завершен (100%) - инициализация закончена
        if (data.progress >= 100) {
          console.log(
            "✅ [DownloadStep] Initialization completed via progress"
          );
          setIsInitializing(false);
          onInitializationComplete?.();
        }
      }
    },
  });

  // Проверяем начальный статус при монтировании компонента
  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        const response = await fetch(`/api/projects/${project.id}/status`);
        if (response.ok) {
          const statusData = await response.json();
          const isPending = statusData.deploy_status === "pending";
          setIsInitializing(isPending);

          console.log("🔍 [DownloadStep] Initial status check:", {
            status: statusData.deploy_status,
            isInitializing: isPending,
          });
        }
      } catch (error) {
        console.error("Error checking initial project status:", error);
      }
    };

    checkInitialStatus();
  }, [project.id]);

  const tryAlternativeDownloads = (projectId: string, projectName: string) => {
    console.log("🔄 [DownloadStep] Trying alternative download methods...");

    // Способ 1: Создание невидимого iframe
    try {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = `/api/projects/${projectId}/download`;
      document.body.appendChild(iframe);

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);

      console.log("✅ [DownloadStep] Iframe method triggered");
    } catch (iframeError) {
      console.warn("⚠️ [DownloadStep] Iframe method failed:", iframeError);
    }

    // Способ 2: Показываем пользователю уведомление через 1.5 секунды
    setTimeout(() => {
      const userWantsManual = confirm(
        "🚨 Download Issue Detected\n\n" +
          "The automatic download appears to be blocked by your browser.\n\n" +
          "💡 Solutions:\n" +
          "• Click OK to try direct download\n" +
          "• Use the 'Direct Link' button on the page\n" +
          "• Check if popup blocker is enabled\n\n" +
          "Would you like to try downloading now?"
      );

      if (userWantsManual) {
        // Попробуем несколько методов
        try {
          window.open(`/api/projects/${projectId}/download`, "_blank");
        } catch (error) {
          // Если window.open не работает, используем location
          window.location.href = `/api/projects/${projectId}/download`;
        }
      }
    }, 1500);
  };

  const handleDownload = () => {
    if (isInitializing || isDownloading) return;

    setIsDownloading(true);

    const url = `/api/projects/${project.id}/download`;
    console.log(`🔽 [DownloadStep] Opening download URL: ${url}`);

    // Open in a new tab to trigger browser-native download
    const newTab = window.open(url, "_blank", "noopener,noreferrer");

    // Fallback: navigate current tab if popup blocked
    if (!newTab) {
      console.log("🔄 [DownloadStep] Popup blocked, trying same tab...");
      window.location.href = url;
    }

    // Reset downloading state after a short delay since we can't detect download completion
    setTimeout(() => {
      setIsDownloading(false);
      console.log("✅ [DownloadStep] Download state reset");
    }, 2000);

    onDownload();
  };

  const getDownloadButtonText = () => {
    if (isInitializing) return "Preparing...";
    if (isDownloading) return "Downloading...";
    return "Download";
  };

  return (
    <Material type="base" className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4 font-sans">
        Download Project
      </h3>
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
            {isCompleted && !isInitializing && (
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

            {!isInitializing && !isCompleted && (
              <div className="text-sm text-muted-foreground">
                Download your project files to get started with local
                development.
                {!isCompleted && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Click "Download" to get your project ZIP file.
                  </div>
                )}
              </div>
            )}

            {isDownloading && (
              <div className="text-sm text-muted-foreground">
                Downloading...
              </div>
            )}
          </div>
        </div>
      </div>
    </Material>
  );
}
