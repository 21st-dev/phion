"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProjectSetup } from "@/components/project/setup/project-setup";
import { useProject } from "@/components/project/project-layout-client";

export default function ProjectOnboardingPage() {
  const { project, agentConnected } = useProject();
  const router = useRouter();

  // Автоматически редиректим на overview когда агент подключился ИЛИ онбординг уже не нужен
  useEffect(() => {
    // Если у проекта уже есть netlify_site_id, то онбординг уже пройден
    if (project.netlify_site_id) {
      console.log(
        "🔄 [Onboarding] Project already has netlify_site_id, redirecting to overview..."
      );
      router.push(`/project/${project.id}/overview`);
      return;
    }

    // Если агент подключился впервые
    if (agentConnected) {
      console.log(
        "🔄 [Onboarding] Agent connected, redirecting to overview..."
      );
      router.push(`/project/${project.id}/overview`);
    }
  }, [agentConnected, project.id, project.netlify_site_id, router]);

  return (
    <div className="overflow-y-auto h-full">
      <ProjectSetup project={project as any} agentConnected={agentConnected} />
    </div>
  );
}
