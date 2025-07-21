"use client"

import { useWebSocket } from "@/hooks/use-websocket"
import type { ProjectRow } from "@shipvibes/database"
import React, { createContext, useCallback, useContext, useEffect, useState } from "react"

interface ProjectContextType {
  project: ProjectRow
  history: any[]
  pendingChanges: any[]
  agentConnected: boolean
  isConnected: boolean
  lastUpdated: Date
  updateHistory: (history: any[]) => void
  updatePendingChanges: (changes: any[]) => void
  saveAllChanges: (commitMessage?: string) => void
  discardAllChanges: () => void
  isSaving: boolean
  initializationProgress: {
    progress: number
    stage: string
    message: string
  }
}

const ProjectContext = createContext<ProjectContextType | null>(null)

export function useProject() {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error("useProject must be used within ProjectLayoutClient")
  }
  return context
}

interface ProjectLayoutClientProps {
  project: ProjectRow
  initialHistory: any[]
  initialPendingChanges: any[]
  children: React.ReactNode
}

export function ProjectLayoutClient({
  project: initialProject,
  initialHistory,
  initialPendingChanges,
  children,
}: ProjectLayoutClientProps) {
  console.log("🎯 ProjectLayoutClient: Initializing with:", {
    projectId: initialProject.id,
    initialHistoryLength: initialHistory?.length || 0,
    initialHistory: initialHistory,
    initialPendingChangesLength: initialPendingChanges?.length || 0,
    initialPendingChanges: initialPendingChanges,
  })

  const [project, setProject] = useState(initialProject)
  const [history, setHistory] = useState(initialHistory)
  const [pendingChanges, setPendingChanges] = useState(initialPendingChanges)
  const [agentConnected, setAgentConnected] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [isSaving, setIsSaving] = useState(false)
  const [initializationProgress, setInitializationProgress] = useState({
    progress: 0,
    stage: "",
    message: "Initializing...",
  })

  useEffect(() => {
    console.log("📊 [ProjectLayout] Pending changes state changed:", {
      count: pendingChanges.length,
      changes: pendingChanges.map((c) => ({
        path: c.file_path,
        action: c.action,
      })),
    })
  }, [pendingChanges])

  // WebSocket for real-time updates
  const {
    isConnected,
    saveAllChanges: socketSaveAllChanges,
    discardAllChanges: socketDiscardAllChanges,
  } = useWebSocket({
    projectId: project.id,

    onAgentConnected: useCallback(
      (data: { projectId: string; clientId: string; timestamp: string }) => {
        console.log("🟢 [ProjectLayout] Agent connected:", data)
        setAgentConnected(true)
        setLastUpdated(new Date())
      },
      [],
    ),

    onAgentDisconnected: useCallback(
      (data: { projectId: string; clientId: string; timestamp: string }) => {
        console.log("🔴 [ProjectLayout] Agent disconnected:", data)
        setAgentConnected(false)
        setLastUpdated(new Date())
      },
      [],
    ),

    onFileTracked: useCallback(
      (data: any) => {
        console.log("📝 [ProjectLayout] File tracked event received:", {
          eventProjectId: data.projectId,
          currentProjectId: project.id,
          filePath: data.filePath,
          action: data.action,
          matches: data.projectId === project.id,
        })
        if (data.projectId === project.id) {
          setPendingChanges((prev) => {
            const existing = prev.find((change) => change.file_path === data.filePath)

            // If file deleted, remove it from pending changes
            if (data.action === "deleted") {
              return prev.filter((change) => change.file_path !== data.filePath)
            }

            if (existing) {
              // Update existing change
              return prev.map((change) =>
                change.file_path === data.filePath
                  ? {
                      ...change,
                      action: data.action || "modified",
                      file_size: data.content
                        ? Buffer.byteLength(data.content, "utf8")
                        : change.file_size || 0,
                      updated_at: new Date().toISOString(),
                    }
                  : change,
              )
            } else {
              // Add new change
              return [
                ...prev,
                {
                  id: Math.random().toString(),
                  file_path: data.filePath,
                  action: data.action || "modified",
                  file_size: data.content ? Buffer.byteLength(data.content, "utf8") : 0,
                  updated_at: new Date().toISOString(),
                },
              ]
            }
          })
          setLastUpdated(new Date())

          console.log("📊 [ProjectLayout] Pending changes updated for file:", {
            filePath: data.filePath,
            action: data.action,
          })
        }
      },
      [project.id],
    ),
    onSaveSuccess: useCallback(
      (data: any) => {
        console.log("💾 [ProjectLayout] Save success received:", data)
        if (data.projectId === project.id) {
          setIsSaving(false)
          setPendingChanges([])
          setLastUpdated(new Date())
        }
      },
      [project.id],
    ),
    onCommitCreated: useCallback(
      (data: { projectId: string; commit: any; timestamp: number }) => {
        console.log("📝 [ProjectLayout] Commit created:", data)
        console.log("🎯 [ProjectLayout] onCommitCreated details:", {
          eventProjectId: data.projectId,
          currentProjectId: project.id,
          matches: data.projectId === project.id,
          hasCommit: !!data.commit,
          commit: data.commit,
        })

        if (data.projectId === project.id && data.commit) {
          console.log("✅ [ProjectLayout] Adding commit to history")
          // Add new commit to history beginning
          setHistory((prev) => {
            console.log("📊 [ProjectLayout] History before:", prev)
            const newHistory = [data.commit, ...prev]
            console.log("📊 [ProjectLayout] History after:", newHistory)
            return newHistory
          })
          setLastUpdated(new Date())
        } else {
          console.log("❌ [ProjectLayout] Commit not added - project mismatch or no commit data")
        }
      },
      [project.id],
    ),
    onDeployStatusUpdate: useCallback(
      (data: {
        projectId: string
        status: string
        url?: string
        error?: string
        timestamp: string
      }) => {
        console.log("🚀 [ProjectLayout] Deploy status update:", data)
        if (data.projectId === project.id) {
          // Update project status in real time
          setProject((prev: ProjectRow) => ({
            ...prev,
            deploy_status: data.status as "pending" | "building" | "ready" | "failed" | "cancelled",
            netlify_url: data.url || prev.netlify_url,
            updated_at: data.timestamp || new Date().toISOString(),
          }))
          setLastUpdated(new Date())

          console.log("✅ [ProjectLayout] Project status updated:", {
            newStatus: data.status,
            url: data.url,
          })
        }
      },
      [project.id],
    ),
    onInitializationProgress: useCallback(
      (data: { projectId: string; stage: string; progress: number; message: string }) => {
        console.log("📊 [ProjectLayout] Initialization progress:", data)
        if (data.projectId === project.id) {
          setInitializationProgress({
            progress: data.progress,
            stage: data.stage,
            message: data.message,
          })
          setLastUpdated(new Date())
        }
      },
      [project.id],
    ),
    onError: useCallback((error: any) => {
      console.error("❌ [ProjectLayout] WebSocket error:", error)
      setIsSaving(false)
    }, []),
  })

  const updateHistory = (newHistory: any[]) => {
    console.log("🔄 [ProjectLayout] updateHistory called with:", {
      newHistoryLength: newHistory?.length || 0,
      newHistory: newHistory,
    })
    setHistory(newHistory)
    setLastUpdated(new Date())
  }

  const updatePendingChanges = (changes: any[]) => {
    setPendingChanges(changes)
    setLastUpdated(new Date())
  }

  const saveAllChanges = (commitMessage?: string) => {
    console.log("💾 [ProjectLayout] Starting save all changes...")
    setIsSaving(true)
    socketSaveAllChanges(commitMessage)
  }

  const discardAllChanges = () => {
    console.log("🗑️ [ProjectLayout] Discarding all changes...")
    socketDiscardAllChanges()
  }

  const contextValue: ProjectContextType = {
    project,
    history,
    pendingChanges,
    agentConnected,
    isConnected,
    lastUpdated,
    updateHistory,
    updatePendingChanges,
    saveAllChanges,
    discardAllChanges,
    isSaving,
    initializationProgress,
  }

  return <ProjectContext.Provider value={contextValue}>{children}</ProjectContext.Provider>
}
