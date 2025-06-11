"use client";

import { Button } from "@/components/ui/button";
import { MoreVertical } from "lucide-react";
import { useProject } from "@/components/project/project-layout-client";
import { DeploymentsList } from "@/components/deployments-list";
import { DeploymentPreviewCard } from "@/components/deployment-preview-card";
import { DeleteProjectDialog } from "@/components/project/delete-project-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ProjectOverviewPage() {
  const { project } = useProject();

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1 space-y-8">
        {/* Complete Save History */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent Saves</h2>
          </div>

          <DeploymentsList />
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 flex-shrink-0 space-y-6">
        {/* Live Preview Header */}
        <div className="flex items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DeleteProjectDialog
                projectId={project.id}
                variant="menu-item"
                trigger={
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    Delete Project
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <DeploymentPreviewCard />
      </div>
    </div>
  );
}
