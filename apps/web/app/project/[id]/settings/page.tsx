"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Material } from "@/components/geist/material";
import { Button } from "@/components/geist/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, ExternalLink, Copy, Trash2 } from "lucide-react";
import { useProject } from "@/components/project/project-layout-client";

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
  const router = useRouter();
  const { project } = useProject();
  const [projectName, setProjectName] = useState(project.name);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

      // TODO: Add toast notification for success
      console.log("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      // TODO: Add toast notification for error
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyProjectId = () => {
    navigator.clipboard.writeText(project.id);
    // TODO: Add toast notification
    console.log("Project ID copied to clipboard");
  };

  const confirmDeleteProject = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete project");
      }

      // TODO: Add toast notification for success
      console.log("Project deleted successfully");

      // Redirect to home page
      router.push("/");
    } catch (error) {
      console.error("Error deleting project:", error);
      // TODO: Add toast notification for error
      alert("Failed to delete project. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
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
                  type="secondary"
                  size="small"
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
                    type="secondary"
                    size="small"
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
              <AlertDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    type="error"
                    disabled={isDeleting}
                    prefix={<Trash2 className="w-4 h-4" />}
                  >
                    {isDeleting ? "Deleting..." : "Delete Project"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Project</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this project? This action
                      cannot be undone. This will permanently delete all files,
                      deployments, and history.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={confirmDeleteProject}
                      variant="destructive"
                      loading={isDeleting}
                    >
                      Delete Project
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </Material>
    </div>
  );
}
