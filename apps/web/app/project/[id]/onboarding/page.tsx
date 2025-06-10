"use client";

import { ProjectSetup } from "@/components/project/setup/project-setup";
import { useProject } from "@/components/project/project-layout-client";

export default function ProjectOnboardingPage() {
  const { project, agentConnected } = useProject();

  return (
    <div className="overflow-y-auto h-full">
      <ProjectSetup project={project as any} agentConnected={agentConnected} />
    </div>
  );
}
