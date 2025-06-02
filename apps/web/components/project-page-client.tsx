"use client";

import { useState } from "react";
import { FileHistory } from "@/components/file-history";
import { ProjectOnboarding } from "@/components/project-onboarding";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { Button } from "@/components/ui/button";
import { RefreshCw, Play, Pause } from "lucide-react";

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

  return (
    <>
      {!hasVersions ? (
        <ProjectOnboarding project={initialProject as any} />
      ) : (
        <div className="space-y-4">
          {/* Панель управления */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {isRefetching ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Checking for updates...
                  </span>
                ) : (
                  <span>File History</span>
                )}
              </div>
              {autoRefreshEnabled && (
                <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                  Auto-refresh: ON (60s)
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefetching}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>

              <Button
                variant={autoRefreshEnabled ? "default" : "outline"}
                size="sm"
                onClick={toggleAutoRefresh}
              >
                {autoRefreshEnabled ? (
                  <>
                    <Pause className="h-4 w-4" />
                    Auto-refresh ON
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Auto-refresh OFF
                  </>
                )}
              </Button>
            </div>
          </div>

          <FileHistory history={currentVersions as any} />
        </div>
      )}
    </>
  );
}
