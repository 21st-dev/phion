"use client";

import React, { createContext, useContext, useState } from "react";
import { StatusDot } from "@/components/geist/status-dot";
import { ProjectNavigation } from "@/components/project/project-navigation";
import { useWebSocket } from "@/hooks/use-websocket";
import type { ProjectRow } from "@shipvibes/database";

interface ProjectContextType {
  project: ProjectRow;
  history: any[];
  pendingChanges: any[];
  agentConnected: boolean;
  isConnected: boolean;
  lastUpdated: Date;
  updateHistory: (history: any[]) => void;
  updatePendingChanges: (changes: any[]) => void;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within ProjectLayoutClient");
  }
  return context;
}

interface ProjectLayoutClientProps {
  project: ProjectRow;
  initialHistory: any[];
  initialPendingChanges: any[];
  children: React.ReactNode;
}

export function ProjectLayoutClient({
  project,
  initialHistory,
  initialPendingChanges,
  children,
}: ProjectLayoutClientProps) {
  const [history, setHistory] = useState(initialHistory);
  const [pendingChanges, setPendingChanges] = useState(initialPendingChanges);
  const [agentConnected, setAgentConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // WebSocket для real-time обновлений
  const { isConnected } = useWebSocket({
    projectId: project.id,
    onAgentConnected: (data) => {
      if (data.projectId === project.id) {
        setAgentConnected(true);
      }
    },
    onAgentDisconnected: (data) => {
      if (data.projectId === project.id) {
        setAgentConnected(false);
      }
    },
    onFileTracked: (data) => {
      if (data.projectId === project.id) {
        setPendingChanges((prev) => {
          const existing = prev.find(
            (change) => change.file_path === data.filePath
          );
          if (existing) {
            return prev.map((change) =>
              change.file_path === data.filePath
                ? {
                    ...change,
                    updated_at: new Date().toISOString(),
                  }
                : change
            );
          } else {
            return [
              ...prev,
              {
                id: Math.random().toString(),
                file_path: data.filePath,
                action: "modified" as const,
                file_size: data.content
                  ? Buffer.byteLength(data.content, "utf8")
                  : 0,
                updated_at: new Date().toISOString(),
              },
            ];
          }
        });
        setLastUpdated(new Date());
      }
    },
  });

  const updateHistory = (newHistory: any[]) => {
    setHistory(newHistory);
    setLastUpdated(new Date());
  };

  const updatePendingChanges = (changes: any[]) => {
    setPendingChanges(changes);
    setLastUpdated(new Date());
  };

  const contextValue: ProjectContextType = {
    project,
    history,
    pendingChanges,
    agentConnected,
    isConnected,
    lastUpdated,
    updateHistory,
    updatePendingChanges,
  };

  return (
    <ProjectContext.Provider value={contextValue}>
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
                    <StatusDot
                      state={agentConnected ? "READY" : "ERROR"}
                    />
                    <span className="text-sm text-muted-foreground">
                      Agent: {agentConnected ? "Connected" : "Offline"}
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
    </ProjectContext.Provider>
  );
}
