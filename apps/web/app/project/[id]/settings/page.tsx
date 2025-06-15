"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { DeleteProjectDialog } from "@/components/project/delete-project-dialog"
import { ExternalLink, Copy } from "lucide-react"
import { useProject } from "@/components/project/project-layout-client"
import { useToast } from "@/hooks/use-toast"
import { useUpdateProjectSettings } from "@/hooks/use-project-settings"
import { getStatusBadge } from "@/lib/deployment-utils"

// Client-side only date/time display component
function DateTimeDisplay({ timestamp }: { timestamp: string }) {
  const [dateString, setDateString] = useState<string>("")
  const [timeString, setTimeString] = useState<string>("")

  useEffect(() => {
    const date = new Date(timestamp)
    setDateString(date.toLocaleDateString())
    setTimeString(date.toLocaleTimeString())
  }, [timestamp])

  if (!dateString || !timeString) {
    return <span>Loading...</span>
  }

  return (
    <span>
      {dateString} at {timeString}
    </span>
  )
}

export default function ProjectSettingsPage() {
  const { project } = useProject()
  const [projectName, setProjectName] = useState(project.name)
  const { error: showError, success: showSuccess } = useToast()
  const updateProjectMutation = useUpdateProjectSettings()

  const handleSaveSettings = () => {
    updateProjectMutation.mutate(
      { projectId: project.id, name: projectName },
      {
        onSuccess: () => {
          showSuccess("Settings saved", "Project settings have been updated successfully")
          console.log("Settings saved successfully")
        },
        onError: (error) => {
          console.error("Error saving settings:", error)
          showError("Failed to save settings", "Please try again")
        },
      },
    )
  }

  const handleCopyProjectId = () => {
    navigator.clipboard.writeText(project.id)
    showSuccess("Project ID copied", "The project ID has been copied to your clipboard")
    console.log("Project ID copied to clipboard")
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* General Settings */}
      <div className="space-y-2">
        <div className="flex items-center justify-between pb-3 border-b mb-4">
          <div className="flex items-center space-x-2">
            <h3 className="font-medium">General Settings</h3>
          </div>
        </div>
        <div className="bg-background rounded-lg border overflow-hidden">
          <div className="p-4 space-y-4">
            <div>
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="project-id">Project ID</Label>
              <div className="flex items-center space-x-2 mt-1">
                <Input id="project-id" value={project.id} readOnly className="flex-1 bg-muted" />
                <Button size="sm" onClick={handleCopyProjectId} className="h-9">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                This ID is used in your local development setup
              </p>
            </div>

            <div>
              <Label>Template Type</Label>
              <div className="mt-1">
                <Badge variant="outline">{project.template_type}</Badge>
              </div>
            </div>

            <div>
              <Label>Created</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {project.created_at ? (
                  <DateTimeDisplay timestamp={project.created_at} />
                ) : (
                  <span>Unknown</span>
                )}
              </p>
            </div>
          </div>
          <div className="bg-muted p-3 rounded-b-lg flex justify-end gap-3 border-t">
            <Button
              onClick={handleSaveSettings}
              disabled={updateProjectMutation.isPending || projectName === project.name}
            >
              {updateProjectMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      {/* Publication Settings */}
      <div className="space-y-2">
        <div className="flex items-center justify-between pb-3 border-b mb-4">
          <div className="flex items-center space-x-2">
            <h3 className="font-medium">Publication Settings</h3>
          </div>
        </div>
        <div className="overflow-hidden">
          <div className="space-y-4">
            <div>
              <Label>Publication Status</Label>
              <div className="mt-1">
                {getStatusBadge(project.deploy_status, !!project.netlify_url)}
              </div>
            </div>

            {project.netlify_url && (
              <div>
                <Label>Live URL</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input value={project.netlify_url} readOnly className="flex-1 bg-muted" />
                  <Button
                    className="h-9"
                    size="sm"
                    onClick={() =>
                      project.netlify_url && window.open(project.netlify_url, "_blank")
                    }
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {project.netlify_site_id && (
              <div>
                <Label>Netlify Site ID</Label>
                <Input value={project.netlify_site_id} readOnly className="mt-1 bg-muted" />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between pb-3 border-b mb-4">
          <div className="flex items-center space-x-2">
            <h3 className="font-medium">Danger Zone</h3>
          </div>
        </div>
        <div className="bg-background rounded-lg border overflow-hidden">
          <div className="p-4">
            <h4 className="font-medium mb-2">Delete Project</h4>
            <p className="text-sm">
              Once you delete a project, there is no going back. Please be certain. This will
              permanently delete all files, publications, and history.
            </p>
          </div>
          <div className="bg-muted p-3 rounded-b-lg flex justify-end gap-3 border-t">
            <DeleteProjectDialog projectId={project.id} variant="button" />
          </div>
        </div>
      </div>
    </div>
  )
}
