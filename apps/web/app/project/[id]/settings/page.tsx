"use client";

import { useState, useEffect } from "react";
import { Material } from "@/components/geist/material";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DeleteProjectDialog } from "@/components/project/delete-project-dialog";
import { AlertTriangle, ExternalLink, Copy } from "lucide-react";
import { useProject } from "@/components/project/project-layout-client";
import { useToast } from "@/hooks/use-toast";

// Client-side only date/time display component
function DateTimeDisplay({ timestamp }: { timestamp: string }) {
  const [dateString, setDateString] = useState<string>("");
  const [timeString, setTimeString] = useState<string>("");

  useEffect(() => {
    const date = new Date(timestamp);
    setDateString(date.toLocaleDateString());
    setTimeString(date.toLocaleTimeString());
  }, [timestamp]);

  if (!dateString || !timeString) {
    return <span>Loading...</span>;
  }

  return (
    <span>
      {dateString} at {timeString}
    </span>
  );
}

export default function ProjectSettingsPage() {
  const { project } = useProject();
  const [projectName, setProjectName] = useState(project.name);
  const [isSaving, setIsSaving] = useState(false);
  const { error: showError, success: showSuccess } = useToast();

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: projectName,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      showSuccess(
        "Settings saved",
        "Project settings have been updated successfully"
      );
      console.log("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      showError("Failed to save settings", "Please try again");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyProjectId = () => {
    navigator.clipboard.writeText(project.id);
    showSuccess(
      "Project ID copied",
      "The project ID has been copied to your clipboard"
    );
    console.log("Project ID copied to clipboard");
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* General Settings */}
      <Material type="base" className="p-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">
              General Settings
            </h3>
          </div>

          <div className="space-y-4">
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
                <Input
                  id="project-id"
                  value={project.id}
                  readOnly
                  className="flex-1 bg-muted"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyProjectId}
                >
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

          <div className="flex justify-end">
            <Button
              onClick={handleSaveSettings}
              disabled={isSaving || projectName === project.name}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </Material>

      {/* Deployment Settings */}
      <Material type="base" className="p-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Deployment Settings
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Deploy Status</Label>
              <div className="mt-1">
                <Badge
                  variant={
                    project.deploy_status === "ready" ? "default" : "outline"
                  }
                >
                  {project.deploy_status || "Not deployed"}
                </Badge>
              </div>
            </div>

            {project.netlify_url && (
              <div>
                <Label>Live URL</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    value={project.netlify_url}
                    readOnly
                    className="flex-1 bg-muted"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      project.netlify_url &&
                      window.open(project.netlify_url, "_blank")
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
                <Input
                  value={project.netlify_site_id}
                  readOnly
                  className="mt-1 bg-muted"
                />
              </div>
            )}
          </div>
        </div>
      </Material>

      {/* Danger Zone */}
      <Material
        type="base"
        className="p-6 border-destructive/20 bg-destructive/5"
      >
        <div className="space-y-6">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h3 className="text-lg font-semibold text-destructive">
              Danger Zone
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-destructive mb-2">
                Delete Project
              </h4>
              <p className="text-sm text-destructive/80 mb-4">
                Once you delete a project, there is no going back. Please be
                certain. This will permanently delete all files, deployments,
                and history.
              </p>
              <DeleteProjectDialog projectId={project.id} variant="button" />
            </div>
          </div>
        </div>
      </Material>
    </div>
  );
}
