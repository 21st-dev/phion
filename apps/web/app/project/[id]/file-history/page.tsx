"use client";

import { FileHistory } from "@/components/file-history";
import { PendingChangesSidebar } from "@/components/project/pending-changes-sidebar";
import { useProject } from "@/components/project/project-layout-client";

export default function ProjectSaveHistoryPage() {
  const {
    project,
    history,
    pendingChanges,
    saveAllChanges,
    discardAllChanges,
    isSaving,
  } = useProject();

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)]">
      {/* Pending Changes Sidebar */}
      <div className="w-64 flex-shrink-0">
        <PendingChangesSidebar
          onSaveAll={saveAllChanges}
          onDiscardAll={discardAllChanges}
          projectId={project.id}
          pendingChanges={pendingChanges}
          isLoading={isSaving}
        />
      </div>

      {/* Save History Content */}
      <div className="flex-1 overflow-hidden">
        <FileHistory projectId={project.id} />
      </div>
    </div>
  );
}
