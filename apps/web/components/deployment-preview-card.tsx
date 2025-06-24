"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Globe, ExternalLink } from "lucide-react"
import { useProject } from "@/components/project/project-layout-client"
import { Spinner } from "@/components/geist/spinner"
import { getStatusBadge } from "@/lib/deployment-utils"
import { useEffect, useState, useRef } from "react"

interface DeploymentPreviewCardProps {
  className?: string
}

export function DeploymentPreviewCard({ className }: DeploymentPreviewCardProps) {
  const { project, lastUpdated } = useProject()
  const [iframeKey, setIframeKey] = useState(0)
  const prevStatusRef = useRef(project.deploy_status)

  // Отслеживание изменения статуса для перезагрузки iframe
  useEffect(() => {
    const prevStatus = prevStatusRef.current
    const currentStatus = project.deploy_status

    // Если статус изменился на "ready", обновляем ключ iframe для перезагрузки
    if (prevStatus !== currentStatus && currentStatus === "ready") {
      console.log("🔄 [DeploymentPreviewCard] Status changed to ready, reloading iframe")
      setIframeKey((prev) => prev + 1)
    }

    prevStatusRef.current = currentStatus
  }, [project.deploy_status])

  // Отладочная информация для проверки обновлений
  useEffect(() => {
    console.log("🔄 [DeploymentPreviewCard] Project status updated:", {
      deployStatus: project.deploy_status,
      netlifyUrl: project.netlify_url,
      lastUpdated: lastUpdated.toISOString(),
      iframeKey,
    })
  }, [project.deploy_status, project.netlify_url, lastUpdated, iframeKey])

  const hasDeployUrl = project.netlify_url && project.netlify_url.trim() !== ""
  const isBuilding = project.deploy_status === "building"

  return (
    <Card className={className} style={{ backgroundColor: "transparent", boxShadow: "none" }}>
      <CardContent className="p-0 bg-transparent">
        {/* Preview iframe or placeholder - более компактный */}
        <div className="relative aspect-[16/10] rounded-t-lg overflow-hidden p-1">
          {hasDeployUrl && !isBuilding ? (
            <div className="w-full h-full relative aspect-[16/10] rounded-md overflow-hidden border-border border bg-background">
              <iframe
                key={`iframe-${iframeKey}`}
                src={project.netlify_url!}
                className="w-full h-full border-0 origin-top-left pointer-events-none bg-background"
                title="Live Preview"
                sandbox="allow-scripts allow-same-origin"
                style={{
                  transform: "scale(0.4)",
                  width: "250%",
                  height: "250%",
                }}
              />
              {/* Overlay to prevent clicks */}
              <div className="absolute inset-0 pointer-events-none" />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full  rounded-md border border-border">
              {isBuilding ? (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Spinner size={24} />
                  <span className="text-xs">Building</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Globe className="h-6 w-6" />
                  <span className="text-xs">Preview</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with status and actions - более компактный */}
        <div className="p-3 bg-card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <Globe className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">Live Preview</span>
            </div>

            {hasDeployUrl && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => window.open(project.netlify_url!, "_blank")}
              >
                <ExternalLink className="h-2 w-2 mr-1" />
                Open
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1">
            {getStatusBadge(project.deploy_status, !!hasDeployUrl)}
          </div>

          {hasDeployUrl && (
            <div className="mt-2">
              <a
                href={project.netlify_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary truncate block transition-colors"
              >
                {project.netlify_url}
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
