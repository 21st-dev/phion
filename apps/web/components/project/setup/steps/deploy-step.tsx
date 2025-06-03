"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/geist/button";
import { Material } from "@/components/geist/material";
import { useWebSocket } from "@/hooks/useWebSocket";
import { CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react";

interface ProjectStatus {
  id: string;
  deploy_status: string;
  netlify_url?: string;
  netlify_site_id?: string;
  netlify_deploy_id?: string;
  updated_at: string;
}

interface ProjectVersions {
  id: string;
  project_id: string;
  file_path: string;
  created_at: string;
}

interface DeployStepProps {
  projectId: string;
  isDeploying: boolean;
  onDeploy: () => void;
}

export function DeployStep({
  projectId,
  isDeploying,
  onDeploy,
}: DeployStepProps) {
  const [projectStatus, setProjectStatus] = useState<ProjectStatus | null>(
    null
  );
  const [versions, setVersions] = useState<ProjectVersions[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Состояние для онбординга
  const [agentConnected, setAgentConnected] = useState(false);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [currentDeployMessage, setCurrentDeployMessage] = useState<string>("");

  // WebSocket для real-time обновлений
  const { connect } = useWebSocket({
    onAgentConnected: (data) => {
      if (data.projectId === projectId) {
        console.log("🔗 Agent connected for project:", projectId);
        setAgentConnected(true);

        // Если агент подключился и нет деплоя - запускаем автоматический деплой
        if (!projectStatus?.netlify_url) {
          console.log("🚀 Triggering automatic first deploy...");
          handleFirstDeploy();
        }
      }
    },
    onDeployStatusUpdate: (data) => {
      if (data.projectId === projectId) {
        console.log("🚀 Deploy status update:", data);

        const logMessage = `${new Date().toLocaleTimeString()}: ${
          data.message
        }`;
        setDeployLogs((prev) => [...prev, logMessage]);
        setCurrentDeployMessage(data.message);
      }
    },
  });

  // Функция для автоматического первого деплоя
  const handleFirstDeploy = async () => {
    try {
      setCurrentDeployMessage("Starting initial deployment...");
      onDeploy(); // Вызываем существующую функцию деплоя
    } catch (error) {
      console.error("Error triggering first deploy:", error);
      setCurrentDeployMessage("Failed to start deployment");
    }
  };

  // Функция для получения статуса проекта
  const fetchProjectStatus = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/status`);
      if (response.ok) {
        const status = await response.json();
        setProjectStatus(status);
      }
    } catch (error) {
      console.error("Error fetching project status:", error);
    }
  };

  // Функция для получения версий проекта
  const fetchProjectVersions = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/versions`);
      if (response.ok) {
        const newVersions = await response.json();

        // Если есть версии и мы еще не деплоили, то есть изменения для первого деплоя
        if (newVersions.length > 0 && !projectStatus?.netlify_url) {
          setHasChanges(true);
        }
        // Проверяем есть ли новые версии с последнего обновления
        else if (newVersions.length > versions.length) {
          setHasChanges(true);
        }
        // Также проверяем время последней версии
        else {
          const latestVersion = newVersions[0];
          if (
            latestVersion &&
            new Date(latestVersion.created_at) > lastUpdated
          ) {
            setHasChanges(true);
          }
        }

        setVersions(newVersions);
      }
    } catch (error) {
      console.error("Error fetching project versions:", error);
    }
  };

  // Polling каждые 5 секунд + WebSocket подключение
  useEffect(() => {
    fetchProjectStatus();
    fetchProjectVersions();

    // Подключаемся к WebSocket для real-time обновлений
    connect();

    const interval = setInterval(() => {
      fetchProjectStatus();
      fetchProjectVersions();
    }, 5000);

    return () => clearInterval(interval);
  }, [projectId, connect]);

  // Обновить timestamp при первом рендере
  useEffect(() => {
    setLastUpdated(new Date());
  }, []);

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "building":
        return { text: "Building", color: "bg-blue-600", animate: true };
      case "ready":
        return { text: "Ready", color: "bg-green-600", animate: false };
      case "failed":
        return { text: "Failed", color: "bg-red-600", animate: false };
      case "pending":
        return { text: "Pending", color: "bg-yellow-600", animate: true };
      default:
        return { text: "Unknown", color: "bg-gray-600", animate: false };
    }
  };

  const isCurrentlyDeploying =
    projectStatus?.deploy_status === "building" || isDeploying;

  // Показываем онбординг если НЕТ деплоя (независимо от файлов)
  if (!projectStatus?.netlify_url) {
    return (
      <Material type="base" className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 font-sans">
          Initial Setup
        </h3>

        <div className="space-y-4">
          {/* Статус подключения агента */}
          <div
            className={`p-3 rounded-lg border-2 transition-all duration-200 ${
              agentConnected
                ? "text-green-700 bg-green-50 border-green-200"
                : "text-yellow-700 bg-yellow-50 border-yellow-200"
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {agentConnected ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <Clock className="h-5 w-5 text-yellow-500" />
                )}
              </div>
              <div>
                <h4 className="font-semibold text-sm">Development Agent</h4>
                <p className="text-xs opacity-80">
                  {agentConnected
                    ? "✅ Connected! Files will sync automatically"
                    : "⏳ Waiting for local agent connection..."}
                </p>
              </div>
            </div>
          </div>

          {/* Статус первого деплоя */}
          {agentConnected && (
            <div
              className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                isCurrentlyDeploying
                  ? "text-blue-700 bg-blue-50 border-blue-200"
                  : "text-gray-700 bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {isCurrentlyDeploying ? (
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  ) : (
                    <Clock className="h-5 w-5 text-gray-500" />
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Initial Deployment</h4>
                  <p className="text-xs opacity-80">
                    {isCurrentlyDeploying
                      ? "🚀 Deploying your project..."
                      : "⏳ Preparing to deploy..."}
                  </p>
                  {currentDeployMessage && (
                    <div className="mt-1 text-xs font-mono bg-blue-100 p-1 rounded">
                      {currentDeployMessage}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Deploy logs */}
          {deployLogs.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Deploy Progress
              </h4>
              <div className="bg-black text-green-400 p-3 rounded-lg text-xs font-mono max-h-32 overflow-y-auto">
                {deployLogs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!agentConnected && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-800 text-sm mb-1">
                📋 Next Steps
              </h4>
              <ol className="text-xs text-blue-700 space-y-1">
                <li>1. Download and extract the project files</li>
                <li>2. Open terminal in the project folder</li>
                <li>
                  3. Run:{" "}
                  <code className="bg-blue-100 px-1 rounded">pnpm install</code>
                </li>
                <li>
                  4. Run:{" "}
                  <code className="bg-blue-100 px-1 rounded">
                    node shipvibes-dev.js
                  </code>
                </li>
              </ol>
            </div>
          )}
        </div>
      </Material>
    );
  }

  if (isCurrentlyDeploying) {
    const statusDisplay = getStatusDisplay(
      projectStatus?.deploy_status || "building"
    );

    return (
      <Material type="base" className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 font-sans">
          Go Live
        </h3>

        <div className="space-y-4">
          <div className="text-muted-foreground font-sans">
            Publishing in progress...
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 ${statusDisplay.color} rounded-full ${
                  statusDisplay.animate ? "animate-pulse" : ""
                }`}
              ></div>
              <span className="text-sm font-sans">{statusDisplay.text}</span>
              {statusDisplay.animate && (
                <div className="ml-auto">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    className="animate-spin"
                  >
                    <path
                      fill="currentColor"
                      d="M8 1a7 7 0 1 0 7 7 7 7 0 0 0-7-7zm0 12a5 5 0 1 1 5-5 5 5 0 0 1-5 5z"
                    />
                  </svg>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 opacity-50">
              <div className="w-4 h-4 bg-muted rounded-full"></div>
              <span className="text-sm font-sans">Optimizing assets</span>
            </div>

            <div className="flex items-center gap-3 opacity-50">
              <div className="w-4 h-4 bg-muted rounded-full"></div>
              <span className="text-sm font-sans">Deploying to CDN</span>
            </div>

            <div className="flex items-center gap-3 opacity-50">
              <div className="w-4 h-4 bg-muted rounded-full"></div>
              <span className="text-sm font-sans">Assigning domain</span>
            </div>
          </div>

          {projectStatus?.netlify_url && (
            <div className="mt-6 p-3 bg-accents-1 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-sans">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                {projectStatus.netlify_url}
              </div>
            </div>
          )}
        </div>
      </Material>
    );
  }

  return (
    <Material type="base" className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4 font-sans">
        Go Live
      </h3>

      <div className="space-y-4">
        {hasChanges ? (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-yellow-800">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              New changes detected! Ready to deploy.
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground font-sans">
            {versions.length > 0
              ? "Waiting for file changes to deploy..."
              : "Ready to publish your project to a live URL."}
          </p>
        )}

        <Button
          size="large"
          onClick={onDeploy}
          fullWidth
          disabled={
            !hasChanges && versions.length > 0 && !!projectStatus?.netlify_url
          }
        >
          {versions.length > 0 && projectStatus?.netlify_url
            ? hasChanges
              ? "Deploy Changes"
              : "No changes to deploy"
            : versions.length > 0
            ? "Deploy Project"
            : "Publish Project"}
        </Button>

        {projectStatus?.netlify_url && (
          <div className="p-3 bg-accents-1 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">
              Current deployment:
            </div>
            <a
              href={projectStatus.netlify_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-foreground hover:text-blue-600 transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              {projectStatus.netlify_url}
            </a>
          </div>
        )}
      </div>
    </Material>
  );
}
