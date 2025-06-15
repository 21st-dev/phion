"use client"

import { ProjectCard } from "@/components/project/project-card"
import { ProjectCardSkeleton } from "@/components/project/project-card-skeleton"
import { EmptyState } from "@/components/project/empty-state"
import { useProjects } from "@/hooks/use-projects"
import { useToast } from "@/hooks/use-toast"
import type { ProjectRow } from "@shipvibes/database"

export function ProjectList() {
  const { data: projects, isLoading, error } = useProjects()
  const { error: showError } = useToast()

  // Показываем ошибку через toast, если есть
  if (error) {
    showError("Failed to load projects", "Please refresh the page to try again")
  }

  // Конвертируем данные для совместимости с ProjectCard
  const formatProjectsForCards = (projects: ProjectRow[] | undefined) => {
    if (!projects) return []

    return projects.map((project: ProjectRow) => ({
      id: project.id,
      name: project.name,
      url: project.netlify_url || undefined,
      deploy_status: mapDeployStatus(project.deploy_status || ""),
      updated_at: project.updated_at || project.created_at || new Date().toISOString(),
      created_at: project.created_at || new Date().toISOString(),
    }))
  }

  const mapDeployStatus = (
    status: string,
  ): "QUEUED" | "BUILDING" | "ERROR" | "READY" | "CANCELED" => {
    console.log("🔄 [ProjectList] Mapping deploy status:", status)
    switch (status) {
      case "ready":
        return "READY"
      case "building":
        return "BUILDING"
      case "failed":
      case "error":
        return "ERROR"
      case "pending":
        return "QUEUED"
      case "canceled":
      case "cancelled":
        return "CANCELED"
      default:
        console.warn("⚠️ [ProjectList] Unknown deploy status:", status, "- mapping to QUEUED")
        return "QUEUED"
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!projects || projects.length === 0) {
    return <EmptyState />
  }

  const formattedProjects = formatProjectsForCards(projects)

  return (
    <div className="space-y-4">
      {formattedProjects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}
