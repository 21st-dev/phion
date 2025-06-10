"use client";

import { ProjectLogs } from "@/components/project/project-logs";
import { useProject } from "@/components/project/project-layout-client";

export default function ProjectLogsPage() {
  const { project } = useProject();

  return (
    <div className="p-6">
      <ProjectLogs projectId={project.id} />
    </div>
  );
}
