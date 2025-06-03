"use client";

import { useState } from "react";
import { FileHistory } from "@/components/file-history";
import { ProjectSetup } from "@/components/project";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { Button } from "@/components/geist/button";
import { Material } from "@/components/geist/material";
import { Tabs } from "@/components/geist/tabs";
import { Toggle } from "@/components/geist/toggle";

interface Project {
  id: string;
  name: string;
  template_type: string;
  netlify_site_id?: string;
  netlify_url?: string;
  deploy_status?: string;
  created_at: string;
  updated_at: string;
}

interface FileVersion {
  id: string;
  project_id: string;
  file_path: string;
  r2_object_key: string;
  content_hash: string;
  diff_text?: string;
  file_size: number;
  created_at: string;
}

interface ProjectPageClientProps {
  initialProject: Project;
  initialHistory: FileVersion[];
}

export function ProjectPageClient({
  initialProject,
  initialHistory,
}: ProjectPageClientProps) {
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);

  const fetchVersions = async (): Promise<FileVersion[]> => {
    const response = await fetch(`/api/projects/${initialProject.id}/versions`);
    if (!response.ok) {
      throw new Error("Failed to fetch versions");
    }
    return response.json();
  };

  const {
    data: versions,
    loading,
    error,
    refresh,
    isRefetching,
  } = useAutoRefresh(["project-versions", initialProject.id], fetchVersions, {
    refetchInterval: autoRefreshEnabled ? 1000 * 60 : false, // 60 секунд если включено
  });

  const currentVersions = versions || initialHistory;
  const hasVersions = currentVersions && currentVersions.length > 0;

  if (error) {
    console.error("Error fetching versions:", error);
  }

  const handleRefresh = () => {
    refresh();
  };

  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
  };

  const tabs = [
    { value: "overview", title: "Overview" },
    { value: "history", title: "File History" },
    { value: "settings", title: "Settings" },
  ];

  const [activeTab, setActiveTab] = useState("overview");

  return (
    <>
      {!hasVersions ? (
        <ProjectSetup project={initialProject as any} />
      ) : (
        <div className="space-y-6">
          {/* Tabs Navigation */}
          <Tabs tabs={tabs} selected={activeTab} setSelected={setActiveTab} />

          {/* Tab Content */}
          {activeTab === "overview" && (
            <Material type="base" className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-1000 mb-2">
                    Project Overview
                  </h3>
                  <p className="text-gray-700">
                    This project has {currentVersions.length} file version
                    {currentVersions.length !== 1 ? "s" : ""}.
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-1000 mb-3">
                    Quick Actions
                  </h4>
                  <div className="flex items-center space-x-3">
                    <Button
                      type="secondary"
                      size="medium"
                      onClick={handleRefresh}
                      loading={isRefetching}
                      prefix={
                        !isRefetching ? (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                          </svg>
                        ) : undefined
                      }
                    >
                      {isRefetching ? "Refreshing..." : "Refresh"}
                    </Button>

                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-700">
                        Auto-refresh
                      </span>
                      <Toggle
                        checked={autoRefreshEnabled}
                        onChange={(e) =>
                          setAutoRefreshEnabled(e.target.checked)
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Material>
          )}

          {activeTab === "history" && (
            <div className="space-y-4">
              {/* Control Panel */}
              <Material type="base" className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-gray-700">
                      {isRefetching ? (
                        <span className="flex items-center space-x-2">
                          <svg
                            className="w-4 h-4 animate-spin"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                          </svg>
                          <span>Checking for updates...</span>
                        </span>
                      ) : (
                        <span>
                          File History ({currentVersions.length} versions)
                        </span>
                      )}
                    </div>
                    {autoRefreshEnabled && (
                      <div className="text-xs bg-success-light text-success px-2 py-1 rounded">
                        Auto-refresh: ON (60s)
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      type="secondary"
                      size="small"
                      onClick={handleRefresh}
                      loading={isRefetching}
                    >
                      Refresh
                    </Button>

                    <Toggle
                      checked={autoRefreshEnabled}
                      onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                    />
                  </div>
                </div>
              </Material>

              <FileHistory history={currentVersions as any} />
            </div>
          )}

          {activeTab === "settings" && (
            <Material type="base" className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-1000 mb-2">
                    Project Settings
                  </h3>
                  <p className="text-gray-700 mb-4">
                    Configure your project settings and preferences.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-alpha-400">
                    <div>
                      <h4 className="text-sm font-medium text-gray-1000">
                        Auto-refresh
                      </h4>
                      <p className="text-xs text-gray-600">
                        Automatically check for file changes every 60 seconds
                      </p>
                    </div>
                    <Toggle
                      checked={autoRefreshEnabled}
                      onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-alpha-400">
                    <div>
                      <h4 className="text-sm font-medium text-gray-1000">
                        Project Template
                      </h4>
                      <p className="text-xs text-gray-600">
                        {initialProject.template_type}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Material>
          )}
        </div>
      )}
    </>
  );
}
