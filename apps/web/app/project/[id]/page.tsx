import { getProjectById } from "@shipvibes/database"
import { redirect } from "next/navigation"

interface ProjectPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params

  // Get project data to determine if onboarding needed

  const project = await getProjectById(id)

  // If project has no netlify_site_id, 
  if (!project?.netlify_site_id) {
    redirect(`/project/${id}/onboarding`)
  } else {
    redirect(`/project/${id}/overview`)
  }
}
