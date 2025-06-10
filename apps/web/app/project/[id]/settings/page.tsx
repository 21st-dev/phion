"use client";

import { useState } from "react";
import { Material } from "@/components/geist/material";
import { Button } from "@/components/geist/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ExternalLink, Copy, Trash2 } from "lucide-react";
import { useProject } from "@/components/project/project-layout-client";

export default function ProjectSettingsPage() {
  const { project } = useProject();
  const [projectName, setProjectName] = useState(project.name);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    // Add save logic here
    setTimeout(() => setIsSaving(false), 1000);
  };

  const handleCopyProjectId = () => {
    navigator.clipboard.writeText(project.id);
    // Add toast notification
  };

  const handleDeleteProject = () => {
    if (
      confirm(
        "Are you sure you want to delete this project? This action cannot be undone."
      )
    ) {
      // Add delete logic here
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
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
                {new Date(project.created_at).toLocaleDateString()} at{" "}
                {new Date(project.created_at).toLocaleTimeString()}
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
      <Material type="base" className="p-6 border-red-200 bg-red-50">
        <div className="space-y-6">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-red-900">Danger Zone</h3>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-red-900 mb-2">Delete Project</h4>
              <p className="text-sm text-red-700 mb-4">
                Once you delete a project, there is no going back. Please be
                certain. This will permanently delete all files, deployments,
                and history.
              </p>
              <Button
                type="error"
                onClick={handleDeleteProject}
                prefix={<Trash2 className="w-4 h-4" />}
              >
                Delete Project
              </Button>
            </div>
          </div>
        </div>
      </Material>
    </div>
  );
}
