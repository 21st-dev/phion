import React from "react";
import { notFound } from "next/navigation";
import { StatusDot } from "@/components/geist/status-dot";
import { Skeleton } from "@/components/geist/skeleton";
import { ProjectNavigation } from "@/components/project/project-navigation";
import { ProjectWebSocketProvider } from "@/components/project/project-websocket-provider";
import { ProjectLayoutClient } from "@/components/project/project-layout-client";
import {
  getProjectById,
  getProjectFileHistory,
  getPendingChanges,
} from "@shipvibes/database";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const { id } = await params;

  const [project, history, pendingChanges] = await Promise.all([
    getProjectById(id),
    getProjectFileHistory(id, 50),
    getPendingChanges(id),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <ProjectLayoutClient
      project={project}
      initialHistory={history}
      initialPendingChanges={pendingChanges}
    >
      <ProjectWebSocketProvider
        project={project}
        initialHistory={history}
        initialPendingChanges={pendingChanges}
      >
        <div className="min-h-screen bg-background">
          {/* Project Header */}
          <div className="border-b border-border bg-card">
            <div className="container mx-auto px-6">
              <div className="flex items-center justify-between py-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
                    {project.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      {project.name}
                    </h1>
                    <div className="flex items-center space-x-2 mt-1">
                      <StatusDot state="READY" />
                      <span className="text-sm text-muted-foreground">
                        Agent: Offline
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <ProjectNavigation projectId={project.id} />
            </div>
          </div>

          {/* Page Content */}
          <div className="container mx-auto px-6 py-8">{children}</div>
        </div>
      </ProjectWebSocketProvider>
    </ProjectLayoutClient>
  );
}
