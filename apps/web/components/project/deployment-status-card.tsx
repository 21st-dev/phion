"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/geist/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ExternalLink, Globe, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react"
import type { ProjectRow } from "@shipvibes/database"

interface DeploymentStatusCardProps {
  project: ProjectRow
}

export function DeploymentStatusCard({ project }: DeploymentStatusCardProps) {
  const isNextjs = project.template_type === "nextjs"
  const deployUrl = isNextjs ? project.vercel_url : project.netlify_url
  const deployStatus = isNextjs ? project.vercel_deploy_status : project.deploy_status
  const platform = isNextjs ? "Vercel" : "Netlify"
  const platformIcon = isNextjs ? "▲" : "◉"

  const getStatusInfo = (status: string | undefined) => {
    switch (status) {
      case "ready":
        return {
          icon: CheckCircle,
          label: "Live",
          variant: "default" as const,
          color: "text-green-600",
        }
      case "building":
        return {
          icon: Clock,
          label: "Building",
          variant: "secondary" as const,
          color: "text-blue-600",
        }
      case "failed":
        return {
          icon: XCircle,
          label: "Failed",
          variant: "destructive" as const,
          color: "text-red-600",
        }
      case "pending":
        return {
          icon: AlertCircle,
          label: "Pending",
          variant: "outline" as const,
          color: "text-yellow-600",
        }
      default:
        return {
          icon: Clock,
          label: "Unknown",
          variant: "outline" as const,
          color: "text-gray-600",
        }
    }
  }

  const statusInfo = getStatusInfo(deployStatus)
  const StatusIcon = statusInfo.icon

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="text-lg">{platformIcon}</span>
          {platform} Deployment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>

          {deployUrl && deployStatus === "ready" && (
            <Button
              size="small"
              type="secondary"
              onClick={() => window.open(deployUrl, "_blank")}
              prefix={<ExternalLink className="h-4 w-4" />}
            >
              View Live
            </Button>
          )}
        </div>

        {deployUrl && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            <a
              href={deployUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors truncate"
            >
              {deployUrl.replace(/^https?:\/\//, "")}
            </a>
          </div>
        )}

        {!deployUrl && deployStatus !== "failed" && (
          <div className="text-sm text-muted-foreground">
            {deployStatus === "pending" && "Deployment will start after project setup"}
            {deployStatus === "building" && "Setting up your deployment..."}
          </div>
        )}

        {deployStatus === "failed" && (
          <div className="text-sm text-red-600">
            Deployment failed. Check the logs for more details.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
