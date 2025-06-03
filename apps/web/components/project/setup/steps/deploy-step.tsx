"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/geist/button";
import { Material } from "@/components/geist/material";

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

  // Polling каждые 5 секунд
  useEffect(() => {
    fetchProjectStatus();
    fetchProjectVersions();

    const interval = setInterval(() => {
      fetchProjectStatus();
      fetchProjectVersions();
    }, 5000);

    return () => clearInterval(interval);
  }, [projectId]);

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
