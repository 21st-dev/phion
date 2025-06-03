"use client";

import { useState, useEffect } from "react";
import { FileHistory } from "@/components/file-history";
import { ProjectSetup } from "@/components/project";
import { PendingChangesSidebar } from "@/components/project/pending-changes-sidebar";
import { RecentDeploys } from "@/components/project/recent-deploys";
import { useWebSocket } from "@/hooks/use-websocket";
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

interface PendingChange {
  id: string;
  file_path: string;
  action: "modified" | "added" | "deleted";
  file_size: number;
  updated_at: string;
}

interface ProjectPageClientProps {
  initialProject: Project;
  initialHistory: FileVersion[];
  initialPendingChanges: PendingChange[];
}

export function ProjectPageClient({
  initialProject,
  initialHistory,
  initialPendingChanges,
}: ProjectPageClientProps) {
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>(
    initialPendingChanges
  );
  const [isSaving, setIsSaving] = useState(false);

  const fetchVersions = async (): Promise<FileVersion[]> => {
    const response = await fetch(`/api/projects/${initialProject.id}/versions`);
    if (!response.ok) {
      throw new Error("Failed to fetch versions");
    }
    return response.json();
  };

  const fetchPendingChanges = async (): Promise<PendingChange[]> => {
    const response = await fetch(
      `/api/projects/${initialProject.id}/pending-changes`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch pending changes");
    }
    const data = await response.json();
    return data.pendingChanges;
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

  // WebSocket для real-time обновлений
  const { isConnected, saveAllChanges } = useWebSocket({
    projectId: initialProject.id,
    onFileTracked: () => {
      // Обновляем pending changes при получении изменений
      fetchPendingChanges().then(setPendingChanges).catch(console.error);
    },
    onSaveSuccess: (data) => {
      console.log("✅ Save successful:", data);
      setIsSaving(false);
      // Очищаем pending changes и обновляем историю
      setPendingChanges([]);
      refresh(); // Обновляем file history
    },
    onError: (error) => {
      console.error("❌ WebSocket error:", error);
      setIsSaving(false);
    },
  });

  const currentVersions = versions || initialHistory;
  const hasVersions = currentVersions && currentVersions.length > 0;

  const showOnboarding = !hasVersions && pendingChanges.length === 0;

  if (error) {
    console.error("Error fetching versions:", error);
  }

  const handleRefresh = () => {
    refresh();
  };

  const handleSaveAll = (commitMessage: string) => {
    setIsSaving(true);
    saveAllChanges(commitMessage);
  };

  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
  };

  const tabs = [
    { value: "overview", title: "Overview" },
    { value: "changes", title: `Changes (${pendingChanges.length})` },
    { value: "history", title: "File History" },
    { value: "settings", title: "Settings" },
  ];

  const [activeTab, setActiveTab] = useState("overview");

  return (
    <>
      {showOnboarding ? (
        <ProjectSetup project={initialProject as any} />
      ) : (
        <div className="flex h-[calc(100vh-200px)]">
          {/* Sidebar с pending changes */}
          <div className="w-80 border-r border-gray-alpha-400">
            <PendingChangesSidebar
              projectId={initialProject.id}
              pendingChanges={pendingChanges}
              onSaveAll={handleSaveAll}
              isLoading={isSaving}
            />
          </div>

          {/* Основной контент */}
          <div className="flex-1 flex flex-col">
            {/* Header с connection status */}
            <div className="border-b border-gray-alpha-400 p-4 bg-background-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-1000">
                  {initialProject.name}
                </h2>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isConnected ? "bg-success" : "bg-error"
                    }`}
                  />
                  <span className="text-sm text-gray-600">
                    {isConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabs Navigation */}
            <div className="border-b border-gray-alpha-400 bg-background-100">
              <Tabs
                tabs={tabs}
                selected={activeTab}
                setSelected={setActiveTab}
              />
            </div>

            {/* Tab Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Pending Changes Alert */}
                  {pendingChanges.length > 0 && (
                    <Material
                      type="base"
                      className="p-4 border-l-4 border-orange-500 bg-orange-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-orange-800">
                            Unsaved Changes
                          </h3>
                          <p className="text-sm text-orange-700 mt-1">
                            You have {pendingChanges.length} unsaved change
                            {pendingChanges.length !== 1 ? "s" : ""}. Save them
                            to create a new deployment.
                          </p>
                        </div>
                        <Button
                          size="medium"
                          onClick={() => handleSaveAll("Save changes")}
                          loading={isSaving}
                          prefix={
                            !isSaving ? (
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M17 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V7L17 3ZM19 19H5V5H16.17L19 7.83V19ZM12 12C13.66 12 15 13.34 15 15S13.66 18 12 18 9 16.66 9 15 10.34 12 12 12ZM6 6V10H15V6H6Z" />
                              </svg>
                            ) : undefined
                          }
                        >
                          {isSaving ? "Saving..." : "Save & Deploy"}
                        </Button>
                      </div>
                    </Material>
                  )}

                  {/* Project Stats */}
                  <Material type="base" className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-1000">
                          {currentVersions.length}
                        </div>
                        <div className="text-sm text-gray-600">
                          File Versions
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {pendingChanges.length}
                        </div>
                        <div className="text-sm text-gray-600">
                          Pending Changes
                        </div>
                      </div>
                      <div className="text-center">
                        <div
                          className={`text-2xl font-bold ${
                            isConnected ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {isConnected ? "Connected" : "Offline"}
                        </div>
                        <div className="text-sm text-gray-600">
                          Agent Status
                        </div>
                      </div>
                    </div>
                  </Material>

                  {/* Recent Deploys */}
                  <RecentDeploys projectId={initialProject.id} />

                  {/* Quick Actions */}
                  <Material type="base" className="p-6">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-1000 mb-4">
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
                  </Material>
                </div>
              )}

              {activeTab === "changes" && (
                <Material type="base" className="p-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-1000 mb-2">
                        Pending Changes
                      </h3>
                      <p className="text-gray-700">
                        {pendingChanges.length > 0
                          ? `You have ${pendingChanges.length} unsaved change${
                              pendingChanges.length !== 1 ? "s" : ""
                            }.`
                          : "No pending changes. All changes are saved."}
                      </p>
                    </div>

                    {pendingChanges.length > 0 && (
                      <div className="space-y-2">
                        {pendingChanges.map((change) => (
                          <div
                            key={change.id}
                            className="p-3 border border-gray-alpha-400 rounded"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  change.action === "added"
                                    ? "bg-success-light text-success"
                                    : change.action === "deleted"
                                    ? "bg-error-light text-error"
                                    : "bg-warning-light text-warning"
                                }`}
                              >
                                {change.action}
                              </span>
                              <span className="text-sm font-medium">
                                {change.file_path}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              {new Date(change.updated_at).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
                          onChange={(e) =>
                            setAutoRefreshEnabled(e.target.checked)
                          }
                        />
                      </div>
                    </div>
                  </Material>

                  <FileHistory projectId={initialProject.id} />
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
                            Automatically check for file changes every 60
                            seconds
                          </p>
                        </div>
                        <Toggle
                          checked={autoRefreshEnabled}
                          onChange={(e) =>
                            setAutoRefreshEnabled(e.target.checked)
                          }
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
          </div>
        </div>
      )}
    </>
  );
}
