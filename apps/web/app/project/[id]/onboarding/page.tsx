"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ProjectSetup } from "@/components/project/setup/project-setup"
import { useProject } from "@/components/project/project-layout-client"

export default function ProjectOnboardingPage() {
  const { project, agentConnected } = useProject()
  const router = useRouter()

  useEffect(() => {
    if (project.netlify_site_id) {
      console.log("🔄 [Onboarding] Project already has netlify_site_id, redirecting to overview...")
      router.push(`/project/${project.id}/overview`)
    }
  }, [project.id, project.netlify_site_id, router])

  return (
    <div className="overflow-y-auto h-full">
      <ProjectSetup project={project as any} agentConnected={agentConnected} />
    </div>
  )
}
