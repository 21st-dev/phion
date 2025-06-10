"use client";

import React, { createContext, useContext, useState } from "react";
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
      console.log("🟢 [ProjectLayout] Agent connected event received:", data);
      if (data.projectId === project.id) {
        console.log("✅ [ProjectLayout] Setting agentConnected to true");
        setAgentConnected(true);
      }
    },
    onAgentDisconnected: (data) => {
      console.log(
        "🔴 [ProjectLayout] Agent disconnected event received:",
        data
      );
      if (data.projectId === project.id) {
        console.log("❌ [ProjectLayout] Setting agentConnected to false");
        setAgentConnected(false);
      }
    },
    onFileTracked: (data) => {
      console.log("📝 [ProjectLayout] File tracked event received:", data);
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
      {children}
    </ProjectContext.Provider>
  );
}
