"use client"

import { useRouter } from "next/navigation"
import { StatusDot } from "@/components/geist/status-dot"
import { Button } from "@/components/geist/button"
import { Material } from "@/components/geist/material"
import { RelativeTimeCard } from "@/components/geist/relative-time-card"

interface ProjectCardProps {
  project: {
    id: string
    name: string
    url?: string
    deploy_status?: "QUEUED" | "BUILDING" | "ERROR" | "READY" | "CANCELED"
    updated_at: string
    created_at: string
  }
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter()

  const handleOpenPreview = () => {
    if (project.url) {
      window.open(project.url, "_blank")
    }
  }

  const handleOpenProject = () => {
    router.push(`/project/${project.id}`)
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Check, that click was not on button
    const target = e.target as HTMLElement
    if (target.closest("button")) {
    }
    router.push(`/project/${project.id}`)
  }

  return (
    <Material
      type="base"
      className="p-6 hover:shadow-border-medium transition-shadow cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Project name and status */}
          <div className="flex items-center space-x-3 mb-2">
            <span className="text-lg font-semibold text-gray-1000 truncate">{project.name}</span>
            {/* Show status only if project is ready (has URL) or has error */}
            {project.deploy_status && (project.url || project.deploy_status === "ERROR") && (
              <StatusDot state={project.deploy_status} />
            )}
          </div>

          {/* Project URL if available */}
          {project.url && <p className="text-sm text-gray-700 mb-3 truncate">{project.url}</p>}

          {/* Timestamps */}
          <div className="flex items-center space-x-4 text-xs text-gray-600">
            <RelativeTimeCard date={new Date(project.updated_at).getTime()} side="top">
              <span>Updated {formatRelativeTime(project.updated_at)}</span>
            </RelativeTimeCard>
            <span>•</span>
            <RelativeTimeCard date={new Date(project.created_at).getTime()} side="top">
              <span>Created {formatRelativeTime(project.created_at)}</span>
            </RelativeTimeCard>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 ml-4">
          {project.url && (
            <Button type="secondary" size="small" onClick={handleOpenPreview}>
              Preview
            </Button>
          )}
          <Button type="primary" size="small" onClick={handleOpenProject}>
            Open
          </Button>
        </div>
      </div>
    </Material>
  )
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return "just now"
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  return `${Math.floor(diffInSeconds / 86400)}d ago`
}
