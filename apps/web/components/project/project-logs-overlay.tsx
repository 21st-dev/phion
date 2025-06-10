"use client";

import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectLogEntry } from "@shipvibes/shared";
import { Activity, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectLogsOverlayProps {
  projectId: string;
}

const EVENT_ICONS = {
  project_created: "🚀",
  file_changed: "📝",
  file_deleted: "🗑️",
  commit_created: "💾",
  deploy_started: "🏗️",
  deploy_building: "⚙️",
  deploy_completed: "✅",
  deploy_failed: "❌",
  agent_connected: "📡",
  agent_disconnected: "📴",
  template_extracted: "📦",
  pending_changes_cleared: "🧹",
  project_deleted: "💥",
  error: "⚠️",
} as const;

const EVENT_LABELS = {
  project_created: "Проект создан",
  file_changed: "Файл изменен",
  file_deleted: "Файл удален",
  commit_created: "Коммит создан",
  deploy_started: "Деплой запущен",
  deploy_building: "Идет сборка",
  deploy_completed: "Деплой завершен",
  deploy_failed: "Ошибка деплоя",
  agent_connected: "Агент подключен",
  agent_disconnected: "Агент отключен",
  template_extracted: "Шаблон распакован",
  pending_changes_cleared: "Изменения сохранены",
  project_deleted: "Проект удален",
  error: "Ошибка",
} as const;

const EVENT_COLORS = {
  project_created: "bg-blue-100 text-blue-800 border-blue-200",
  file_changed: "bg-yellow-100 text-yellow-800 border-yellow-200",
  file_deleted: "bg-red-100 text-red-800 border-red-200",
  commit_created: "bg-green-100 text-green-800 border-green-200",
  deploy_started: "bg-orange-100 text-orange-800 border-orange-200",
  deploy_building: "bg-orange-100 text-orange-800 border-orange-200",
  deploy_completed: "bg-green-100 text-green-800 border-green-200",
  deploy_failed: "bg-red-100 text-red-800 border-red-200",
  agent_connected: "bg-green-100 text-green-800 border-green-200",
  agent_disconnected: "bg-gray-100 text-gray-800 border-gray-200",
  template_extracted: "bg-purple-100 text-purple-800 border-purple-200",
  pending_changes_cleared: "bg-blue-100 text-blue-800 border-blue-200",
  project_deleted: "bg-red-100 text-red-800 border-red-200",
  error: "bg-red-100 text-red-800 border-red-200",
} as const;

export function ProjectLogsOverlay({ projectId }: ProjectLogsOverlayProps) {
  const [logs, setLogs] = useState<ProjectLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<string>("");
  const [newLogCount, setNewLogCount] = useState(0);

  const fetchLogs = async () => {
    if (!isOpen) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/logs?limit=100${
          filter ? `&type=${filter}` : ""
        }`
      );
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setNewLogCount(0);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [isOpen, filter, projectId]);

  // Poll for new logs when overlay is closed
  useEffect(() => {
    if (isOpen) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/logs?limit=1`);
        if (response.ok) {
          const data = await response.json();
          if (data.logs && data.logs.length > 0) {
            const latestLog = data.logs[0];
            const currentLatest = logs[0];

            if (
              !currentLatest ||
              new Date(latestLog.timestamp) > new Date(currentLatest.timestamp)
            ) {
              setNewLogCount((prev) => prev + 1);
            }
          }
        }
      } catch (error) {
        // Ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen, logs, projectId]);

  const filteredLogs = logs.filter(
    (log) => !filter || log.event_type === filter
  );

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getLogDetails = (log: ProjectLogEntry) => {
    const details = log.details || {};

    switch (log.event_type) {
      case "file_changed":
        return `${details.filePath || ""} (${details.action || "modified"})`;
      case "commit_created":
        return `${details.commitMessage || "Коммит"} (${
          details.filesCount || 0
        } файлов)`;
      case "deploy_completed":
        return details.deployUrl || "Деплой завершен";
      case "agent_connected":
      case "agent_disconnected":
        return `Client: ${details.clientId?.slice(0, 8) || "unknown"}`;
      case "pending_changes_cleared":
        return `Очищено изменений: ${details.clearedChangesCount || 0}`;
      default:
        return details.action || details.description || "";
    }
  };

  const uniqueEventTypes = Array.from(
    new Set(logs.map((log) => log.event_type))
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "fixed bottom-4 right-4 z-50 shadow-lg",
            "bg-background/80 backdrop-blur-sm border-2",
            newLogCount > 0 && "border-blue-500 bg-blue-50/80"
          )}
        >
          <Activity className="h-4 w-4 mr-2" />
          Логи
          {newLogCount > 0 && (
            <Badge variant="destructive" className="ml-2 px-1 py-0 text-xs">
              {newLogCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[500px] sm:w-[600px]">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Логи проекта</span>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Filter */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filter === "" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("")}
            >
              Все
            </Button>
            {uniqueEventTypes.slice(0, 8).map((eventType) => (
              <Button
                key={eventType}
                variant={filter === eventType ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(eventType)}
                className="text-xs"
              >
                {EVENT_ICONS[eventType as keyof typeof EVENT_ICONS] || "📝"}{" "}
                {EVENT_LABELS[eventType as keyof typeof EVENT_LABELS] ||
                  eventType}
              </Button>
            ))}
          </div>

          {/* Logs */}
          <div className="h-[calc(100vh-180px)] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center text-muted-foreground p-8">
                Логи не найдены
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log, index) => (
                  <div
                    key={`${log.timestamp}-${index}`}
                    className="border rounded-lg p-3 text-sm"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {EVENT_ICONS[
                            log.event_type as keyof typeof EVENT_ICONS
                          ] || "📝"}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            EVENT_COLORS[
                              log.event_type as keyof typeof EVENT_COLORS
                            ] || "bg-gray-100 text-gray-800 border-gray-200"
                          )}
                        >
                          {EVENT_LABELS[
                            log.event_type as keyof typeof EVENT_LABELS
                          ] || log.event_type}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(log.timestamp)}
                      </span>
                    </div>

                    <div className="text-sm">{getLogDetails(log)}</div>

                    {log.trigger && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Триггер: {log.trigger}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
