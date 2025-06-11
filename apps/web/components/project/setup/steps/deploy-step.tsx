"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/geist/button";
import { Material } from "@/components/geist/material";
import { CheckCircle, Clock, Loader2, Globe } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";

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
  agentConnected?: boolean;
}

// Client-side only time display component
function TimeDisplay({ timestamp }: { timestamp: string }) {
  const [timeString, setTimeString] = useState<string>("");

  useEffect(() => {
    setTimeString(new Date(timestamp).toLocaleTimeString());
  }, [timestamp]);

  return <span>{timeString || "Loading..."}</span>;
}

export function DeployStep({
  projectId,
  isDeploying,
  onDeploy,
  agentConnected = false,
}: DeployStepProps) {
  const [projectStatus, setProjectStatus] = useState<ProjectStatus | null>(
    null
  );
  const [versions, setVersions] = useState<ProjectVersions[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [hasExistingCommits, setHasExistingCommits] = useState(false);

  // Состояние для онбординга
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [currentDeployMessage, setCurrentDeployMessage] = useState<string>("");

  // 🔄 ЗАМЕНЯЕМ HTTP POLLING НА WEBSOCKET
  const { isConnected } = useWebSocket({
    projectId,
    onDeployStatusUpdate: (data) => {
      console.log("🚀 Deploy status update received:", data);
      // Обновляем статус проекта через WebSocket
      fetchProjectStatus();
    },
    onFileTracked: () => {
      // Когда отслеживается новый файл, проверяем версии
      fetchProjectVersions();
    },
    onSaveSuccess: () => {
      // Когда файлы сохранены, проверяем версии
      fetchProjectVersions();
    },
  });

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

  // Функция для проверки существующих коммитов
  const fetchExistingCommits = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/commits`);
      if (response.ok) {
        const commits = await response.json();
        setHasExistingCommits(commits.length > 0);
        return commits.length > 0;
      }
    } catch (error) {
      console.error("Error fetching project commits:", error);
      return false;
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

  // ✅ УБИРАЕМ HTTP POLLING! Загружаем данные только при инициализации
  useEffect(() => {
    const initializeData = async () => {
      await fetchProjectStatus();
      await fetchExistingCommits();
      await fetchProjectVersions();
    };

    initializeData();
  }, [projectId]);

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
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Initial Setup
        </h3>

        <div className="space-y-4">
          {/* Статус подключения агента */}
          <div
            className={`p-4 rounded-lg border ${
              agentConnected ? "bg-card border-border" : "bg-card border-border"
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {agentConnected ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <Clock className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <h4 className="font-semibold text-sm text-foreground">
                  Development Agent
                </h4>
                <p className="text-xs text-muted-foreground">
                  {agentConnected
                    ? "✅ Connected! Files will sync automatically"
                    : "⏳ Waiting for local agent connection..."}
                </p>
              </div>
            </div>
          </div>

          {/* ✅ УБИРАЕМ автоматический деплой - показываем инструкции */}
          {agentConnected && (
            <div className="p-4 rounded-lg border bg-card border-border">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm text-foreground">
                    Ready for Development
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    🎯 Make changes to your files, then click "Save All Changes"
                    to deploy
                  </p>

                  {/* Реальный статус деплоя */}
                  {projectStatus?.deploy_status && (
                    <div className="mt-2 text-xs font-mono bg-muted p-2 rounded">
                      Status: {projectStatus.deploy_status}
                      {projectStatus.updated_at && (
                        <div>
                          Updated:{" "}
                          <TimeDisplay timestamp={projectStatus.updated_at} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!agentConnected && (
            <div className="p-4 bg-muted border border-border rounded-lg">
              <h4 className="font-semibold text-foreground text-sm mb-2">
                📋 Next Steps
              </h4>
              <ol className="text-xs text-muted-foreground space-y-1">
                <li>1. Download and extract the project files</li>
                <li>2. Open terminal in the project folder</li>
                <li>
                  3. Run:{" "}
                  <code className="bg-background px-1 rounded border">
                    pnpm install
                  </code>
                </li>
                <li>
                  4. Run:{" "}
                  <code className="bg-background px-1 rounded border">
                    pnpm start
                  </code>
                </li>
                <li className="pt-1 font-medium">
                  5. Edit files and click "Save All Changes" to deploy! 🚀
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
        <h3 className="text-lg font-semibold text-foreground mb-4">Go Live</h3>

        <div className="space-y-4">
          <div className="text-muted-foreground">Publishing in progress...</div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>
              <span className="text-sm text-foreground">Building project</span>
              <div className="ml-auto">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              </div>
            </div>

            <div className="flex items-center gap-3 opacity-50">
              <div className="w-3 h-3 bg-muted-foreground/50 rounded-full"></div>
              <span className="text-sm text-muted-foreground">
                Optimizing assets
              </span>
            </div>

            <div className="flex items-center gap-3 opacity-50">
              <div className="w-3 h-3 bg-muted-foreground/50 rounded-full"></div>
              <span className="text-sm text-muted-foreground">
                Deploying to CDN
              </span>
            </div>

            <div className="flex items-center gap-3 opacity-50">
              <div className="w-3 h-3 bg-muted-foreground/50 rounded-full"></div>
              <span className="text-sm text-muted-foreground">
                Assigning domain
              </span>
            </div>
          </div>

          {/* Реальный статус */}
          {projectStatus && (
            <div className="mt-4 p-3 bg-muted rounded-lg border">
              <div className="text-xs text-muted-foreground mb-1">
                Deploy Status:
              </div>
              <div className="font-mono text-sm text-foreground">
                {projectStatus.deploy_status}
              </div>
              {projectStatus.netlify_deploy_id && (
                <div className="text-xs text-muted-foreground mt-1">
                  Deploy ID: {projectStatus.netlify_deploy_id}
                </div>
              )}
            </div>
          )}
        </div>
      </Material>
    );
  }

  return (
    <Material type="base" className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Go Live</h3>

      <div className="space-y-4">
        {hasChanges ? (
          <div className="p-3 bg-muted border border-border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle className="w-4 h-4 text-green-600" />
              New changes detected! Ready to deploy.
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">
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
          <div className="p-3 bg-muted rounded-lg border">
            <div className="text-xs text-muted-foreground mb-1">
              Current deployment:
            </div>
            <a
              href={projectStatus.netlify_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-foreground hover:text-blue-600 transition-colors"
            >
              <Globe className="w-4 h-4" />
              {projectStatus.netlify_url}
            </a>
          </div>
        )}
      </div>
    </Material>
  );
}
