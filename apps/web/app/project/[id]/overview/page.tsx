"use client";

import { Material } from "@/components/geist/material";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Globe } from "lucide-react";
import { useProject } from "@/components/project/project-layout-client";
import { FileHistory } from "@/components/file-history";
import { PendingChangesSidebar } from "@/components/project/pending-changes-sidebar";

export default function ProjectOverviewPage() {
  const {
    project,
    pendingChanges,
    saveAllChanges,
    discardAllChanges,
    isSaving,
  } = useProject();

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1 space-y-8">
        {/* Pending Changes Alert */}
        {pendingChanges.length > 0 && (
          <Material type="base" className="p-4 bg-amber-50 border-amber-200">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-amber-900">
                  {pendingChanges.length} pending changes
                </h4>
                <p className="text-sm text-amber-700 mt-1">
                  You have unsaved changes that haven't been deployed yet. Use
                  the sidebar to save and deploy.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {pendingChanges.slice(0, 5).map((change) => (
                    <Badge
                      key={change.id}
                      variant="outline"
                      className="text-xs"
                    >
                      {change.file_path}
                    </Badge>
                  ))}
                  {pendingChanges.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{pendingChanges.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Material>
        )}

        {/* Complete Save History */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Complete Save History</h2>
            {project.netlify_url && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  project.netlify_url &&
                  window.open(project.netlify_url, "_blank")
                }
              >
                <Globe className="w-4 h-4 mr-2" />
                View Live Site
              </Button>
            )}
          </div>

          <FileHistory projectId={project.id} />
        </div>
      </div>

      {/* Pending Changes Sidebar */}
      <div className="w-80 flex-shrink-0">
        <PendingChangesSidebar
          onSaveAll={saveAllChanges}
          onDiscardAll={discardAllChanges}
          projectId={project.id}
          pendingChanges={pendingChanges}
          isLoading={isSaving}
        />
      </div>
    </div>
  );
}
