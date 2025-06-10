"use client";

import { FileHistory } from "@/components/file-history";
import { PendingChangesSidebar } from "@/components/project/pending-changes-sidebar";
import { useProject } from "@/components/project/project-layout-client";

export default function ProjectFileHistoryPage() {
  const { project, history, pendingChanges } = useProject();

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)]">
      {/* Pending Changes Sidebar */}
      <div className="w-64 flex-shrink-0">
        <PendingChangesSidebar
          onSaveAll={() => {}}
          projectId={project.id}
          pendingChanges={pendingChanges}
        />
      </div>

      {/* File History Content */}
      <div className="flex-1 overflow-hidden">
        <FileHistory projectId={project.id} />
      </div>
    </div>
  );
}
