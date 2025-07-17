"use client"

import { Spinner } from "@/components/geist/spinner"
import { useWebSocket } from "@/hooks/use-websocket"
import type { ProjectRow } from "@shipvibes/database"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ProjectSetupLayout, ProjectSetupSidebar, SetupStep } from "./index"

interface ProjectSetupProps {
  project: ProjectRow
}

export function ProjectSetup({ project, agentConnected = false }: ProjectSetupProps) {
  const router = useRouter()
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentComplete, setDeploymentComplete] = useState(false)
  const [projectUrl, setProjectUrl] = useState<string | null>(null)
  const [isLoadingStatus, setIsLoadingStatus] = useState(true)

  // WebSocket to track project status in real time
  const { isConnected } = useWebSocket({
    projectId: project.id,
    onDeployStatusUpdate: (data) => {
      console.log("🚀 [ProjectSetup] Deploy status update:", data)
      if (data.projectId === project.id) {
        if (data.status === "building") {
          setIsDeploying(true)
        } else if (data.status === "ready" && data.url) {
          setIsDeploying(false)
          setDeploymentComplete(true)
          setProjectUrl(data.url)
        } else if (data.status === "failed") {
          setIsDeploying(false)
        }
      }
    },
    onFileTracked: () => {
      console.log("📝 [ProjectSetup] File tracked")
    },
    onSaveSuccess: () => {
      console.log("💾 [ProjectSetup] Save success")
    },
  })

  // Check project status on component load
  useEffect(() => {
    const checkProjectStatus = async () => {
      try {
        const response = await fetch(`/api/projects/${project.id}/status`)
        if (response.ok) {
          const statusData = await response.json()

          // Check  Netlify URL
          if (statusData.deploy_status === "ready" && statusData.netlify_url) {
            setDeploymentComplete(true)
            setProjectUrl(statusData.netlify_url)
          }
          // If project 
          else if (statusData.deploy_status === "building") {
            setIsDeploying(true)
          }
        }
      } catch (error) {
        console.error("Error checking project status:", error)
      } finally {
        setIsLoadingStatus(false)
      }
    }

    checkProjectStatus()
  }, [project.id])

  const handleSetupComplete = () => {
    console.log("✅ [ProjectSetup] Setup completed, redirecting to overview...")
    router.push(`/project/${project.id}/overview`)
  }

  if (isLoadingStatus) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="flex flex-col items-center justify-center text-center">
          <Spinner size={32} />
          <p className="mt-4 text-sm text-muted-foreground">Checking project status...</p>
        </div>
      </div>
    )
  }

  return (
    <ProjectSetupLayout>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 lg:sticky lg:top-8 lg:self-start">
          <ProjectSetupSidebar agentConnected={agentConnected} />
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6 p-6 pb-[70vh]">
          <div>
            <SetupStep
              onDeploy={handleSetupComplete}
              projectId={project.id}
              agentConnected={agentConnected}
            />
          </div>
        </div>
      </div>
    </ProjectSetupLayout>
  )
}
